from abc import ABC, abstractmethod
from playwright.async_api import async_playwright, Page
from typing import AsyncGenerator
from app.services.job_tracker import update_job, JobStatus
from datetime import datetime


class BaseScraper(ABC):
    supplier_name: str = ""

    async def run(self) -> None:
        update_job(self.supplier_name, status=JobStatus.WAITING_LOGIN, message="Opening browser — please log in...")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False, args=["--start-maximized"])
            context = await browser.new_context(viewport=None)
            page = await context.new_page()

            try:
                await self.login(page)

                update_job(self.supplier_name, status=JobStatus.SCRAPING, message="Login detected — scraping catalog...")
                count = 0

                async for product_data in self.scrape_products(page):
                    await self.save(product_data)
                    count += 1
                    update_job(
                        self.supplier_name,
                        products_scraped=count,
                        message=f"Scraped {count} products...",
                    )

                update_job(
                    self.supplier_name,
                    status=JobStatus.DONE,
                    products_scraped=count,
                    message=f"Done — {count} products imported.",
                    finished_at=datetime.utcnow(),
                )
            except Exception as e:
                update_job(
                    self.supplier_name,
                    status=JobStatus.ERROR,
                    error=str(e),
                    finished_at=datetime.utcnow(),
                )
                raise
            finally:
                await browser.close()

    @abstractmethod
    async def login(self, page: Page) -> None:
        pass

    @abstractmethod
    async def scrape_products(self, page: Page) -> AsyncGenerator[dict, None]:
        pass

    async def save(self, data: dict) -> None:
        from app.services.product_service import upsert_product
        data["supplier_name"] = self.supplier_name
        await upsert_product(data)
