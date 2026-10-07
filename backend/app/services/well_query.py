import logging
import pandas as pd

from ..exceptions import CurveNotFoundError
from .downsample import resolve_max_points, downsample_df
from .serialization import df_to_response

logger = logging.getLogger("petroviz.query")


def query_well_data(
    df: pd.DataFrame,
    *,
    curves: str | None = None,
    start_depth: float | None = None,
    stop_depth: float | None = None,
    mode: str = "fixed",
    max_points: int | None = None,
    pixel_width: int | None = None,
) -> dict:
    """
    Полный цикл подготовки ответа клиенту:
      1. фильтрация по глубине;
      2. выбор кривых;
      3. резолв числа точек (fixed/adaptive/pixel);
      4. прореживание;
      5. сериализация (NaN → null).
    """
    work = df.copy()
    logger.debug(
        "query: input df=%d rows, mode=%s, curves=%s, [%s..%s]",
        len(work), mode, curves, start_depth, stop_depth,
    )

    # 1. Фильтрация по глубине
    if start_depth is not None:
        work = work[work.index >= start_depth]
    if stop_depth is not None:
        work = work[work.index <= stop_depth]

    if work.empty:
        logger.info("query: empty result after depth filter")
        return {"depth": []}

    # 2. Выбор кривых
    if curves:
        wanted = [c.strip() for c in curves.split(",") if c.strip()]
        missing = [c for c in wanted if c not in work.columns]
        if missing:
            raise CurveNotFoundError(
                f"Curves not found: {missing}. Available: {list(work.columns)}"
            )
        work = work[wanted]

    # 3. Резолв числа точек
    n_points = resolve_max_points(
        mode=mode,
        max_points=max_points,
        start_depth=start_depth,
        stop_depth=stop_depth,
        pixel_width=pixel_width,
        df=work,
    )

    # 4. Прореживание
    work = downsample_df(work, n_points)

    # 5. Сериализация
    logger.info(
        "query: returning %d rows, %d columns (mode=%s, n_points=%d)",
        len(work), len(work.columns), mode, n_points,
    )
    return df_to_response(work)