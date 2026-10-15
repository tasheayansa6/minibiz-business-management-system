"""Sales routes for the MiniBiz API."""

import re
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from bson import ObjectId
from bson.decimal128 import Decimal128
from fastapi import APIRouter, HTTPException, status
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from app.database import get_database
from app.models import PRODUCTS_COLLECTION, SALES_COLLECTION, SaleDocument
from app.schemas import SaleCreate, SaleResponse

router = APIRouter(prefix="/sales", tags=["sales"])

_OBJECT_ID = re.compile(r"^[0-9a-fA-F]{24}$")


def _parse_product_id(product_id: str) -> ObjectId:
    """Convert a sale's product id into an ObjectId."""
    if _OBJECT_ID.fullmatch(product_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid product id.",
        )
    return ObjectId(product_id)


def _database() -> Any:
    """Return the shared database, or 503 when the client is not open."""
    try:
        return get_database()
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None


def _to_decimal128(value: Decimal) -> Decimal128:
    """Store a Python Decimal as MongoDB Decimal128."""
    return Decimal128(value)


def _to_decimal(value: Decimal128) -> Decimal:
    """Read a stored Decimal128 back into a Python Decimal."""
    return value.to_decimal()


def _aware_utc(value: datetime) -> datetime:
    """Make a stored datetime timezone-aware UTC for the response schema."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _to_response(document: dict[str, Any]) -> dict[str, Any]:
    """Validate a stored sale and return JSON-ready data."""
    sale = SaleResponse(
        id=str(document["_id"]),
        product_id=str(document["product_id"]),
        quantity=document["quantity"],
        unit_price=_to_decimal(document["unit_price"]),
        total_amount=_to_decimal(document["total_amount"]),
        sale_date=_aware_utc(document["sale_date"]),
    )
    return sale.model_dump(mode="json")


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(payload: SaleCreate) -> dict[str, Any]:
    """Sell stock and record the sale in one transaction."""
    object_id = _parse_product_id(payload.product_id)
    database = _database()
    products = database[PRODUCTS_COLLECTION]
    sales = database[SALES_COLLECTION]
    saved: dict[str, Any] | None = None

    try:
        async with database.client.start_session() as session:
            async with await session.start_transaction():
                # The filter keeps the stock check and the reduction in one write.
                product = await products.find_one_and_update(
                    {
                        "_id": object_id,
                        "stock_quantity": {"$gte": payload.quantity},
                    },
                    {"$inc": {"stock_quantity": -payload.quantity}},
                    return_document=ReturnDocument.BEFORE,
                    session=session,
                )
                if product is None:
                    existing = await products.find_one(
                        {"_id": object_id},
                        {"_id": 1},
                        session=session,
                    )
                    if existing is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Product not found.",
                        )
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Not enough stock to complete the sale.",
                    )

                unit_price = _to_decimal(product["price"])
                total_amount = (unit_price * payload.quantity).quantize(
                    Decimal("0.01"),
                    rounding=ROUND_HALF_UP,
                )
                document: SaleDocument = {
                    "product_id": object_id,
                    "quantity": payload.quantity,
                    "unit_price": _to_decimal128(unit_price),
                    "total_amount": _to_decimal128(total_amount),
                    "sale_date": datetime.now(timezone.utc),
                }
                result = await sales.insert_one(document, session=session)
                document["_id"] = result.inserted_id
                saved = document
    except HTTPException:
        raise
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None

    return _to_response(saved)


@router.get("", response_model=list[SaleResponse])
async def list_sales() -> list[dict[str, Any]]:
    """Return the sale history, newest first."""
    sales = _database()[SALES_COLLECTION]
    try:
        cursor = sales.find({}).sort("sale_date", -1)
        documents = [document async for document in cursor]
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None

    return [_to_response(document) for document in documents]
