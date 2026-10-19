"""
API петрофизических расчётов.
"""
import logging
import pandas as pd
import uuid as _uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..computation.computation_schemas import (
    SaveComputationRequest,
    ComputationMeta,
    ComputationListResponse,
    ComputationDataResponse,
)
from ..repositories.computation_repository import ComputationRepository
from ..repositories.well_repository import WellRepository
from ..auth.dependencies import get_current_user
from ..computation.schemas import (
    ComputeRequest, ComputeResponse, CurveResult,
    MethodsListResponse, MethodSpec,
)
from ..computation.service import ComputationService
from ..db.models import User
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
    current_user: User = Depends(get_current_user),
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
    values = [
        None if pd.isna(v) else float(v)
        for v in series.tolist()
    ]

    # Сохраняем (с source_refs — для воспроизводимости)
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
    """Удаляет сохранённый расчёт."""
    repo = ComputationRepository(session)
    comp = await repo.get(comp_id)
    if comp is None:
        return None

    # Проверка доступа
    well_repo = WellRepository(session)
    well_result = await well_repo.get(comp.well_id, user_id=current_user.id)
    if well_result is None:
        from ..exceptions import WellNotFoundError
        raise WellNotFoundError(f"Well '{comp.well_id}' not found")

    await repo.delete(comp)
    return None