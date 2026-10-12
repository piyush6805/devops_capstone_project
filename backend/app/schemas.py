from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProductInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    sku: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    reorder_level: int = Field(default=5, ge=0, le=2147483647)

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value):
        return value.upper()


class ProductOut(ProductInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    quantity: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class MovementInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    delta: int = Field(ge=-2147483647, le=2147483647)
    kind: Literal["RECEIPT", "ISSUE", "ADJUSTMENT"]
    reason: str = Field(min_length=1, max_length=240)

    @model_validator(mode="after")
    def check_direction(self):
        if self.delta == 0 or (self.kind == "RECEIPT" and self.delta < 0) or (self.kind == "ISSUE" and self.delta > 0):
            raise ValueError("Receipt must be positive, issue negative, and adjustment nonzero")
        return self


class MovementOut(MovementInput):
    id: int
    product_id: int
    sku: str
    product_name: str
    created_at: datetime


class DashboardOut(BaseModel):
    product_count: int
    total_units: int
    inventory_value: Decimal
    low_stock_count: int
