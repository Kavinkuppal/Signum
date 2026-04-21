from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, text, Float, case
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.product import Product
from app.schemas.product import ProductOut, ProductsResponse, ComparisonGroup, ComparisonResponse
from typing import Optional

router = APIRouter()


@router.get("", response_model=ProductsResponse)
async def list_products(
    search: Optional[str] = Query(None),
    material_category: Optional[str] = Query(None),
    supplier: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    in_stock: Optional[bool] = Query(None),
    brand: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    sort_by: str = Query("relevance", pattern="^(relevance|price_asc|price_desc|normalized_price_asc|normalized_price_desc|updated)$"),
    db: AsyncSession = Depends(get_db),
):
    q = select(Product)

    if search:
        for word in search.lower().split():
            term = f"%{word}%"
            q = q.where(
                or_(
                    func.lower(Product.title).like(term),
                    func.lower(Product.brand).like(term),
                    func.lower(Product.sku).like(term),
                    func.lower(Product.material_category).like(term),
                    func.lower(Product.supplier_name).like(term),
                )
            )
    if material_category:
        q = q.where(Product.material_category == material_category)
    if supplier:
        q = q.where(func.lower(Product.supplier_name) == supplier.lower())
    if min_price is not None:
        q = q.where(Product.price >= min_price)
    if max_price is not None:
        q = q.where(Product.price <= max_price)
    if in_stock is not None:
        q = q.where(Product.in_stock == in_stock)
    if brand:
        q = q.where(func.lower(Product.brand).like(f"%{brand.lower()}%"))

    # Sorting
    if sort_by == "price_asc":
        q = q.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        q = q.order_by(Product.price.desc())
    elif sort_by == "normalized_price_asc":
        q = q.order_by(Product.normalized_price.asc().nulls_last())
    elif sort_by == "normalized_price_desc":
        q = q.order_by(Product.normalized_price.desc().nulls_last())
    elif sort_by == "updated":
        q = q.order_by(Product.last_scraped_at.desc())
    else:
        q = q.order_by(Product.supplier_name, Product.title)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    products = result.scalars().all()

    return ProductsResponse(
        products=[ProductOut.model_validate(p) for p in products],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/compare", response_model=ComparisonResponse)
async def compare_products(
    search: str = Query(..., min_length=1),
    material_category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Search for products across all suppliers and group similar items for price comparison.
    Groups are formed by matching on material_category + brand (if available).
    Within each group, products are sorted by normalized_price ascending.
    """
    q = select(Product)
    for word in search.lower().split():
        term = f"%{word}%"
        q = q.where(
            or_(
                func.lower(Product.title).like(term),
                func.lower(Product.brand).like(term),
                func.lower(Product.sku).like(term),
                func.lower(Product.material_category).like(term),
            )
        )
    if material_category:
        q = q.where(Product.material_category == material_category)

    q = q.order_by(Product.material_category, Product.brand, Product.normalized_price.asc().nulls_last())
    result = await db.execute(q)
    products = result.scalars().all()

    # Group by (material_category, brand) for meaningful comparisons
    groups: dict[str, list[Product]] = {}
    ungrouped = []

    for p in products:
        if p.material_category and p.brand:
            key = f"{p.material_category}::{p.brand}"
        elif p.material_category:
            key = f"{p.material_category}::generic"
        else:
            ungrouped.append(p)
            continue
        groups.setdefault(key, []).append(p)

    # Only include groups that have products from multiple suppliers OR any group with results
    comparison_groups = []
    for key, items in groups.items():
        if not items:
            continue
        suppliers_in_group = {p.supplier_name for p in items}
        best = min(items, key=lambda p: p.normalized_price if p.normalized_price else float("inf"))
        worst = max(items, key=lambda p: p.normalized_price if p.normalized_price else 0)
        savings = None
        if best.normalized_price and worst.normalized_price and best.normalized_price < worst.normalized_price:
            savings = round(worst.normalized_price - best.normalized_price, 4)

        cat, brand = key.split("::", 1)
        comparison_groups.append(ComparisonGroup(
            group_key=key,
            category=cat,
            brand=brand if brand != "generic" else None,
            products=[ProductOut.model_validate(p) for p in items],
            supplier_count=len(suppliers_in_group),
            best_price=best.normalized_price,
            best_supplier=best.supplier_name,
            savings_per_unit=savings,
        ))

    # Sort groups: multi-supplier groups first (most useful for comparison), then by category
    comparison_groups.sort(key=lambda g: (-g.supplier_count, g.category or ""))

    return ComparisonResponse(
        groups=comparison_groups,
        total_products=len(products),
        query=search,
    )


@router.get("/autocomplete")
async def autocomplete_products(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    """Return deduplicated material name suggestions for autocomplete.
    Results are supplier-agnostic — just unique titles to help the user
    describe what they need. The BOM engine handles finding best prices."""
    term = f"%{q.lower()}%"
    # Fetch more than needed so we can deduplicate meaningfully
    query = (
        select(Product.title, Product.material_category)
        .where(
            or_(
                func.lower(Product.title).like(term),
                func.lower(Product.material_category).like(term),
                func.lower(Product.brand).like(term),
            )
        )
        .order_by(Product.title)
        .limit(100)
    )
    result = await db.execute(query)
    rows = result.all()

    # Deduplicate on the base product name, stripping variant suffixes (" — variant")
    seen: set[str] = set()
    suggestions: list[dict] = []
    for title, category in rows:
        base = title.split(" — ")[0].strip()
        key = base.lower()
        if key not in seen:
            seen.add(key)
            suggestions.append({"title": base, "category": category})
        if len(suggestions) >= limit:
            break

    return suggestions


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductOut.model_validate(product)
