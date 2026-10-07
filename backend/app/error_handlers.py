import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from .exceptions import PetroVizError

logger = logging.getLogger("petroviz")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(PetroVizError)
    async def petroviz_error_handler(request: Request, exc: PetroVizError):
        logger.warning(
            "PetroVizError on %s %s: %s",
            request.method, request.url.path, exc.detail,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.__class__.__name__,
                "detail": exc.detail,
                "path": request.url.path,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        logger.info("Validation error on %s: %s", request.url.path, exc.errors())
        return JSONResponse(
            status_code=422,
            content={
                "error": "ValidationError",
                "detail": exc.errors(),
                "path": request.url.path,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "detail": "Something went wrong. Please check server logs.",
                "path": request.url.path,
            },
        )