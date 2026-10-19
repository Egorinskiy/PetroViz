"""
NTG (net-to-gross) — cutoff-анализ.

Возвращает флаг-кривую:
    1.0 = коллектор
    0.0 = не коллектор
    NaN = нет данных (хотя бы один вход = NaN)

Логика:
    Коллектор = (Vsh < vsh_cutoff) AND (PHI > phi_cutoff) AND (Swi < swi_cutoff)
"""
import logging

import numpy as np
import pandas as pd

from .base import register_method

logger = logging.getLogger("petroviz.petrophysics.ntg")


def ntg_cutoff(
    vsh: pd.Series,
    phi: pd.Series,
    swi: pd.Series,
    vsh_cutoff: float = 0.4,
    phi_cutoff: float = 0.08,
    swi_cutoff: float = 0.85,
) -> pd.Series:
    """
    Флаг коллектора по трём отсечкам.

    Параметры:
        vsh         — глинистость (v/v)
        phi         — пористость (v/v)
        swi         — связанная вода (v/v)
        vsh_cutoff  — максимальная глинистость для коллектора (по умолчанию 0.4)
        phi_cutoff  — минимальная пористость для коллектора (по умолчанию 0.08)
        swi_cutoff  — максимальная Swi для коллектора (по умолчанию 0.85)
    """
    if not (0 <= vsh_cutoff <= 1):
        raise ValueError("vsh_cutoff must be in [0, 1]")
    if not (0 <= phi_cutoff <= 1):
        raise ValueError("phi_cutoff must be in [0, 1]")
    if not (0 <= swi_cutoff <= 1):
        raise ValueError("swi_cutoff must be in [0, 1]")

    valid = vsh.notna() & phi.notna() & swi.notna()
    is_net = (vsh < vsh_cutoff) & (phi > phi_cutoff) & (swi < swi_cutoff)

    return pd.Series(
        np.where(valid, is_net.astype(float), np.nan),
        index=vsh.index,
    )


register_method({
    "key": "ntg_cutoff",
    "label": "NTG — cutoff-анализ (коллектор/не коллектор)",
    "category": "ntg",
    "requires": [],
    "requires_computations": {
        "vsh": {"label": "Глинистость (Vsh)", "category": "vshale"},
        "phi": {"label": "Пористость (PHI)", "category": "porosity"},
        "swi": {"label": "Swi (связанная вода)", "category": "swi"},
    },
    "params": {
        "vsh_cutoff": {
            "default": 0.4, "min": 0.0, "max": 1.0, "step": 0.01,
            "label": "Отсечка Vsh", "unit": "v/v",
            "description": "Коллектор, если Vsh меньше этой отсечки",
        },
        "phi_cutoff": {
            "default": 0.08, "min": 0.0, "max": 0.6, "step": 0.01,
            "label": "Отсечка пористости", "unit": "v/v",
            "description": "Коллектор, если PHI больше этой отсечки",
        },
        "swi_cutoff": {
            "default": 0.85, "min": 0.0, "max": 1.0, "step": 0.01,
            "label": "Отсечка Swi", "unit": "v/v",
            "description": "Коллектор, если Swi меньше этой отсечки",
        },
    },
    "output": "NTG",
    "output_unit": "0/1",
})