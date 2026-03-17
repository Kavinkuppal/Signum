from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
from enum import Enum


class JobStatus(str, Enum):
    PENDING = "pending"
    WAITING_LOGIN = "waiting_login"
    SCRAPING = "scraping"
    DONE = "done"
    ERROR = "error"


@dataclass
class ScrapeJob:
    supplier_id: str
    status: JobStatus = JobStatus.PENDING
    products_scraped: int = 0
    message: str = "Initializing..."
    started_at: datetime = field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
    error: Optional[str] = None


# In-memory store keyed by supplier_id (one job per supplier at a time)
_jobs: dict[str, ScrapeJob] = {}


def create_job(supplier_id: str) -> ScrapeJob:
    job = ScrapeJob(supplier_id=supplier_id)
    _jobs[supplier_id] = job
    return job


def get_job(supplier_id: str) -> Optional[ScrapeJob]:
    return _jobs.get(supplier_id)


def update_job(supplier_id: str, **kwargs) -> None:
    job = _jobs.get(supplier_id)
    if job:
        for k, v in kwargs.items():
            setattr(job, k, v)
