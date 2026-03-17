from playwright.async_api import Page
from typing import AsyncGenerator
from app.scrapers.base import BaseScraper


class GlantzScraper(BaseScraper):
    supplier_name = "glantz"
    LOGIN_URL = "https://www.gfrps.com/store/login"
    CATALOG_URL = "https://www.gfrps.com/store"

    async def login(self, page: Page) -> None:
        await page.goto(self.LOGIN_URL, wait_until="domcontentloaded")
        print("[Glantz] Waiting for user to log in...")
        await page.wait_for_url(
            lambda url: "login" not in url.lower(),
            timeout=180_000,
        )
        print("[Glantz] Login detected.")

    async def scrape_products(self, page: Page) -> AsyncGenerator[dict, None]:
        # Stub — full implementation in Phase 2
        print("[Glantz] Scraper not yet fully implemented.")
        return
        yield
