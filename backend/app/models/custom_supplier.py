from sqlalchemy import String, Integer, DateTime, func, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
import uuid


class CustomSupplier(Base):
    __tablename__ = "custom_suppliers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)  # email
    url: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str] = mapped_column(String(200), nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)

    # pending | scraping | scraped | failed
    scrape_status: Mapped[str] = mapped_column(String(20), default="pending")
    scrape_error: Mapped[str | None] = mapped_column(Text)
    scrape_strategy: Mapped[str | None] = mapped_column(String(30))
    products_found: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_scraped_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
