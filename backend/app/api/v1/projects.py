from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.project import Project, ProjectItem, InventoryEntry
from app.models.product import Product
from app.schemas.project import (
    ProjectCreate, ProjectOut, BOMResponse, BOMMatchResult,
    StageItemRequest, MarkPurchasedRequest, InventoryEntryOut
)
from app.schemas.product import ProductOut
from datetime import datetime, timezone
from typing import List

router = APIRouter()

# Category keywords used for last-resort BOM fallback matching
_CATEGORY_KEYWORDS = {
    "Vinyl": ["vinyl", "wrap", "film", "cast", "calendered", "adhesive"],
    "Aluminum": ["aluminum", "aluminium", "metal", "panel", "blank", "dibond", "alupanel"],
    "LED": ["led", "light", "module", "strip", "neon", "driver", "power supply", "transformer"],
    "Substrate": ["substrate", "sintra", "pvc", "foam board", "gatorboard"],
    "Coroplast": ["coroplast", "coro", "corrugated", "fluted"],
    "Laminate": ["laminate", "overlaminate", "overlam"],
    "Acrylic": ["acrylic", "plexiglass", "plexiglas"],
    "Ink": ["ink", "toner", "cartridge"],
    "Hardware": ["hardware", "standoff", "bracket", "screw", "fastener", "wire", "channel cap"],
    "Foam Board": ["foam board", "foam", "foamboard"],
    "Banner": ["banner", "mesh", "flag"],
}


async def _find_bom_products(db, material_name: str) -> list:
    """
    Search for products matching a material name with a 3-tier fallback:
    1. Full phrase match across title/category/brand
    2. Any individual word from the phrase
    3. Inferred category match (e.g. 'transformer' → LED category)
    """
    async def _search(words: list[str]) -> list:
        q = select(Product).where(Product.in_stock == True)
        for word in words:
            term = f"%{word.lower()}%"
            q = q.where(or_(
                func.lower(Product.title).like(term),
                func.lower(Product.material_category).like(term),
                func.lower(Product.brand).like(term),
            ))
        q = q.order_by(Product.normalized_price.asc().nulls_last()).limit(5)
        return (await db.execute(q)).scalars().all()

    # Tier 1: all words together (AND)
    words = [w for w in material_name.lower().split() if len(w) > 2]
    if words:
        products = await _search(words)
        if products:
            return products

    # Tier 2: try each word individually, return first that gives results
    for word in words:
        products = await _search([word])
        if products:
            return products

    # Tier 3: infer category from the material name, return anything in that category
    name_lower = material_name.lower()
    for category, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in name_lower for kw in keywords):
            q = (
                select(Product)
                .where(Product.in_stock == True, Product.material_category == category)
                .order_by(Product.normalized_price.asc().nulls_last())
                .limit(5)
            )
            products = (await db.execute(q)).scalars().all()
            if products:
                return products

    return []


@router.get("", response_model=List[ProjectOut])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(Project).where(Project.user_id == user_id).order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    out = []
    for p in projects:
        items_result = await db.execute(select(ProjectItem).where(ProjectItem.project_id == p.id))
        items = items_result.scalars().all()
        item_outs = []
        for item in items:
            prod = None
            if item.selected_product_id:
                prod_result = await db.execute(select(Product).where(Product.id == item.selected_product_id))
                prod = prod_result.scalar_one_or_none()
            item_outs.append({
                "id": item.id, "material_name": item.material_name, "quantity": item.quantity,
                "unit": item.unit, "notes": item.notes,
                "selected_product": ProductOut.model_validate(prod) if prod else None,
                "staged": item.staged, "purchased": item.purchased,
                "purchased_at": item.purchased_at, "purchase_price": item.purchase_price,
            })
        out.append({"id": p.id, "name": p.name, "description": p.description, "created_at": p.created_at, "items": item_outs})
    return out


@router.post("", response_model=ProjectOut)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    project = Project(user_id=user_id, name=body.name, description=body.description)
    db.add(project)
    await db.flush()

    for item_data in body.items:
        item = ProjectItem(
            project_id=project.id,
            material_name=item_data.material_name,
            quantity=item_data.quantity,
            unit=item_data.unit,
            notes=item_data.notes,
        )
        db.add(item)

    await db.commit()
    return {"id": project.id, "name": project.name, "description": project.description, "created_at": project.created_at, "items": []}


@router.get("/{project_id}/bom", response_model=BOMResponse)
async def get_bom(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(ProjectItem).where(ProjectItem.project_id == project_id))
    items = result.scalars().all()

    if not items:
        raise HTTPException(status_code=404, detail="Project not found or has no items")

    matches = []
    total = 0.0

    for item in items:
        products = await _find_bom_products(db, item.material_name)
        best = products[0] if products else None
        alts = products[1:] if len(products) > 1 else []

        estimated = None
        if best:
            estimated = round(best.price * item.quantity, 2)
            total += estimated
            item.selected_product_id = best.id

        matches.append(BOMMatchResult(
            item_id=item.id,
            material_name=item.material_name,
            quantity=item.quantity,
            unit=item.unit,
            best_match=ProductOut.model_validate(best) if best else None,
            alternatives=[ProductOut.model_validate(p) for p in alts],
            estimated_price=estimated,
        ))

    await db.commit()
    return BOMResponse(project_id=project_id, matches=matches, total_estimated=round(total, 2))


@router.post("/{project_id}/items/{item_id}/stage")
async def stage_item(
    project_id: str, item_id: str, body: StageItemRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(ProjectItem).where(ProjectItem.id == item_id, ProjectItem.project_id == project_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.selected_product_id = body.product_id
    item.staged = True
    await db.commit()
    return {"status": "staged"}


@router.post("/{project_id}/items/{item_id}/unstage")
async def unstage_item(
    project_id: str, item_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(ProjectItem).where(ProjectItem.id == item_id, ProjectItem.project_id == project_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.staged = False
    await db.commit()
    return {"status": "unstaged"}


@router.post("/{project_id}/items/{item_id}/purchase")
async def mark_purchased(
    project_id: str, item_id: str, body: MarkPurchasedRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(ProjectItem).where(ProjectItem.id == item_id, ProjectItem.project_id == project_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    item.purchased = True
    item.purchased_at = datetime.now(timezone.utc)
    item.purchase_price = body.price

    prod = None
    if item.selected_product_id:
        prod_result = await db.execute(select(Product).where(Product.id == item.selected_product_id))
        prod = prod_result.scalar_one_or_none()

    entry = InventoryEntry(
        user_id=user_id,
        project_id=project_id,
        project_item_id=item.id,
        product_id=item.selected_product_id,
        material_name=item.material_name,
        supplier_name=prod.supplier_name if prod else None,
        quantity=item.quantity,
        unit=item.unit,
        unit_price=body.price or (prod.price if prod else None),
        total_price=round((body.price or (prod.price if prod else 0)) * item.quantity, 2),
        product_url=prod.product_url if prod else None,
    )
    db.add(entry)
    await db.commit()
    return {"status": "purchased"}


@router.delete("/{project_id}/items/{item_id}")
async def delete_project_item(
    project_id: str, item_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(ProjectItem).where(ProjectItem.id == item_id, ProjectItem.project_id == project_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()
    return {"status": "deleted"}


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    items_result = await db.execute(select(ProjectItem).where(ProjectItem.project_id == project_id))
    for item in items_result.scalars().all():
        await db.delete(item)
    await db.delete(project)
    await db.commit()
    return {"status": "deleted"}


@router.get("/inventory/ledger", response_model=List[InventoryEntryOut])
async def get_inventory(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(InventoryEntry).where(InventoryEntry.user_id == user_id).order_by(InventoryEntry.purchased_at.desc())
    )
    return [InventoryEntryOut.model_validate(e) for e in result.scalars().all()]


@router.delete("/inventory/ledger/{entry_id}")
async def delete_inventory_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(InventoryEntry).where(InventoryEntry.id == entry_id, InventoryEntry.user_id == user_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"status": "deleted"}
