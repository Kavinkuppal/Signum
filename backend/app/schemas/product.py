from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class ProductOut(BaseModel):
    id: str
    supplier_name: str
    sku: str
    title: str
    brand: Optional[str] = None
    material_category: Optional[str] = None
    dimensions_length: Optional[float] = None
    dimensions_width: Optional[float] = None
    dimensions_thickness: Optional[float] = None
    color: Optional[str] = None
    finish: Optional[str] = None
    price: float
    normalized_price: Optional[float] = None
    normalized_unit: Optional[str] = None
    pack_quantity: Optional[int] = None
    in_stock: bool
    lead_time_days: Optional[int] = None
    product_url: str
    image_url: Optional[str] = None
    description: Optional[str] = None
    last_scraped_at: datetime

    model_config = {"from_attributes": True}


class ProductsResponse(BaseModel):
    products: List[ProductOut]
    total: int
    page: int
    page_size: int


class ComparisonGroup(BaseModel):
    group_key: str
    category: Optional[str] = None
    brand: Optional[str] = None
    products: List[ProductOut]
    supplier_count: int
    best_price: Optional[float] = None
    best_supplier: Optional[str] = None
    savings_per_unit: Optional[float] = None


class ComparisonResponse(BaseModel):
    groups: List[ComparisonGroup]
    total_products: int
    query: str
