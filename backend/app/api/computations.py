"""
API петрофизических расчётов.
"""
import logging
import pandas as pd
import uuid as _uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..computation.pad_schemas import (
    PadStateSaveRequest, PadStateResponse,
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