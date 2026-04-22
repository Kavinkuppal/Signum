from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.api.v1.router import router as v1_router
from app.core.config import settings

scheduler = AsyncIOScheduler()


async def _run_migrations():
    """Apply any pending schema changes using safe IF NOT EXISTS SQL."""
    from app.core.database import engine
    from sqlalchemy import text
    async with engine.begin() as conn:
        # user_id column on products (for per-user custom supplier products)
        await conn.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id VARCHAR"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_products_user_id ON products (user_id)"
        ))
        # custom_suppliers table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS custom_suppliers (
                id VARCHAR PRIMARY KEY,
                user_id VARCHAR NOT NULL,
                url TEXT NOT NULL,
                domain VARCHAR(200) NOT NULL,
                name VARCHAR(500) NOT NULL,
                scrape_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                scrape_error TEXT,
                scrape_strategy VARCHAR(30),
                products_found INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                last_scraped_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_custom_suppliers_user_id ON custom_suppliers (user_id)"
        ))
    print("[Startup] Schema migrations applied.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _run_migrations()
    # Schedule daily scrape at 2am
    from app.services.scrape_service import run_all_tier1
    scheduler.add_job(run_all_tier1, "cron", hour=2, minute=0, id="daily_tier1_scrape")
    scheduler.start()
    print("[Scheduler] Daily Tier 1 scrape scheduled at 02:00.")
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Signum API",
    description="Signage Procurement Pro — Backend API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(v1_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
