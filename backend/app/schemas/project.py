from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.product import ProductOut


class ProjectItemCreate(BaseModel):
    material_name: str
    quantity: float = 1.0
    unit: Optional[str] = None
    notes: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    items: List[ProjectItemCreate] = []


class BOMMatchResult(BaseModel):
    item_id: str
    material_name: str
    quantity: float
    unit: Optional[str]
    best_match: Optional[ProductOut]
    alternatives: List[ProductOut]
    estimated_price: Optional[float]


class BOMResponse(BaseModel):
    project_id: str
    matches: List[BOMMatchResult]
    total_estimated: float


class ProjectItemOut(BaseModel):
    id: str
    material_name: str
    quantity: float
    unit: Optional[str]
    notes: Optional[str]
    selected_product: Optional[ProductOut]
    staged: bool
    purchased: bool
    purchased_at: Optional[datetime]
    purchase_price: Optional[float]

    model_config = {"from_attributes": True}


class ProjectOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    items: List[ProjectItemOut] = []

    model_config = {"from_attributes": True}


class StageItemRequest(BaseModel):
    product_id: str


class MarkPurchasedRequest(BaseModel):
    price: Optional[float] = None


class InventoryEntryOut(BaseModel):
    id: str
    project_id: Optional[str]
    material_name: str
    supplier_name: Optional[str]
    quantity: float
    unit: Optional[str]
    unit_price: Optional[float]
    total_price: Optional[float]
    purchased_at: datetime
    product_url: Optional[str]

    model_config = {"from_attributes": True}
