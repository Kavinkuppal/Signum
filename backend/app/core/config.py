from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://signum:signum@localhost:5432/signum"
    SECRET_KEY: str = "change-me-in-production"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    ENCRYPTION_KEY: str = "change-me-32-byte-key-here!!!!!"

    class Config:
        env_file = ".env"


settings = Settings()
