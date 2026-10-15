
"""MiniBiz API entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
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


class HealthResponse(BaseModel):
    """API and database status returned by the health check."""

    status: str = Field(examples=["ok"])
    api: str = Field(examples=["running"])
    database: str = Field(examples=["connected"])


app = FastAPI(
    title="MiniBiz API",
    description=(
        "Business management and inventory tracking API. "
        "Interactive Swagger documentation is served at /docs."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {"name": "health", "description": "API process and database availability."},
        {"name": "products", "description": "Create, update, search, and delete inventory."},
        {"name": "sales", "description": "Record a sale and reduce product stock."},
    ],
)

# Local Vite uses another port. The deployed page is a separate https address.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://minibiz-app.onrender.com"],
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
        "docs": "/docs",
    }


@app.get(
    "/health",
    tags=["health"],
    response_model=HealthResponse,
    responses={
        503: {
            "model": HealthResponse,
            "description": "The API is running, but MongoDB did not answer.",
        }
    },
)
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
