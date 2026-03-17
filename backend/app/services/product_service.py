from sqlalchemy import select
from app.models.product import Product, PriceHistory
from app.core.database import AsyncSessionLocal
from datetime import datetime


async def upsert_product(data: dict) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Product).where(
                Product.supplier_name == data["supplier_name"],
                Product.sku == data["sku"],
            )
        )
        product = result.scalar_one_or_none()

        if product:
            old_price = product.price
            for key, value in data.items():
                setattr(product, key, value)
            product.last_scraped_at = datetime.utcnow()

            if old_price != data.get("price"):
                db.add(PriceHistory(product_id=product.id, price=old_price))
        else:
            product = Product(**data)
            db.add(product)

        await db.commit()
