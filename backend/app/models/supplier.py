from sqlalchemy import String, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import uuid


class SupplierConnection(Base):
    __tablename__ = "supplier_connections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String, nullable=False)
    session_data: Mapped[str | None] = mapped_column(Text)  # encrypted
    connected_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_synced_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="connections")
