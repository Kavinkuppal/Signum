from pydantic import BaseModel
from datetime import datetime


class SupplierConnectionOut(BaseModel):
    id: str
    supplier_name: str
    connected_at: datetime
    last_synced_at: datetime | None

    model_config = {"from_attributes": True}


class ConnectSupplierRequest(BaseModel):
    supplier_id: str
