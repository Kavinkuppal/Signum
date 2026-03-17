from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.supplier import SupplierConnection
from app.models.user import User
from app.schemas.supplier import SupplierConnectionOut, ConnectSupplierRequest
from app.services.scrape_service import start_supplier_connection
from app.services.job_tracker import get_job, JobStatus
from datetime import datetime, timezone

router = APIRouter()

VALID_SUPPLIERS = {"grimco", "fellers", "glantz"}
DEMO_USER_ID = "demo-user"


async def ensure_demo_user(db: AsyncSession) -> None:
    """Create the demo user if it doesn't exist."""
    result = await db.execute(select(User).where(User.id == DEMO_USER_ID))
    if not result.scalar_one_or_none():
        db.add(User(id=DEMO_USER_ID, email="demo@signum.app", name="Demo User"))
        await db.commit()


@router.post("/connect")
async def connect_supplier(
    req: ConnectSupplierRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if req.supplier_id not in VALID_SUPPLIERS:
        raise HTTPException(status_code=400, detail="Unknown supplier")

    await ensure_demo_user(db)

    result = await db.execute(
        select(SupplierConnection).where(
            SupplierConnection.user_id == DEMO_USER_ID,
            SupplierConnection.supplier_name == req.supplier_id,
        )
    )
    if not result.scalar_one_or_none():
        db.add(SupplierConnection(user_id=DEMO_USER_ID, supplier_name=req.supplier_id))
        await db.commit()

    background_tasks.add_task(start_supplier_connection, req.supplier_id)
    return {"status": "started", "supplier": req.supplier_id}


@router.get("/{supplier_id}/job-status")
async def get_job_status(supplier_id: str):
    if supplier_id not in VALID_SUPPLIERS:
        raise HTTPException(status_code=400, detail="Unknown supplier")

    job = get_job(supplier_id)
    if not job:
        return {
            "supplier_id": supplier_id,
            "status": "idle",
            "products_scraped": 0,
            "message": "No active job",
        }

    return {
        "supplier_id": supplier_id,
        "status": job.status,
        "products_scraped": job.products_scraped,
        "message": job.message,
        "started_at": job.started_at.isoformat(),
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "error": job.error,
    }


@router.get("/connections", response_model=list[SupplierConnectionOut])
async def get_connections(db: AsyncSession = Depends(get_db)):
    user_id = "demo-user"
    result = await db.execute(
        select(SupplierConnection).where(SupplierConnection.user_id == user_id)
    )
    return [SupplierConnectionOut.model_validate(c) for c in result.scalars().all()]


@router.post("/{supplier_id}/refresh")
async def refresh_supplier(
    supplier_id: str,
    background_tasks: BackgroundTasks,
):
    if supplier_id not in VALID_SUPPLIERS:
        raise HTTPException(status_code=400, detail="Unknown supplier")
    background_tasks.add_task(start_supplier_connection, supplier_id)
    return {"status": "started", "supplier": supplier_id}
