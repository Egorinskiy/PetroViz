import logging
import pandas as pd
import numpy as np

from ..config import (
    MAX_POINTS_DEFAULT,
    MAX_POINTS_HARD_LIMIT,
    ADAPTIVE_POINTS_PER_METER,
    ADAPTIVE_MIN_POINTS,
    ADAPTIVE_MAX_POINTS,
    PIXEL_OVERSAMPLE,
    PIXEL_MIN_WIDTH,
    PIXEL_MAX_WIDTH,
)
from ..exceptions import InvalidParameterError

logger = logging.getLogger("petroviz.downsample")


# --- Резолверы max_points -----------------------------------------------

def compute_fixed_max_points(max_points: int | None) -> int:
    """Режим fixed: клиент либо задал число, либо берём дефолт."""
    value = max_points if max_points is not None else MAX_POINTS_DEFAULT
    if value <= 0:
        raise InvalidParameterError("max_points must be positive")
    if value > MAX_POINTS_HARD_LIMIT:
        raise InvalidParameterError(
            f"max_points exceeds hard limit {MAX_POINTS_HARD_LIMIT}"
        )
    return value


def compute_adaptive_max_points(start_depth: float, stop_depth: float) -> int:
    """Режим adaptive: число точек пропорционально интервалу глубин."""
    interval = abs(stop_depth - start_depth)
    if interval <= 0:
        return ADAPTIVE_MIN_POINTS

    raw = int(interval * ADAPTIVE_POINTS_PER_METER)
    clamped = max(ADAPTIVE_MIN_POINTS, min(raw, ADAPTIVE_MAX_POINTS))
    logger.debug(
        "adaptive: interval=%.2f m → raw=%d → clamped=%d",
        interval, raw, clamped,
    )
    return clamped


def compute_pixel_max_points(pixel_width: int | None) -> int:
    """Режим pixel: число точек привязано к ширине канваса."""
    if pixel_width is None:
        raise InvalidParameterError(
            "pixel_width is required when mode=pixel"
        )
    if pixel_width < PIXEL_MIN_WIDTH:
        raise InvalidParameterError(
            f"pixel_width must be >= {PIXEL_MIN_WIDTH}"
        )
    if pixel_width > PIXEL_MAX_WIDTH:
        raise InvalidParameterError(
            f"pixel_width must be <= {PIXEL_MAX_WIDTH}"
        )
    raw = int(pixel_width * PIXEL_OVERSAMPLE)
    return min(raw, MAX_POINTS_HARD_LIMIT)


def resolve_max_points(
    mode: str,
    max_points: int | None,
    start_depth: float | None,
    stop_depth: float | None,
    pixel_width: int | None,
    df: pd.DataFrame,
) -> int:
    """
    Единая точка входа. Возвращает число точек для прореживания.

    df передаём, чтобы:
      * adaptive мог использовать реальные границы, если клиент их не задал;
      * избежать бессмысленного прореживания, когда точек и так мало.
    """
    if df.empty:
        return 0

    if mode == "fixed":
        result = compute_fixed_max_points(max_points)

    elif mode == "adaptive":
        actual_start = start_depth if start_depth is not None else float(df.index[0])
        actual_stop = stop_depth if stop_depth is not None else float(df.index[-1])
        result = compute_adaptive_max_points(actual_start, actual_stop)

    elif mode == "pixel":
        result = compute_pixel_max_points(pixel_width)

    else:
        raise InvalidParameterError(f"Unknown mode '{mode}'")

    # Смысл: не прореживать, если точек меньше, чем лимит
    result = min(result, len(df))
    logger.info(
        "resolved max_points=%d (mode=%s, df_len=%d)",
        result, mode, len(df),
    )
    return result


# --- Механика прореживания ----------------------------------------------

def downsample_df(df: pd.DataFrame, max_points: int) -> pd.DataFrame:
    """
    Возвращает не более max_points строк, равномерно распределённых по df,
    гарантированно включая первую и последнюю.
    """
    if max_points <= 0 or len(df) <= max_points:
        return df

    indices = np.linspace(0, len(df) - 1, max_points, dtype=int)
    return df.iloc[indices]