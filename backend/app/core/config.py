from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://signum:signum@localhost:5432/signum"
    SECRET_KEY: str = "change-me-in-production"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "https://signum-sage.vercel.app"]
    ENCRYPTION_KEY: str = "change-me-32-byte-key-here!!!!!"

    class Config:
        env_file = ".env"

    @property
    def async_database_url(self) -> str:
        return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


settings = Settings()
