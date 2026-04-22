from sqlalchemy import select
from app.models.product import Product, PriceHistory
from app.core.database import AsyncSessionLocal
from datetime import datetime


async def upsert_product(data: dict, user_id: str | None = None) -> None:
    # Strip user_id from data dict — it's passed as an explicit param to avoid duplicates
    data = {k: v for k, v in data.items() if k != "user_id"}
    """
    Insert or update a product. user_id=None means public (tier1).
    user_id=email means private to that user.
    Uniqueness key: (user_id, supplier_name, sku).
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Product).where(
                Product.user_id == user_id,
                Product.supplier_name == data["supplier_name"],
                Product.sku == data["sku"],
            )
        )
        product = result.scalar_one_or_none()

        if product:
            old_price = product.price
            for key, value in data.items():
                setattr(product, key, value)
            product.user_id = user_id
            product.last_scraped_at = datetime.utcnow()

            if old_price != data.get("price"):
                db.add(PriceHistory(product_id=product.id, price=old_price))
        else:
            product = Product(**data, user_id=user_id)
            db.add(product)

        await db.commit()
