"""
API петрофизических расчётов.
"""
import logging
import pandas as pd
import uuid as _uuid
import re
from datetime import datetime
from io import StringIO

import lasio
from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..computation.pad_schemas import (
    PadStateSaveRequest, PadStateResponse,
    ExportLasRequest,
)
from ..repositories.pad_state_repository import PadStateRepository
from ..computation.computation_schemas import (
    SaveComputationRequest,
    ComputationMeta,
    ComputationListResponse,
    ComputationDataResponse,
)
from ..repositories.computation_repository import ComputationRepository
from ..repositories.well_repository import WellRepository
from ..auth.dependencies import get_current_user, require_role, ForbiddenError
from ..computation.schemas import (
    ComputeRequest, ComputeResponse, CurveResult,
    MethodsListResponse, MethodSpec,
    ExternalCurveRequest, ExternalCurveResponse,
)
from ..computation.service import ComputationService
from ..db.models import User, UserRole
from ..db.session import get_session
from ..services.petrophysics import METHODS


logger = logging.getLogger("petroviz.api.computations")

router = APIRouter(tags=["computations"])


@router.get("/computations/methods", response_model=MethodsListResponse)
async def list_methods():
    """Список доступных петрофизических методов."""
    return MethodsListResponse(
        methods=[MethodSpec(**spec) for spec in METHODS.values()]
    )


@router.post("/computations/preview", response_model=ComputeResponse)
async def preview(
    data: ComputeRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Расчёт без сохранения. Используется для live-preview в UI.
    """
    svc = ComputationService(session)
    depth, curves, warnings, sources = await svc.compute_preview(
        well_id=data.well_id,
        method=data.method,
        curve_mapping=data.curve_mapping,
        params=data.params,
        computation_refs=data.computation_refs,
    )

    # Собираем ответ
    method_spec = METHODS.get(data.method, {})
    output_unit = method_spec.get("output_unit", "v/v")

    curves_resp = {}
    for mnemonic, series in curves.items():
        values = [
            None if pd.isna(v) else float(v)
            for v in series.tolist()
        ]
        curves_resp[mnemonic] = CurveResult(
            mnemonic=mnemonic,
            unit=output_unit,
            values=values,
        )

    return ComputeResponse(
        depth=depth, curves=curves_resp, warnings=warnings, sources=sources,
    )

@router.post(
    "/wells/{well_id}/computations",
    response_model=ComputationMeta,
    status_code=status.HTTP_201_CREATED,
)
async def save_computation(
    well_id: _uuid.UUID,
    data: SaveComputationRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.GEOPHYSICIST)),
):
    """
    Сохраняет текущий расчёт:
      1. Пересчитывает preview на бэкенде.
      2. Сохраняет данные в parquet.
      3. Сохраняет метаданные в БД.
    """
    # Проверяем, что скважина доступна пользователю
    well_repo = WellRepository(session)
    well_result = await well_repo.get(well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{well_id}' not found")

    # Считаем расчёт
    svc = ComputationService(session)
    depth, curves, warnings, sources = await svc.compute_preview(
        well_id=str(well_id),
        method=data.method,
        curve_mapping=data.curve_mapping,
        params=data.params,
        computation_refs=data.computation_refs,
    )

    # Пока поддерживаем один output на метод
    output_mnemonic, series = next(iter(curves.items()))
    # Custom name — если пользователь задал своё имя, переопределяем
    if data.output_mnemonic:
        output_mnemonic = data.output_mnemonic
    values = [
        None if pd.isna(v) else float(v)
        for v in series.tolist()
    ]

    # Сохраняем
    repo = ComputationRepository(session)
    comp = await repo.save(
        well_id=well_id,
        user_id=current_user.id,
        method=data.method,
        params=data.params,
        curve_mapping=data.curve_mapping,
        output_mnemonic=output_mnemonic,
        depth=depth,
        values=values,
        warnings=warnings,
        source_refs=sources,
    )
    return ComputationMeta(**repo.to_metadata(comp))


@router.get(
    "/wells/{well_id}/computations",
    response_model=ComputationListResponse,
)
async def list_computations(
    well_id: _uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Список сохранённых расчётов для скважины."""
    well_repo = WellRepository(session)
    well_result = await well_repo.get(well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{well_id}' not found")

    repo = ComputationRepository(session)
    items = await repo.list_for_well(well_id)
    return ComputationListResponse(
        items=[ComputationMeta(**repo.to_metadata(c)) for c in items]
    )


@router.get(
    "/computations/{comp_id}",
    response_model=ComputationDataResponse,
)
async def get_computation_data(
    comp_id: _uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Загружает сохранённый расчёт (метаданные + depth + values)."""
    repo = ComputationRepository(session)
    comp = await repo.get(comp_id)
    if comp is None:
        from ..exceptions import PetroVizError
        raise PetroVizError("Computation not found")

    # Проверка доступа: расчёт виден, если скважина доступна
    well_repo = WellRepository(session)
    well_result = await well_repo.get(comp.well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{comp.well_id}' not found")

    depth, values = await repo.load_data(comp)
    return ComputationDataResponse(
        id=str(comp.id),
        output_mnemonic=comp.output_mnemonic,
        method=comp.method,
        depth=depth,
        values=values,
    )


@router.delete(
    "/computations/{comp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_computation(
    comp_id: _uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Удаляет сохранённый расчёт. Мягкая политика: admin — любые, автор — свои."""
    repo = ComputationRepository(session)
    comp = await repo.get(comp_id)
    if comp is None:
        return None

    # Проверка прав: viewer не может удалять вообще
    if current_user.role == UserRole.VIEWER:
        raise ForbiddenError("Роль viewer не позволяет удалять расчёты")

    # Мягкая политика: admin — любые, geophysicist — только свои
    if current_user.role != UserRole.ADMIN and comp.user_id != current_user.id:
        raise ForbiddenError(
            "Удалить расчёт может только автор или администратор"
        )

    # Проверка доступа к скважине (как было)
    well_repo = WellRepository(session)
    well_result = await well_repo.get(comp.well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{comp.well_id}' not found")

    await repo.delete(comp)
    return None

@router.post(
    "/computations/external-curve",
    response_model=ExternalCurveResponse,
)
async def get_external_curve(
    data: ExternalCurveRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Возвращает кривую из LAS в формате preview — без расчёта.

    Нужно для B13: добавить внешнюю кривую (например, ЯМК) в Express-пористость
    для сравнения с расчётными PHID / PHIN / PHI_ND / PHIS.
    """
    well_repo = WellRepository(session)
    well_uuid = _uuid.UUID(data.well_id)

    # Проверка доступа: скважина видна пользователю
    well_result = await well_repo.get(well_uuid, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{data.well_id}' not found")

    well, df = well_result

    if data.mnemonic not in df.columns:
        from ..exceptions import PetroVizError
        raise PetroVizError(
            f"Curve '{data.mnemonic}' not found in well data. "
            f"Available: {list(df.columns)}"
        )

    series = df[data.mnemonic]
    depth = df.index.tolist()
    values = [
        None if pd.isna(v) else float(v)
        for v in series.tolist()
    ]

    # Единицы из метаданных скважины
    unit = None
    if well.curves:
        for c in well.curves:
            if c.get("mnemonic") == data.mnemonic:
                unit = c.get("unit")
                break

    return ExternalCurveResponse(
        mnemonic=data.mnemonic,
        unit=unit,
        depth=depth,
        values=values,
    )

# ============================================================================
# B29: сохранение состояния планшета пользователя
# ============================================================================

@router.get(
    "/wells/{well_id}/pad-state",
    response_model=PadStateResponse,
)
async def get_pad_state(
    well_id: _uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Возвращает сохранённое состояние планшета или пустое."""
    well_repo = WellRepository(session)
    well_result = await well_repo.get(well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{well_id}' not found")

    repo = PadStateRepository(session)
    pad_state = await repo.get(current_user.id, well_id)
    if pad_state is None:
        return PadStateResponse(state={}, updated_at=None)

    return PadStateResponse(
        state=pad_state.state or {},
        updated_at=pad_state.updated_at.isoformat()
        if pad_state.updated_at
        else None,
    )


@router.put(
    "/wells/{well_id}/pad-state",
    response_model=PadStateResponse,
)
async def save_pad_state(
    well_id: _uuid.UUID,
    data: PadStateSaveRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Сохраняет (создаёт или обновляет) состояние планшета."""
    well_repo = WellRepository(session)
    well_result = await well_repo.get(well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{well_id}' not found")

    repo = PadStateRepository(session)
    pad_state = await repo.save(current_user.id, well_id, data.state)
    return PadStateResponse(
        state=pad_state.state or {},
        updated_at=pad_state.updated_at.isoformat()
        if pad_state.updated_at
        else None,
    )


@router.delete(
    "/wells/{well_id}/pad-state",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_pad_state(
    well_id: _uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Удаляет сохранённое состояние планшета."""
    well_repo = WellRepository(session)
    well_result = await well_repo.get(well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{well_id}' not found")

    repo = PadStateRepository(session)
    await repo.delete(current_user.id, well_id)
    return None


# ============================================================================
# B42: экспорт в LAS
# ============================================================================

@router.post("/wells/{well_id}/export-las")
async def export_well_las(
    well_id: _uuid.UUID,
    data: ExportLasRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Экспортирует скважину + выбранные расчёты в LAS 2.0.

    LAS можно открыть в Techlog, Geolog, IP и др. — это стандарт индустрии.
    """
    well_repo = WellRepository(session)
    well_result = await well_repo.get(well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{well_id}' not found")

    well, df = well_result

    # --- Строим LASFile ---
    las = lasio.LASFile()

    # ~V (Version)
    las.version['VERS'] = lasio.HeaderItem(
        'VERS', unit='', value='2.0',
        descr='CWLS LOG ASCII STANDARD - VERSION 2.0',
    )
    las.version['WRAP'] = lasio.HeaderItem(
        'WRAP', unit='', value='NO', descr='ONE LINE PER DEPTH STEP',
    )
    las.version['DLM'] = lasio.HeaderItem(
        'DLM', unit='', value='COMMA', descr='DELIMITING CHARACTER',
    )
    las.version['STRT'] = lasio.HeaderItem(
        'STRT', unit='M', value=float(well.start_depth), descr='START DEPTH',
    )
    las.version['STOP'] = lasio.HeaderItem(
        'STOP', unit='M', value=float(well.stop_depth), descr='STOP DEPTH',
    )
    las.version['STEP'] = lasio.HeaderItem(
        'STEP', unit='M',
        value=float(well.step) if well.step else '',
        descr='STEP',
    )
    las.version['NULL'] = lasio.HeaderItem(
        'NULL', unit='', value=-999.25, descr='NULL VALUE',
    )

    # ~W (Well)
    las.well['WELL'] = lasio.HeaderItem(
        'WELL', unit='', value=well.well_name or well.filename, descr='WELL NAME',
    )
    las.well['STRT'] = lasio.HeaderItem(
        'STRT', unit='M', value=float(well.start_depth), descr='START DEPTH',
    )
    las.well['STOP'] = lasio.HeaderItem(
        'STOP', unit='M', value=float(well.stop_depth), descr='STOP DEPTH',
    )
    las.well['STEP'] = lasio.HeaderItem(
        'STEP', unit='M',
        value=float(well.step) if well.step else '',
        descr='STEP',
    )
    las.well['NULL'] = lasio.HeaderItem(
        'NULL', unit='', value=-999.25, descr='NULL VALUE',
    )
    las.well['COMP'] = lasio.HeaderItem(
        'COMP', unit='', value='PetroViz Export', descr='COMPANY',
    )
    las.well['DATE'] = lasio.HeaderItem(
        'DATE', unit='', value=datetime.now().strftime('%Y-%m-%d'),
        descr='DATE',
    )
    las.well['SRC'] = lasio.HeaderItem(
        'SRC', unit='', value=f'PetroViz (original: {well.filename})',
        descr='SOURCE',
    )

    # Глубина
    depth_mnemonic = well.depth_mnemonic or 'DEPT'
    las.append_curve(
        depth_mnemonic,
        df.index.values.astype(float),
        unit='M',
        descr='Depth',
    )

    # Исходные кривые из well.curves (в порядке загрузки) — только если включено
    if data.include_source_curves:
        for c in (well.curves or []):
            mnemonic = c.get('mnemonic')
            if not mnemonic or mnemonic not in df.columns:
                continue
            unit = c.get('unit') or ''
            descr = c.get('description') or mnemonic
            try:
                arr = pd.to_numeric(df[mnemonic], errors='coerce').values.astype(float)
                las.append_curve(
                    mnemonic,
                    arr,
                    unit=unit,
                    descr=descr,
                )
            except Exception as e:
                logger.warning("Skip curve %s in export: %s", mnemonic, e)

    # Сохранённые расчёты
    comp_repo = ComputationRepository(session)
    added_comp_ids = set()
    existing_mnemonics = {c.mnemonic for c in las.curves}

    for comp_id_str in (data.computations or []):
        try:
            comp_uuid = _uuid.UUID(comp_id_str)
        except ValueError:
            continue
        if comp_uuid in added_comp_ids:
            continue

        comp = await comp_repo.get(comp_uuid)
        if comp is None or comp.well_id != well.id:
            continue

        ref_depth, ref_values = await comp_repo.load_data(comp)
        if not ref_depth or not ref_values:
            continue

        # Приводим к df.index (nearest, если глубины не совпадают)
        try:
            series = pd.Series(ref_values, index=ref_depth)
            series = pd.to_numeric(series, errors='coerce')
            series = series.reindex(df.index, method='nearest')
            arr = series.values.astype(float)
        except Exception as e:
            logger.warning("Cannot align computation %s: %s", comp.id, e)
            continue

        # Имя: output_mnemonic (без суффиксов, латиница)
        mnemonic = re.sub(r'[^\w]', '_', comp.output_mnemonic)[:32] or 'COMP'
        base = mnemonic
        i = 1
        while mnemonic in existing_mnemonics:
            mnemonic = f"{base}_{i}"
            i += 1

        unit = METHODS.get(comp.method, {}).get('output_unit', 'v/v')
        descr = f"{comp.method} -> {comp.output_mnemonic}"

        try:
            las.append_curve(mnemonic, arr, unit=unit, descr=descr)
            existing_mnemonics.add(mnemonic)
            added_comp_ids.add(comp_uuid)
        except Exception as e:
            logger.warning("Cannot add computation %s: %s", comp.id, e)

    # --- Запись во временный файл (надёжнее StringIO) ---
    import os
    import tempfile

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.las')
    os.close(tmp_fd)
    try:
        las.write(tmp_path, version=2.0)
        with open(tmp_path, 'r', encoding='utf-8') as f:
            content = f.read()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # --- Имя файла ---
    raw_name = well.well_name or f"well_{well.id.hex[:8]}"
    safe_name = re.sub(r'[^\w\-]', '_', raw_name)[:40]
    date_str = datetime.now().strftime('%Y%m%d')
    filename = f"{safe_name}_export_{date_str}.las"

    return Response(
        content=content.encode('utf-8'),
        media_type="application/x-las",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Curves-Count": str(len(las.curves) - 1),  # без depth
            "X-Computations-Added": str(len(added_comp_ids)),
        },
    )

# ============================================================================
# B44: экспорт в CSV
# ============================================================================

@router.post("/wells/{well_id}/export-csv")
async def export_well_csv(
    well_id: _uuid.UUID,
    data: ExportLasRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Экспортирует скважину + выбранные расчёты в CSV (UTF-8 BOM, разделитель ',').

    Откроется в Excel, pandas, R. NaN → пустая строка.
    """
    well_repo = WellRepository(session)
    well_result = await well_repo.get(well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{well_id}' not found")

    well, df = well_result

    # Собираем DataFrame
    result = pd.DataFrame(index=df.index)
    result.index.name = well.depth_mnemonic or 'DEPT'

    # Исходные кривые
    if data.include_source_curves:
        for c in (well.curves or []):
            mnemonic = c.get('mnemonic')
            if not mnemonic or mnemonic not in df.columns:
                continue
            try:
                result[mnemonic] = pd.to_numeric(df[mnemonic], errors='coerce')
            except Exception as e:
                logger.warning("Skip curve %s in CSV export: %s", mnemonic, e)

    # Расчёты
    comp_repo = ComputationRepository(session)
    added_comp_ids = set()

    for comp_id_str in (data.computations or []):
        try:
            comp_uuid = _uuid.UUID(comp_id_str)
        except ValueError:
            continue
        if comp_uuid in added_comp_ids:
            continue

        comp = await comp_repo.get(comp_uuid)
        if comp is None or comp.well_id != well.id:
            continue

        ref_depth, ref_values = await comp_repo.load_data(comp)
        if not ref_depth or not ref_values:
            continue

        try:
            series = pd.Series(ref_values, index=ref_depth)
            series = pd.to_numeric(series, errors='coerce')
            series = series.reindex(df.index, method='nearest')
        except Exception as e:
            logger.warning("Cannot align computation %s in CSV: %s", comp.id, e)
            continue

        mnemonic = re.sub(r'[^\w]', '_', comp.output_mnemonic)[:32] or 'COMP'
        base = mnemonic
        i = 1
        while mnemonic in result.columns:
            mnemonic = f"{base}_{i}"
            i += 1

        result[mnemonic] = series
        added_comp_ids.add(comp_uuid)

    # CSV в StringIO (с UTF-8 BOM для Excel)
    buf = StringIO()
    buf.write('\ufeff')  # BOM
    result.to_csv(
        buf,
        index=True,
        float_format='%.6g',
        na_rep='',
        lineterminator='\n',
    )
    content = buf.getvalue()
    buf.close()

    # Имя файла
    raw_name = well.well_name or f"well_{well.id.hex[:8]}"
    safe_name = re.sub(r'[^\w\-]', '_', raw_name)[:40]
    date_str = datetime.now().strftime('%Y%m%d')
    filename = f"{safe_name}_export_{date_str}.csv"

    return Response(
        content=content.encode('utf-8'),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Computations-Added": str(len(added_comp_ids)),
        },
    )