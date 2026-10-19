"""
Связанная вода (Swi / bound water).

Вход — ВАЛИДИРОВАННЫЕ интерпретатором Vsh и PHI из сохранённых расчётов.
Метод НЕ занимается самосчётом Vsh/PHI.

Формула:
    Swi = clamp((C1 + C2 × Vsh) / PHI, SWI_MIN, SWI_MAX)
"""
import logging

import numpy as np
import pandas as pd

from .base import register_method

logger = logging.getLogger("petroviz.petrophysics.swi")


def swi_bound_water(
    vsh: pd.Series,
    phi: pd.Series,
    c1: float = 0.015,
    c2: float = 0.2,
    swi_min: float = 0.001,
    swi_max: float = 1.0,
) -> pd.Series:
    """
    Связанная водонасыщенность.

    Параметры:
        vsh      — валидированный Vsh (v/v), pd.Series с глубинами в индексе
        phi      — валидированная пористость (v/v), pd.Series с теми же глубинами
        c1, c2   — коэффициенты модели (по умолчанию 0.015, 0.2)
        swi_min  — нижняя граница обрезки
        swi_max  — верхняя граница обрезки
    """
    if swi_min >= swi_max:
        raise ValueError("swi_min must be less than swi_max")
    if c1 < 0:
        raise ValueError("c1 must be non-negative")
    if c2 < 0:
        raise ValueError("c2 must be non-negative")

    with np.errstate(divide="ignore", invalid="ignore"):
        swi = (c1 + c2 * vsh) / phi

    return swi.clip(lower=swi_min, upper=swi_max)


register_method({
    "key": "swi_bound_water",
    "label": "Swi — связанная вода (bound water)",
    "category": "swi",
    "requires": [],
    "requires_computations": {
        "vsh": {"label": "Глинистость (Vsh)", "category": "vshale"},
        "phi": {"label": "Пористость (PHI)", "category": "porosity"},
    },
    "params": {
        "c1": {
            "default": 0.015, "min": 0.0, "max": 0.1, "step": 0.001,
            "label": "C1 — свободный член",
            "unit": "v/v", "description": "Минимальная связанная вода в чистом песке",
        },
        "c2": {
            "default": 0.2, "min": 0.0, "max": 0.5, "step": 0.01,
            "label": "C2 — влияние глинистости",
            "unit": "v/v", "description": "Насколько сильно Vsh увеличивает Swi",
        },
        "swi_min": {
            "default": 0.001, "min": 0.001, "max": 0.3, "step": 0.001,
            "unit": "v/v", "description": "Минимальное значение Swi",
        },
        "swi_max": {
            "default": 1.0, "min": 0.5, "max": 1.0, "step": 0.01,
            "unit": "v/v", "description": "Максимальное значение Swi",
        },
    },
    "output": "SWI",
})