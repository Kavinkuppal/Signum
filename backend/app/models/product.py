from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String, index=True)  # NULL = public tier1; email = user-specific
    supplier_name: Mapped[str] = mapped_column(String, nullable=False)
    sku: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    brand: Mapped[str | None] = mapped_column(String)
    material_category: Mapped[str | None] = mapped_column(String)
    dimensions_length: Mapped[float | None] = mapped_column(Float)
    dimensions_width: Mapped[float | None] = mapped_column(Float)
    dimensions_thickness: Mapped[float | None] = mapped_column(Float)
    color: Mapped[str | None] = mapped_column(String)
    finish: Mapped[str | None] = mapped_column(String)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    normalized_price: Mapped[float | None] = mapped_column(Float)
    normalized_unit: Mapped[str | None] = mapped_column(String)
    pack_quantity: Mapped[int | None] = mapped_column(Integer)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    product_url: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    last_scraped_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    volume_pricing = relationship("VolumePricing", back_populates="product", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="product", cascade="all, delete-orphan")


class VolumePricing(Base):
    __tablename__ = "volume_pricing"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String, ForeignKey("products.id"), nullable=False)
    min_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)

    product = relationship("Product", back_populates="volume_pricing")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(String, ForeignKey("products.id"), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="price_history")
