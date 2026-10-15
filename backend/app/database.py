
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import (
    ConfigurationError,
    ConnectionFailure,
    OperationFailure,
    PyMongoError,
)

from app.config import settings

_client: AsyncMongoClient | None = None


def get_database() -> AsyncDatabase:
    """Return the shared MiniBiz database."""
    if _client is None:
        raise RuntimeError("MongoDB is not connected.")

    return _client[settings.database_name]


async def connect_to_mongo() -> None:
    """Connect to MongoDB and verify the connection."""
    global _client

    if _client is not None:
        return

    client: AsyncMongoClient | None = None

    try:
        client = AsyncMongoClient(
            settings.mongodb_uri.get_secret_value(),
            serverSelectionTimeoutMS=5000,
        )

        await client[settings.database_name].command("ping")

    except PyMongoError as exc:
        message = _connection_failure_message(exc)

        if client is not None:
            try:
                await client.close()
            except PyMongoError:
                pass

        raise RuntimeError(message) from None

    _client = client


async def close_mongo_connection() -> None:
    """Close the shared MongoDB client."""
    global _client

    if _client is None:
        return

    client = _client
    _client = None

    await client.close()


def _connection_failure_message(exc: PyMongoError) -> str:
    """Return a helpful error without exposing database credentials."""
    if isinstance(exc, ConfigurationError):
        return "Invalid MongoDB configuration. Check MONGODB_URI."

    if isinstance(exc, OperationFailure):
        return (
            "MongoDB rejected the operation. Check your credentials "
            "and database permissions."
        )

    if isinstance(exc, ConnectionFailure):
        return (
            "Could not reach MongoDB. Check your network, "
            "Atlas Network Access settings, and cluster status."
        )

    return "Could not connect to MongoDB. Check your configuration."
