"""Request and response schemas for MiniBiz products and sales."""

from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


def _as_money(value: Decimal) -> Decimal:
    """Round money values to two decimal places."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# Positive monetary values with up to two decimal places.
Money = Annotated[
    Decimal,
    Field(gt=0, max_digits=10, decimal_places=2),
    AfterValidator(_as_money),
]

# MongoDB ObjectId represented as a 24-character hexadecimal string.
ObjectIdStr = Annotated[
    str,
    Field(pattern=r"^[0-9a-fA-F]{24}$"),
]


class APIModel(BaseModel):
    """Shared validation rules for API request and response models."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class ProductCreate(APIModel):
    """Data required to create a product."""

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="general", min_length=1, max_length=100)
    price: Money
    stock_quantity: int = Field(ge=0)


class ProductUpdate(APIModel):
    """Fields that can be changed on an existing product."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    price: Money | None = None
    stock_quantity: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> Self:
        """Allow omitted fields, but reject explicitly supplied null values."""
        for field_name in self.model_fields_set:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")

        return self


class ProductResponse(APIModel):
    """Product information returned by the API."""

    id: ObjectIdStr
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(max_length=2000)
    category: str = Field(min_length=1, max_length=100)
    price: Money
    stock_quantity: int = Field(ge=0)
    created_at: AwareDatetime


class SaleCreate(APIModel):
    """Data required to record a sale."""

    product_id: ObjectIdStr
    quantity: int = Field(gt=0)


class SaleResponse(APIModel):
    """Sale information returned by the API."""

    id: ObjectIdStr
    product_id: ObjectIdStr
    quantity: int = Field(gt=0)
    unit_price: Money
    total_amount: Money
    sale_date: AwareDatetime
