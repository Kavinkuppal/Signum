from app.services.job_tracker import create_job, update_job, JobStatus
from datetime import datetime

TIER1_SUPPLIERS = {"blue_ridge", "mclogan", "uscutter"}
TIER2_SUPPLIERS = {"grimco", "fellers", "glantz"}  # Not MVP


async def run_tier1_scraper(supplier_id: str) -> None:
    """Run a single Tier 1 (public) scraper."""
    job = create_job(supplier_id)
    try:
        if supplier_id == "blue_ridge":
            from app.scrapers.blue_ridge import BlueRidgeScraper
            await BlueRidgeScraper().run()
        elif supplier_id == "mclogan":
            from app.scrapers.mclogan import McLoganScraper
            await McLoganScraper().run()
        elif supplier_id == "uscutter":
            from app.scrapers.uscutter import USCutterScraper
            await USCutterScraper().run()
        else:
            update_job(supplier_id, status=JobStatus.ERROR, error=f"Unknown Tier 1 supplier: {supplier_id}")
    except Exception as e:
        update_job(supplier_id, status=JobStatus.ERROR, error=str(e), finished_at=datetime.utcnow())
        raise


async def run_all_tier1() -> None:
    """Run all Tier 1 scrapers sequentially."""
    import asyncio
    for supplier_id in TIER1_SUPPLIERS:
        try:
            await run_tier1_scraper(supplier_id)
            await asyncio.sleep(2)  # pause between suppliers
        except Exception as e:
            print(f"[Tier1] Scraper failed for {supplier_id}: {e}")


# Legacy — Tier 2 (not MVP, kept for future)
async def start_supplier_connection(supplier_id: str) -> None:
    create_job(supplier_id)
    update_job(supplier_id, status=JobStatus.ERROR, error="Tier 2 not yet implemented.")
