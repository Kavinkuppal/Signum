from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.api.v1.router import router as v1_router
from app.core.config import settings

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
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
