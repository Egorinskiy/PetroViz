from .logging_config import setup_logging
setup_logging()

import logging
from uuid import uuid4
from enum import Enum
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .error_handlers import register_error_handlers
from .exceptions import (WellNotFoundError)
from .services.las_service import parse_las
from .services.validation import validate_las_upload
from .storage import well_repository
from .services.well_query import query_well_data


logger = logging.getLogger("petroviz")

app = FastAPI(title="PetroViz API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

class DownsampleMode(str, Enum):
    FIXED = "fixed"
    ADAPTIVE = "adaptive"
    PIXEL = "pixel"

@app.post("/api/wells/upload")
async def upload_las(file: UploadFile = File(...)):
    content = await file.read()
    validate_las_upload(file.filename, content)

    logger.info("Upload received: %s (%d bytes)", file.filename, len(content))
    well_data = parse_las(content, file.filename)   # бросит LasParseError при сбое

    well_id = str(uuid4())
    well_repository.add(well_id, well_data)
    logger.info("Stored well_id=%s from '%s'", well_id, file.filename)
    return {"well_id": well_id, "metadata": well_data["metadata"]}


@app.get("/api/wells/{well_id}")
async def get_well_info(well_id: str):
    well = well_repository.get(well_id)
    if not well:
        raise WellNotFoundError(f"Well '{well_id}' not found")
    return well["metadata"]


@app.get("/api/wells/{well_id}/data")
async def get_well_data(
    well_id: str,
    curves: str | None = None,
    start_depth: float | None = None,
    stop_depth: float | None = None,
    mode: DownsampleMode = DownsampleMode.FIXED,
    max_points: int | None = None,
    pixel_width: int | None = None,
):
    well = well_repository.get(well_id)
    if not well:
        raise WellNotFoundError(f"Well '{well_id}' not found")

    return query_well_data(
        well["df"],
        curves=curves,
        start_depth=start_depth,
        stop_depth=stop_depth,
        mode=mode.value,
        max_points=max_points,
        pixel_width=pixel_width,
    )