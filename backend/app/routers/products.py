


import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from bson import ObjectId
from bson.decimal128 import Decimal128
from fastapi import APIRouter, HTTPException, Query, Response, status
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from app.database import get_database
from app.models import PRODUCTS_COLLECTION, ProductDocument
from app.schemas import ProductCreate, ProductResponse, ProductUpdate


router = APIRouter(prefix="/products", tags=["products"])

DEFAULT_CATEGORY = "general"
_OBJECT_ID = re.compile(r"^[0-9a-fA-F]{24}$")


def _parse_product_id(product_id: str) -> ObjectId:
    """Convert a URL ID to ObjectId or reject an invalid ID."""
    if _OBJECT_ID.fullmatch(product_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid product id.",
        )

    return ObjectId(product_id)


def _products() -> Any:
    """Return the products collection."""
    try:
        return get_database()[PRODUCTS_COLLECTION]
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None


def _to_decimal128(value: Decimal) -> Decimal128:
    """Convert a Python Decimal to MongoDB Decimal128."""
    return Decimal128(value)


def _to_decimal(value: Decimal128) -> Decimal:
    """Convert MongoDB Decimal128 to a Python Decimal."""
    return value.to_decimal()


def _aware_utc(value: datetime) -> datetime:
    """Ensure a datetime is timezone-aware."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def _to_response(document: dict[str, Any]) -> dict[str, Any]:
    """Convert a MongoDB product into a validated API response."""
    product = ProductResponse(
        id=str(document["_id"]),
        name=document["name"],
        description=document.get("description", ""),
        category=document.get("category") or DEFAULT_CATEGORY,
        price=_to_decimal(document["price"]),
        stock_quantity=document["stock_quantity"],
        created_at=_aware_utc(document["created_at"]),
    )

    return product.model_dump(mode="json")


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(payload: ProductCreate) -> dict[str, Any]:
    """Create a product and return the saved product."""
    document: ProductDocument = {
        "name": payload.name,
        "description": payload.description,
        "category": payload.category,
        "price": _to_decimal128(payload.price),
        "stock_quantity": payload.stock_quantity,
        "created_at": datetime.now(timezone.utc),
    }

    collection = _products()

    try:
        result = await collection.insert_one(document)
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None

    document["_id"] = result.inserted_id

    return _to_response(document)


@router.get("", response_model=list[ProductResponse])
async def list_products(
    search: str | None = Query(
        default=None,
        min_length=1,
        max_length=200,
    ),
    category: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
    ),
    max_stock: int | None = Query(
        default=None,
        ge=0,
    ),
) -> list[dict[str, Any]]:
    """List products with optional search and filters."""
    collection = _products()

    # Start with an empty MongoDB query.
    query: dict[str, Any] = {}

    # Search product names without case sensitivity.
    if search and search.strip():
        query["name"] = {
            "$regex": re.escape(search.strip()),
            "$options": "i",
        }

    # Filter by an exact category name, ignoring letter case.
    if category and category.strip():
        query["category"] = {
            "$regex": f"^{re.escape(category.strip())}$",
            "$options": "i",
        }

    # Return products with stock at or below the specified limit.
    if max_stock is not None:
        query["stock_quantity"] = {"$lte": max_stock}

    try:
        cursor = collection.find(query).sort("created_at", -1)
        documents = [document async for document in cursor]
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None

    return [_to_response(document) for document in documents]


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str) -> dict[str, Any]:
    """Return a single product by its ID."""
    object_id = _parse_product_id(product_id)
    collection = _products()

    try:
        document = await collection.find_one({"_id": object_id})
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    return _to_response(document)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
) -> dict[str, Any]:
    """Update supplied product fields and return the updated product."""
    object_id = _parse_product_id(product_id)
    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No product fields were provided.",
        )

    if "price" in changes:
        changes["price"] = _to_decimal128(changes["price"])

    collection = _products()

    try:
        document = await collection.find_one_and_update(
            {"_id": object_id},
            {"$set": changes},
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    return _to_response(document)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_product(product_id: str) -> Response:
    """Delete a product by its ID."""
    object_id = _parse_product_id(product_id)
    collection = _products()

    try:
        result = await collection.delete_one({"_id": object_id})
    except PyMongoError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The database is unavailable.",
        ) from None

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)