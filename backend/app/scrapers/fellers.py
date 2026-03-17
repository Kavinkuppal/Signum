from playwright.async_api import Page
from typing import AsyncGenerator
from app.scrapers.base import BaseScraper


class FellersScraper(BaseScraper):
    supplier_name = "fellers"
    LOGIN_URL = "https://www.ffrps.com/store/login"
    CATALOG_URL = "https://www.ffrps.com/store"

    async def login(self, page: Page) -> None:
        await page.goto(self.LOGIN_URL, wait_until="domcontentloaded")
        print("[Fellers] Waiting for user to log in...")
        await page.wait_for_url(
            lambda url: "login" not in url.lower(),
            timeout=180_000,
        )
        print("[Fellers] Login detected.")

    async def scrape_products(self, page: Page) -> AsyncGenerator[dict, None]:
        # Stub — full implementation in Phase 2
        print("[Fellers] Scraper not yet fully implemented.")
        return
        yield  # make this a generator
