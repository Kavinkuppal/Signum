from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_current_user_id
from app.models.custom_supplier import CustomSupplier
from app.models.product import Product
from app.scrapers.url_scraper import scrape_url
from app.services.product_service import upsert_product
from pydantic import BaseModel
from datetime import datetime
from urllib.parse import urlparse
import uuid

router = APIRouter()


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower().lstrip("www.")


def _name_from_url(url: str) -> str:
    domain = _domain(url)
    return domain.split(".")[0].replace("-", " ").replace("_", " ").title()


class AddSupplierRequest(BaseModel):
    url: str
    name: str | None = None  # optional override; defaults to domain


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("")
async def list_custom_suppliers(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(CustomSupplier)
        .where(CustomSupplier.user_id == user_id)
        .order_by(CustomSupplier.created_at.desc())
    )
    suppliers = result.scalars().all()
    return [
        {
            "id": s.id,
            "url": s.url,
            "domain": s.domain,
            "name": s.name,
            "scrape_status": s.scrape_status,
            "scrape_error": s.scrape_error,
            "scrape_strategy": s.scrape_strategy,
            "products_found": s.products_found,
            "created_at": s.created_at,
            "last_scraped_at": s.last_scraped_at,
        }
        for s in suppliers
    ]


@router.post("")
async def add_custom_supplier(
    body: AddSupplierRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    domain = _domain(url)
    name = body.name or _name_from_url(url)

    # Check for duplicate for this user
    existing = await db.execute(
        select(CustomSupplier).where(
            CustomSupplier.user_id == user_id,
            CustomSupplier.domain == domain,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already have this supplier. Use re-scrape to refresh it.")

    supplier = CustomSupplier(
        id=str(uuid.uuid4()),
        user_id=user_id,
        url=url,
        domain=domain,
        name=name,
        scrape_status="pending",
    )
    db.add(supplier)
    await db.commit()

    background_tasks.add_task(_run_scrape, supplier_id=supplier.id, user_id=user_id, url=url, name=name)
    return {"id": supplier.id, "name": name, "message": "Scrape started"}


@router.delete("/{supplier_id}")
async def delete_custom_supplier(
    supplier_id: str,
    user_id: str = Depends(get_current_user_id),
):
    from sqlalchemy import text
    from app.core.database import engine

    async with engine.begin() as conn:
        # Verify ownership and get name
        row = await conn.execute(
            text("SELECT name FROM custom_suppliers WHERE id = :id AND user_id = :uid"),
            {"id": supplier_id, "uid": user_id},
        )
        supplier_row = row.fetchone()
        if not supplier_row:
            raise HTTPException(status_code=404, detail="Supplier not found")
        supplier_name = supplier_row[0]

        # Cascade: delete child rows before products to avoid FK violations
        await conn.execute(
            text("""
                DELETE FROM volume_pricing
                WHERE product_id IN (
                    SELECT id FROM products WHERE user_id = :uid AND supplier_name = :name
                )
            """),
            {"uid": user_id, "name": supplier_name},
        )
        await conn.execute(
            text("""
                DELETE FROM price_history
                WHERE product_id IN (
                    SELECT id FROM products WHERE user_id = :uid AND supplier_name = :name
                )
            """),
            {"uid": user_id, "name": supplier_name},
        )
        r2 = await conn.execute(
            text("DELETE FROM products WHERE user_id = :uid AND supplier_name = :name"),
            {"uid": user_id, "name": supplier_name},
        )
        await conn.execute(
            text("DELETE FROM custom_suppliers WHERE id = :id"),
            {"id": supplier_id},
        )
    # engine.begin() auto-commits here

    return {"deleted_products": r2.rowcount, "message": f"Deleted {supplier_name}"}


@router.post("/{supplier_id}/rescrape")
async def rescrape_custom_supplier(
    supplier_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(CustomSupplier).where(
            CustomSupplier.id == supplier_id,
            CustomSupplier.user_id == user_id,
        )
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    background_tasks.add_task(_run_scrape, supplier_id=supplier_id, user_id=user_id, url=supplier.url, name=supplier.name)
    return {"message": "Re-scrape started"}


# ── Background scrape ─────────────────────────────────────────────────────────

async def _run_scrape(supplier_id: str, user_id: str, url: str, name: str) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(CustomSupplier)
            .where(CustomSupplier.id == supplier_id)
            .values(scrape_status="scraping", scrape_error=None, last_scraped_at=datetime.utcnow())
        )
        await db.commit()

    try:
        products, strategy = await scrape_url(url=url, supplier_name=name, user_id=user_id)

        if products:
            for p in products:
                await upsert_product(p, user_id=user_id)

        async with AsyncSessionLocal() as db:
            if products:
                await db.execute(
                    update(CustomSupplier)
                    .where(CustomSupplier.id == supplier_id)
                    .values(
                        scrape_status="scraped",
                        scrape_strategy=strategy,
                        products_found=len(products),
                        last_scraped_at=datetime.utcnow(),
                        scrape_error=None,
                    )
                )
            else:
                await db.execute(
                    update(CustomSupplier)
                    .where(CustomSupplier.id == supplier_id)
                    .values(
                        scrape_status="failed",
                        scrape_strategy=strategy,
                        scrape_error="No products found. The site may require login or use a format we can't parse.",
                        last_scraped_at=datetime.utcnow(),
                    )
                )
            await db.commit()

    except Exception as e:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(CustomSupplier)
                .where(CustomSupplier.id == supplier_id)
                .values(
                    scrape_status="failed",
                    scrape_error=str(e)[:500],
                    last_scraped_at=datetime.utcnow(),
                )
            )
            await db.commit()
