import io
import time
import logging
from typing import Optional

import lasio
import numpy as np
import pandas as pd

from ..exceptions import LasParseError

logger = logging.getLogger("petroviz.las")


# Кандидаты на роль "глубинной" кривой, в порядке приоритета
DEPTH_MNEMONICS = [
    "DEPT", "DEPTH", "MD", "TVD", "TVDSS", "TVD_SS", "MD_KB", "DEPTH_M",
    "DEPT_M", "MD_GL", "INDEX", "TIME",
]

def _safe_str(value) -> str:
    """
    Конвертирует любое значение в строку, обходя numpy-типы.
    np.int64(631) → "631"
    """
    if value is None:
        return ""
    # numpy scalar → Python scalar
    if hasattr(value, "item"):
        value = value.item()
    return str(value)

def _json_safe(obj):
    """
    Рекурсивно превращает numpy-типы и другие не-сериализуемые объекты
    в чистые Python-типы, пригодные для JSON.
    """
    import numpy as np
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return [_json_safe(x) for x in obj.tolist()]
    if isinstance(obj, dict):
        return {str(k): _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_json_safe(x) for x in obj]
    # Последняя попытка
    return str(obj)

def _decode_bytes(file_bytes: bytes) -> str:
    """Пробует разные кодировки. Возвращает текст."""
    for enc in ("utf-8", "cp1251", "latin-1"):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="ignore")


def _deduplicate_curves(las) -> None:
    """
    Переименовывает дублирующиеся мнемоники: GR → GR_1, GR → GR_2.
    Частая проблема в реальных LAS-файлах.
    """
    seen = {}
    for curve in las.curves:
        name = curve.mnemonic.upper().strip()
        if name in seen:
            seen[name] += 1
            curve.mnemonic = f"{curve.mnemonic}_{seen[name]}"
            logger.warning("Duplicate mnemonic '%s' renamed to '%s'", name, curve.mnemonic)
        else:
            seen[name] = 0


def _find_depth_mnemonic(las) -> Optional[str]:
    """Ищет в LAS кривую, похожую на глубину."""
    mnemonics_upper = [c.mnemonic.upper().strip() for c in las.curves]
    for candidate in DEPTH_MNEMONICS:
        if candidate in mnemonics_upper:
            idx = mnemonics_upper.index(candidate)
            return las.curves[idx].mnemonic
    return None


def _build_dataframe(las, depth_mnemonic: Optional[str]) -> pd.DataFrame:
    """
    Строит DataFrame с корректным индексом.
    По умолчанию lasio использует первую кривую. Если это не глубина —
    переставляем индекс на найденную depth_mnemonic.
    """
    df = las.df()  # lasio использует первую кривую как индекс

    # Если индекс уже совпадает с depth_mnemonic — отлично
    if depth_mnemonic and df.index.name and df.index.name.upper() == depth_mnemonic.upper():
        return df

    # Если depth_mnemonic есть среди колонок — переставляем
    if depth_mnemonic and depth_mnemonic in df.columns:
        logger.info("Re-setting index to '%s'", depth_mnemonic)
        return df.set_index(depth_mnemonic)

    # Не нашли — возвращаем как есть
    return df


def parse_las(file_bytes: bytes, filename: str) -> dict:
    t0 = time.perf_counter()
    logger.info("Parsing LAS '%s' (%d bytes)", filename, len(file_bytes))

    # 1. Декодируем в текст
    try:
        text = _decode_bytes(file_bytes)
    except Exception as e:
        logger.exception("Failed to decode '%s'", filename)
        raise LasParseError(f"Failed to decode file: {e}")

    # 2. Парсим через lasio
    try:
        las = lasio.read(io.StringIO(text))
    except Exception as e:
        logger.exception("lasio failed to parse '%s'", filename)
        raise LasParseError(f"Failed to parse LAS: {e}")

    if not las.curves:
        raise LasParseError("LAS file has no curves section (~C)")

    # 3. Дедупликация мнемоник
    _deduplicate_curves(las)

    # 4. Определяем глубину
    depth_mnemonic = _find_depth_mnemonic(las)
    logger.info(
        "Depth mnemonic detected: %s (first 5 curves: %s)",
        depth_mnemonic,
        [c.mnemonic for c in las.curves][:5],
    )

    # 5. Строим DataFrame
    try:
        df = _build_dataframe(las, depth_mnemonic)
    except Exception as e:
        logger.exception("Building DataFrame failed for '%s'", filename)
        raise LasParseError(f"Failed to build DataFrame: {e}")

    if df.empty:
        raise LasParseError("LAS file contains no data rows (empty ~A section)")

    actual_depth_name = df.index.name or depth_mnemonic or "DEPT"

    # 6. Глубина должна быть числовой
    try:
        depth_values = np.asarray(df.index, dtype=float)
    except (ValueError, TypeError) as e:
        raise LasParseError(
            f"Depth curve '{actual_depth_name}' is not numeric: {e}"
        )

    if np.all(np.isnan(depth_values)):
        raise LasParseError(
            f"Depth curve '{actual_depth_name}' contains only NaN"
        )

    # 7. Метаданные кривых
    curves = [
        {
            "mnemonic": str(c.mnemonic),
            "unit": str(c.unit or "").strip(),
            "description": str(c.descr or "").strip(),
        }
        for c in las.curves
    ]

    metadata = {
        "filename": filename,
        "well_name": _safe_str(las.well.WELL.value) if "WELL" in las.well else None,
        "start_depth": float(df.index[0]),
        "stop_depth": float(df.index[-1]),
        "step": float(df.index[1] - df.index[0]) if len(df.index) > 1 else None,
        "num_samples": int(len(df)),
        "depth_mnemonic": actual_depth_name,
        "curves": curves,
    }

    logger.info(
        "Parsed '%s': depth='%s', %d samples, %d curves, %.1f ms",
        filename, actual_depth_name, len(df), len(curves),
        (time.perf_counter() - t0) * 1000,
    )

    # Финальная страховка: рекурсивно превращаем numpy-типы в Python
    metadata = _json_safe(metadata)
    return {"df": df, "metadata": metadata, "curves": curves}