
"""MiniBiz API entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.database import (
    close_mongo_connection,
    connect_to_mongo,
    get_database,
)
from app.routers.products import router as products_router
from app.routers.sales import router as sales_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage the MongoDB connection during startup and shutdown."""
    await connect_to_mongo()

    try:
        yield
    finally:
        await close_mongo_connection()


app = FastAPI(
    title="MiniBiz API",
    description="Business management and inventory tracking API.",
    version="1.0.0",
    lifespan=lifespan,
)

# The Vite app runs on another local port, so the browser requires these headers.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the product and sales endpoints.
app.include_router(products_router)
app.include_router(sales_router)


@app.get("/", tags=["health"])
async def read_root() -> dict[str, str]:
    """Confirm that the API is running."""
    return {
        "message": "Welcome to the MiniBiz API",
        "status": "running",
    }


@app.get("/health", tags=["health"])
async def health_check() -> JSONResponse:
    """Check whether the API and MongoDB are available."""
    try:
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
