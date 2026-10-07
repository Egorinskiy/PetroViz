import io
import time
import logging
import lasio
import numpy as np

from ..exceptions import LasParseError

logger = logging.getLogger("petroviz.las")


def parse_las(file_bytes: bytes, filename: str) -> dict:
    t0 = time.perf_counter()
    logger.info("Parsing LAS '%s' (%d bytes)", filename, len(file_bytes))

    try:
        text = file_bytes.decode("utf-8", errors="ignore")
        las = lasio.read(io.StringIO(text))
        df = las.df()
    except Exception as e:
        logger.exception("Failed to parse '%s'", filename)
        raise LasParseError(f"Failed to parse LAS: {e}")

    if df.empty:
        raise LasParseError("LAS file contains no data")

    curves = [
        {"mnemonic": c.mnemonic, "unit": c.unit or "", "description": c.descr or ""}
        for c in las.curves
    ]

    metadata = {
        "filename": filename,
        "well_name": las.well.WELL.value if "WELL" in las.well else None,
        "start_depth": float(df.index[0]),
        "stop_depth": float(df.index[-1]),
        "step": float(df.index[1] - df.index[0]) if len(df.index) > 1 else None,
        "num_samples": int(len(df)),
        "curves": curves,
    }

    logger.info(
        "Parsed '%s': %d samples, %d curves, %.1f ms",
        filename, len(df), len(curves), (time.perf_counter() - t0) * 1000,
    )
    return {"df": df, "metadata": metadata, "curves": curves}