import logging
import pandas as pd
import numpy as np

from ..settings import settings
from ..exceptions import InvalidParameterError

logger = logging.getLogger("petroviz.downsample")


# --- Резолверы max_points -----------------------------------------------

def compute_fixed_max_points(max_points: int | None) -> int:
    """Режим fixed: клиент либо задал число, либо берём дефолт."""
    value = max_points if max_points is not None else settings.max_points_default
    if value <= 0:
        raise InvalidParameterError("max_points must be positive")
    if value > settings.max_points_hard_limit:
        raise InvalidParameterError(
            f"max_points exceeds hard limit {settings.max_points_hard_limit}"
        )
    return value


def compute_adaptive_max_points(start_depth: float, stop_depth: float) -> int:
    """Режим adaptive: число точек пропорционально интервалу глубин."""
    interval = abs(stop_depth - start_depth)
    if interval <= 0:
        return settings.adaptive_min_points

    raw = int(interval * settings.adaptive_points_per_meter)
    clamped = max(settings.adaptive_min_points, min(raw, settings.adaptive_max_points))
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
    if pixel_width < settings.pixel_min_width:
        raise InvalidParameterError(
            f"pixel_width must be >= {settings.pixel_min_width}"
        )
    if pixel_width > settings.pixel_max_width:
        raise InvalidParameterError(
            f"pixel_width must be <= {settings.pixel_max_width}"
        )
    raw = int(pixel_width * settings.pixel_oversample)
    return min(raw, settings.max_points_hard_limit)


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