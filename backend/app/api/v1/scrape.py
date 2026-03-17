from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.services.scrape_service import run_tier1_scraper, run_all_tier1, TIER1_SUPPLIERS
from app.services.job_tracker import get_job

router = APIRouter()


@router.post("/run/{supplier_id}")
async def trigger_scrape(supplier_id: str, background_tasks: BackgroundTasks):
    """Manually trigger a Tier 1 scrape for a specific supplier."""
    if supplier_id not in TIER1_SUPPLIERS and supplier_id != "all":
        raise HTTPException(status_code=400, detail=f"Unknown Tier 1 supplier: {supplier_id}. Valid: {TIER1_SUPPLIERS}")

    if supplier_id == "all":
        background_tasks.add_task(run_all_tier1)
        return {"status": "started", "suppliers": list(TIER1_SUPPLIERS)}

    background_tasks.add_task(run_tier1_scraper, supplier_id)
    return {"status": "started", "supplier": supplier_id}


@router.get("/status/{supplier_id}")
async def scrape_status(supplier_id: str):
    """Get current scrape job status for a supplier."""
    job = get_job(supplier_id)
    if not job:
        return {"supplier_id": supplier_id, "status": "idle", "products_scraped": 0, "message": "No active job"}
    return {
        "supplier_id": supplier_id,
        "status": job.status,
        "products_scraped": job.products_scraped,
        "message": job.message,
        "started_at": job.started_at.isoformat(),
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "error": job.error,
    }


@router.get("/status")
async def all_scrape_status():
    """Get status for all Tier 1 suppliers."""
    result = {}
    for sid in TIER1_SUPPLIERS:
        job = get_job(sid)
        result[sid] = {
            "status": job.status if job else "idle",
            "products_scraped": job.products_scraped if job else 0,
            "message": job.message if job else "No active job",
            "finished_at": job.finished_at.isoformat() if job and job.finished_at else None,
        }
    return result
