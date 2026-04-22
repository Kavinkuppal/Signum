from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_current_user_id
from app.models.local_supplier import LocalSupplier, UserProfile
from app.schemas.local_supplier import UserProfileCreate, UserProfileOut, LocalSupplierOut
from app.services.geocoding import geocode_location, find_nearby_suppliers, compute_rank_score
from app.services.product_service import upsert_product
from app.scrapers.smart_scraper import smart_scrape_supplier
from datetime import datetime
from typing import List, Optional
import uuid
import asyncio

router = APIRouter()


# ── User profile (location + preferences) ─────────────────────────────────────

@router.get("/profile", response_model=Optional[UserProfileOut])
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    return UserProfileOut.model_validate(profile) if profile else None


@router.post("/profile", response_model=UserProfileOut)
async def upsert_profile(
    payload: UserProfileCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    # Resolve location to coordinates
    location_str = payload.zip_code or payload.city
    lat, lng = None, None
    if location_str:
        coords = await geocode_location(location_str)
        if coords:
            lat, lng = coords

    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    if profile:
        profile.zip_code = payload.zip_code
        profile.city = payload.city
        profile.lat = lat
        profile.lng = lng
        profile.search_radius_km = payload.search_radius_km
        profile.priority = payload.priority
        profile.material_interests = payload.material_interests
        profile.updated_at = datetime.utcnow()
    else:
        profile = UserProfile(
            id=str(uuid.uuid4()),
            user_id=user_id,
            zip_code=payload.zip_code,
            city=payload.city,
            lat=lat,
            lng=lng,
            search_radius_km=payload.search_radius_km,
            priority=payload.priority,
            material_interests=payload.material_interests,
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return UserProfileOut.model_validate(profile)


# ── Discovery ─────────────────────────────────────────────────────────────────

@router.post("/discover")
async def discover_local_suppliers(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    use_ai: bool = False,
):
    """
    Kick off OSM-based business discovery + smart scraping for the user's
    saved location. Runs as a background task; poll GET /local-suppliers for
    progress.
    """
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    if not profile or not profile.lat:
        raise HTTPException(
            status_code=400,
            detail="Save your location in Settings → Location Profile first.",
        )

    background_tasks.add_task(
        _run_discovery,
        user_id=user_id,
        lat=profile.lat,
        lng=profile.lng,
        radius_km=profile.search_radius_km,
        priority=profile.priority,
        material_interests=profile.material_interests or [],
        use_ai=use_ai,
    )
    return {"message": "Discovery started. Reload this page in a moment."}


async def _run_discovery(
    user_id: str,
    lat: float,
    lng: float,
    radius_km: float,
    priority: str,
    material_interests: list[str],
    use_ai: bool = False,
) -> None:
    """Background: query Overpass → create rows → smart-scrape each website."""
    businesses = await find_nearby_suppliers(lat, lng, radius_km)

    async with AsyncSessionLocal() as db:
        # Replace previous results for this user
        await db.execute(delete(LocalSupplier).where(LocalSupplier.user_id == user_id))
        await db.commit()

        for biz in businesses:
            rank = compute_rank_score(biz, priority, material_interests, radius_km)
            has_website = bool(biz.get("website"))
            db.add(LocalSupplier(
                id=str(uuid.uuid4()),
                user_id=user_id,
                osm_id=biz.get("osm_id"),
                osm_type=biz.get("osm_type"),
                name=biz["name"],
                address=biz.get("address"),
                phone=biz.get("phone"),
                website=biz.get("website"),
                lat=biz.get("lat"),
                lng=biz.get("lng"),
                distance_km=biz.get("distance_km"),
                osm_tags=biz.get("osm_tags"),
                material_categories=biz.get("material_categories"),
                scrape_status="pending" if has_website else "no_website",
                rank_score=rank,
            ))

        await db.commit()

    # Scrape each supplier that has a website (sequentially with rate limit)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(LocalSupplier.id, LocalSupplier.name, LocalSupplier.website).where(
                LocalSupplier.user_id == user_id,
                LocalSupplier.scrape_status == "pending",
                LocalSupplier.website.isnot(None),
            )
        )
        rows = result.all()

    for sup_id, sup_name, sup_website in rows:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(LocalSupplier)
                .where(LocalSupplier.id == sup_id)
                .values(scrape_status="scraping")
            )
            await db.commit()

            try:
                products, strategy = await smart_scrape_supplier(
                    website_url=sup_website,
                    supplier_name=sup_name,
                    db=db,
                    use_ai=use_ai,
                )
                if products:
                    for p in products:
                        await upsert_product(p)
                    await db.execute(
                        update(LocalSupplier)
                        .where(LocalSupplier.id == sup_id)
                        .values(
                            scrape_status="scraped",
                            products_found=len(products),
                            last_scraped_at=datetime.utcnow(),
                        )
                    )
                else:
                    await db.execute(
                        update(LocalSupplier)
                        .where(LocalSupplier.id == sup_id)
                        .values(
                            scrape_status="failed",
                            scrape_error=f"No products found via {strategy}",
                            last_scraped_at=datetime.utcnow(),
                        )
                    )
                await db.commit()
            except Exception as e:
                await db.execute(
                    update(LocalSupplier)
                    .where(LocalSupplier.id == sup_id)
                    .values(
                        scrape_status="failed",
                        scrape_error=str(e)[:500],
                        last_scraped_at=datetime.utcnow(),
                    )
                )
                await db.commit()

        await asyncio.sleep(2.0)  # be courteous between scrapes


# ── Discovery status (for progress UI) ───────────────────────────────────────

@router.get("/status")
async def discovery_status(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Returns live counts for the progress bar on the frontend."""
    from sqlalchemy import func, case

    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((LocalSupplier.scrape_status == "scraped", 1), else_=0)).label("scraped"),
            func.sum(case((LocalSupplier.scrape_status == "scraping", 1), else_=0)).label("scraping"),
            func.sum(case((LocalSupplier.scrape_status == "pending", 1), else_=0)).label("pending"),
            func.sum(case((LocalSupplier.scrape_status == "failed", 1), else_=0)).label("failed"),
            func.sum(case((LocalSupplier.scrape_status == "no_website", 1), else_=0)).label("no_website"),
        ).where(LocalSupplier.user_id == user_id)
    )
    row = result.one()
    total = row.total or 0
    scraped = int(row.scraped or 0)
    scraping = int(row.scraping or 0)
    pending = int(row.pending or 0)
    failed = int(row.failed or 0)
    no_website = int(row.no_website or 0)
    done = scraped + failed + no_website
    is_running = scraping > 0 or pending > 0

    return {
        "total": total,
        "scraped": scraped,
        "scraping": scraping,
        "pending": pending,
        "failed": failed,
        "no_website": no_website,
        "done": done,
        "is_running": is_running,
        "percent": round((done / total) * 100) if total > 0 else 0,
    }


# ── Listing ───────────────────────────────────────────────────────────────────

@router.get("", response_model=List[LocalSupplierOut])
async def list_local_suppliers(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(LocalSupplier)
        .where(LocalSupplier.user_id == user_id)
        .order_by(LocalSupplier.rank_score.desc().nulls_last())
    )
    return [LocalSupplierOut.model_validate(s) for s in result.scalars().all()]


# ── Manual re-scrape ──────────────────────────────────────────────────────────

@router.post("/{supplier_id}/scrape")
async def rescrape_supplier(
    supplier_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(LocalSupplier).where(
            LocalSupplier.id == supplier_id,
            LocalSupplier.user_id == user_id,
        )
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if not supplier.website:
        raise HTTPException(status_code=400, detail="No website to scrape")

    background_tasks.add_task(_rescrape_one, supplier_id=supplier_id)
    return {"message": "Scrape started"}


async def _rescrape_one(supplier_id: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(LocalSupplier.name, LocalSupplier.website)
            .where(LocalSupplier.id == supplier_id)
        )
        row = result.one_or_none()
        if not row:
            return
        sup_name, sup_website = row

        await db.execute(
            update(LocalSupplier).where(LocalSupplier.id == supplier_id).values(scrape_status="scraping")
        )
        await db.commit()

        try:
            products, strategy = await smart_scrape_supplier(
                website_url=sup_website,
                supplier_name=sup_name,
                db=db,
            )
            if products:
                for p in products:
                    await upsert_product(p)
                await db.execute(
                    update(LocalSupplier).where(LocalSupplier.id == supplier_id).values(
                        scrape_status="scraped",
                        products_found=len(products),
                        last_scraped_at=datetime.utcnow(),
                    )
                )
            else:
                await db.execute(
                    update(LocalSupplier).where(LocalSupplier.id == supplier_id).values(
                        scrape_status="failed",
                        scrape_error=f"No products via {strategy}",
                        last_scraped_at=datetime.utcnow(),
                    )
                )
        except Exception as e:
            await db.execute(
                update(LocalSupplier).where(LocalSupplier.id == supplier_id).values(
                    scrape_status="failed",
                    scrape_error=str(e)[:500],
                    last_scraped_at=datetime.utcnow(),
                )
            )
        await db.commit()
