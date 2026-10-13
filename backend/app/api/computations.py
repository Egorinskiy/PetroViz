"""
API петрофизических расчётов.
"""
import logging
import pandas as pd

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

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

router = APIRouter(prefix="/computations", tags=["computations"])


@router.get("/methods", response_model=MethodsListResponse)
async def list_methods():
    """Список доступных петрофизических методов."""
    return MethodsListResponse(
        methods=[MethodSpec(**spec) for spec in METHODS.values()]
    )


@router.post("/preview", response_model=ComputeResponse)
async def preview(
    data: ComputeRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Расчёт без сохранения. Используется для live-preview в UI.
    """
    svc = ComputationService(session)
    depth, curves, warnings = await svc.compute_preview(
        well_id=data.well_id,
        method=data.method,
        curve_mapping=data.curve_mapping,
        params=data.params,
    )

    # Собираем ответ
    curves_resp = {}
    for mnemonic, series in curves.items():
        values = [
            None if pd.isna(v) else float(v)
            for v in series.tolist()
        ]
        curves_resp[mnemonic] = CurveResult(
            mnemonic=mnemonic,
            unit="v/v",
            values=values,
        )

    return ComputeResponse(depth=depth, curves=curves_resp, warnings=warnings)
