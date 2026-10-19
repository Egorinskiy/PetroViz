"""
Pydantic-схемы для петрофизических расчётов.
"""
from typing import Any

from pydantic import BaseModel, Field


class ParamSpec(BaseModel):
    """Метаданные одного параметра метода — для UI."""
    default: float | int
    min: float | int
    max: float | int
    step: float | int
    unit: str = ""
    description: str = ""


class ComputationRefRequirement(BaseModel):
    """Требование к сохранённому расчёту (например, 'phi' — из категории 'porosity')."""
    label: str
    category: str


class MethodSpec(BaseModel):
    """Спецификация метода расчёта."""
    key: str
    label: str
    category: str
    requires: list[str]
    params: dict[str, ParamSpec]
    output: str
    # NEW: требования к сохранённым расчётам — {role: {label, category}}
    requires_computations: dict[str, ComputationRefRequirement] = Field(default_factory=dict)


class MethodsListResponse(BaseModel):
    """Список всех методов, сгруппированных по категории."""
    methods: list[MethodSpec]


class ComputeRequest(BaseModel):
    """
    Запрос на расчёт.

    :param well_id: ID скважины
    :param method: ключ метода из METHODS
    :param curve_mapping: маппинг роли → мнемоника кривой
                          Например: {"gr": "GR", "rhob": "RHOB"}
    :param params: параметры метода (переопределяют defaults)
    """
    well_id: str
    method: str
    curve_mapping: dict[str, str] = Field(default_factory=dict)
    params: dict[str, Any] = Field(default_factory=dict)
    # NEW: role → computation_id (UUID сохранённого расчёта)
    computation_refs: dict[str, str] = Field(default_factory=dict)


class CurveResult(BaseModel):
    """Результат расчёта одной кривой."""
    mnemonic: str
    unit: str
    values: list[float | None]


class ComputeResponse(BaseModel):
    """
    Ответ с рассчитанными кривыми.

    :param depth: массив глубин (общий для всех кривых)
    :param curves: словарь {mnemonic: CurveResult}
    :param warnings: предупреждения (например, "Rt contains no positive values")
    """
    depth: list[float]
    curves: dict[str, CurveResult]
    warnings: list[str] = Field(default_factory=list)
    # NEW: role → computation_id — какие источники использованы
    sources: dict[str, str] | None = None