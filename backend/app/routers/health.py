"""Health check route for the MiniBiz API."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.database import get_database

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> JSONResponse:
    """Report whether the API is running and MongoDB answers a ping."""
    try:
        # Uses the client opened at startup. This route does not create another client.
        await get_database().command("ping")
    except (RuntimeError, PyMongoError):
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "api": "running",
                "database": "disconnected",
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "api": "running",
            "database": "connected",
        },
    )
