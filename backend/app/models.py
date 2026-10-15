"""MongoDB document shapes for MiniBiz products and sales.

These describe records stored in the database. Request and response
validation stays in schemas.py.
"""

from datetime import datetime
from typing import NotRequired, TypedDict

from bson import ObjectId
from bson.decimal128 import Decimal128

# Collection names used when a later file calls get_database()[name].
PRODUCTS_COLLECTION = "products"
SALES_COLLECTION = "sales"


class ProductDocument(TypedDict):
    """One product stored in the products collection."""

    # Absent until MongoDB assigns an id on insert.
    _id: NotRequired[ObjectId]
    name: str
    description: str
    category: str
    # BSON Decimal128, so 3.50 stays exact. The API schema uses Decimal.
    price: Decimal128
    stock_quantity: int
    # Timezone-aware UTC datetime.
    created_at: datetime


class SaleDocument(TypedDict):
    """One sale stored in the sales collection."""

    _id: NotRequired[ObjectId]
    # ObjectId of the product document, not the 24-character API string.
    product_id: ObjectId
    quantity: int
    unit_price: Decimal128
    total_amount: Decimal128
    # Timezone-aware UTC datetime.
    sale_date: datetime
