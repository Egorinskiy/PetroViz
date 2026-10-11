from .logging_config import setup_logging

setup_logging()

import logging
from enum import Enum
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from .error_handlers import register_error_handlers
from .exceptions import (WellNotFoundError)
from .services.las_service import parse_las
from .services.validation import validate_las_upload
from .services.well_query import query_well_data
from .settings import settings
from contextlib import asynccontextmanager
from uuid import UUID
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .auth.dependencies import get_current_user
from .db.models import User

from .db.session import engine, get_session
from .db import models  # noqa: F401
from .repositories.well_repository import (
    WellRepository,
    ensure_system_user,
)
from .api.auth import router as auth_router

logger = logging.getLogger("petroviz")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Проверяем, что БД отвечает
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("Database connection verified")

    yield

    await engine.dispose()
    logger.info("Database connection closed")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

# Роутеры
app.include_router(auth_router, prefix="/api")


class DownsampleMode(str, Enum):
    FIXED = "fixed"
    ADAPTIVE = "adaptive"
    PIXEL = "pixel"


@app.post("/api/wells/upload")
async def upload_las(
        file: UploadFile = File(...),
        session: AsyncSession = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    content = await file.read()
    validate_las_upload(file.filename, content)

    logger.info(
        "Upload received: %s (%d bytes) from %s",
        file.filename, len(content), current_user.username,
    )
    well_data = parse_las(content, file.filename)

    repo = WellRepository(session)
    well = await repo.add(
        owner_id=current_user.id,
        filename=file.filename,
        metadata=well_data["metadata"],
        df=well_data["df"],
    )

    return {
        "well_id": str(well.id),
        "metadata": well_data["metadata"],
    }


@app.get("/api/wells/{well_id}")
async def get_well_info(
        well_id: UUID,
        session: AsyncSession = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    repo = WellRepository(session)
    metadata = await repo.get_metadata(well_id, owner_id=current_user.id)
    if metadata is None:
        # Не раскрываем, что скважина существует — возвращаем 404
        raise WellNotFoundError(f"Well '{well_id}' not found")
    return metadata


@app.get("/api/wells/{well_id}/data")
async def get_well_data(
        well_id: UUID,
        curves: str | None = None,
        start_depth: float | None = None,
        stop_depth: float | None = None,
        mode: DownsampleMode = DownsampleMode.FIXED,
        max_points: int | None = None,
        pixel_width: int | None = None,
        session: AsyncSession = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    repo = WellRepository(session)
    result = await repo.get(well_id, owner_id=current_user.id)
    if result is None:
        raise WellNotFoundError(f"Well '{well_id}' not found")

    _, df = result

    return query_well_data(
        df,
        curves=curves,
        start_depth=start_depth,
        stop_depth=stop_depth,
        mode=mode.value,
        max_points=max_points,
        pixel_width=pixel_width,
    )

@app.get("/api/wells")
async def list_my_wells(
        session: AsyncSession = Depends(get_session),
        current_user: User = Depends(get_current_user),
):
    """Список скважин текущего пользователя."""
    repo = WellRepository(session)
    return await repo.list_for_user(current_user.id)