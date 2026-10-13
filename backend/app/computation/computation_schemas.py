"""
Pydantic-схемы для сохранённых расчётов.
"""
from typing import Any

from pydantic import BaseModel, Field


class SaveComputationRequest(BaseModel):
    """Запрос на сохранение расчёта (использует данные текущего preview)."""
    method: str
    curve_mapping: dict[str, str] = Field(default_factory=dict)
    params: dict[str, Any] = Field(default_factory=dict)
    # Опциональное кастомное имя выходной кривой
    output_mnemonic: str | None = None


class ComputationMeta(BaseModel):
    """Метаданные сохранённого расчёта."""
    id: str
    well_id: str
    user_id: str
    method: str
    params: dict[str, Any]
    curve_mapping: dict[str, str]
    output_mnemonic: str
    warnings: list[str]
    num_samples: int
    created_at: str | None


class ComputationListResponse(BaseModel):
    items: list[ComputationMeta]


class ComputationDataResponse(BaseModel):
    """
    Полный расчёт: метаданные + depth + values.
    """
    id: str
    output_mnemonic: str
    method: str
    depth: list[float]
    values: list[float | None]