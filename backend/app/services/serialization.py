import math
import numpy as np
import pandas as pd


def series_to_json_list(series: pd.Series) -> list:
    """Превращает Series в список, где NaN/Inf → None."""
    def clean(v):
        if v is None:
            return None
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return None
        return float(v)
    return [clean(v) for v in series.tolist()]


def df_to_response(df: pd.DataFrame) -> dict:
    """Формирует ответ {depth: [...], CRV1: [...], CRV2: [...]}."""
    result: dict = {"depth": series_to_json_list(pd.Series(df.index))}
    for col in df.columns:
        result[col] = series_to_json_list(df[col])
    return result