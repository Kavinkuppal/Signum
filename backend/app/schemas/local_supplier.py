from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UserProfileCreate(BaseModel):
    zip_code: Optional[str] = None
    city: Optional[str] = None
    search_radius_km: float = 80.0
    priority: str = "price"  # price | speed | local
    material_interests: Optional[List[str]] = None


class UserProfileOut(BaseModel):
    id: str
    user_id: str
    zip_code: Optional[str]
    city: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    search_radius_km: float
    priority: str
    material_interests: Optional[List[str]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LocalSupplierOut(BaseModel):
    id: str
    name: str
    address: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    distance_km: Optional[float]
    material_categories: Optional[List[str]]
    scrape_status: str
    scrape_error: Optional[str]
    products_found: int
    last_scraped_at: Optional[datetime]
    rank_score: Optional[float]
    discovered_at: datetime
    osm_tags: Optional[dict]
    osm_id: Optional[str]
    osm_type: Optional[str]

    model_config = {"from_attributes": True}
