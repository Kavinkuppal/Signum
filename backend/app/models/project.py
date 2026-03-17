from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, nullable=False, default="demo-user")
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items = relationship("ProjectItem", back_populates="project", cascade="all, delete-orphan")


class ProjectItem(Base):
    __tablename__ = "project_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    material_name: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    unit: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)
    # Selected product (after BOM matching)
    selected_product_id: Mapped[str | None] = mapped_column(String, ForeignKey("products.id"))
    # Staging status
    staged: Mapped[bool] = mapped_column(Boolean, default=False)
    purchased: Mapped[bool] = mapped_column(Boolean, default=False)
    purchased_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    purchase_price: Mapped[float | None] = mapped_column(Float)

    project = relationship("Project", back_populates="items")
    selected_product = relationship("Product")


class InventoryEntry(Base):
    __tablename__ = "inventory_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, nullable=False, default="demo-user")
    project_id: Mapped[str | None] = mapped_column(String, ForeignKey("projects.id"))
    project_item_id: Mapped[str | None] = mapped_column(String, ForeignKey("project_items.id"))
    product_id: Mapped[str | None] = mapped_column(String, ForeignKey("products.id"))
    material_name: Mapped[str] = mapped_column(String, nullable=False)
    supplier_name: Mapped[str | None] = mapped_column(String)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    unit: Mapped[str | None] = mapped_column(String)
    unit_price: Mapped[float | None] = mapped_column(Float)
    total_price: Mapped[float | None] = mapped_column(Float)
    purchased_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    product_url: Mapped[str | None] = mapped_column(Text)

    project = relationship("Project")
    product = relationship("Product")
