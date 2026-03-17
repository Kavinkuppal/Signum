from playwright.async_api import Page
from typing import AsyncGenerator
from app.scrapers.base import BaseScraper
import re


class GrimcoScraper(BaseScraper):
    supplier_name = "grimco"
    LOGIN_URL = "https://www.grimco.com/account/login"
    CATALOG_URL = "https://www.grimco.com/collections/all"

    async def login(self, page: Page) -> None:
        await page.goto(self.LOGIN_URL, wait_until="domcontentloaded")
        print("[Grimco] Waiting for user to log in...")
        # Wait until the URL no longer contains "login" or "account/login"
        await page.wait_for_url(
            lambda url: "login" not in url.lower(),
            timeout=180_000,  # 3 minute timeout for user to log in
        )
        print("[Grimco] Login detected.")

    async def scrape_products(self, page: Page) -> AsyncGenerator[dict, None]:
        await page.goto(self.CATALOG_URL, wait_until="domcontentloaded")

        page_num = 1
        while True:
            print(f"[Grimco] Scraping page {page_num}...")

            # Wait for product grid to load
            try:
                await page.wait_for_selector(
                    ".product-item, .grid__item, .product-card, [data-product-id], .boost-pfs-filter-product-item",
                    timeout=15_000,
                )
            except Exception:
                print(f"[Grimco] No product grid found on page {page_num}, stopping.")
                break

            # Try multiple possible selectors for Grimco's Shopify theme
            product_els = await page.query_selector_all(
                ".product-item, .grid__item .product-card, .boost-pfs-filter-product-item"
            )
            if not product_els:
                product_els = await page.query_selector_all("[data-product-id]")

            print(f"[Grimco] Found {len(product_els)} products on page {page_num}")

            for el in product_els:
                try:
                    data = await self._extract_product(el)
                    if data:
                        yield data
                except Exception as e:
                    print(f"[Grimco] Extraction error: {e}")
                    continue

            # Try to go to next page
            next_btn = await page.query_selector(
                "a[rel='next'], .pagination__next, .boost-pfs-filter-paginate-next, a.next"
            )
            if not next_btn:
                break

            try:
                await next_btn.click()
                await page.wait_for_load_state("networkidle", timeout=10_000)
                page_num += 1
            except Exception:
                break

    async def _extract_product(self, el) -> dict | None:
        # Try multiple title selectors used by Shopify themes
        title = await self._text(el, [
            ".product-item__title",
            ".product-card__title",
            ".grid-product__title",
            "h2 a", "h3 a", "h2", "h3",
            ".boost-pfs-filter-product-title",
        ])
        if not title:
            return None

        # Price
        price_text = await self._text(el, [
            ".price__regular .price-item",
            ".product-item__price",
            ".price",
            ".product-card__price",
            "[data-price]",
            ".boost-pfs-filter-product-item-regular-price",
        ])
        price = self._parse_price(price_text)
        if price == 0.0:
            return None

        # URL
        link = await el.query_selector("a")
        href = await link.get_attribute("href") if link else ""
        product_url = f"https://www.grimco.com{href}" if href and href.startswith("/") else (href or "")

        # SKU
        sku_text = await self._text(el, [".product-item__sku", ".sku", "[data-sku]"])
        sku = sku_text.replace("SKU:", "").strip() if sku_text else title[:50]

        # Image (for future use)
        img = await el.query_selector("img")
        img_src = await img.get_attribute("src") if img else None

        return {
            "sku": sku,
            "title": title.strip(),
            "price": price,
            "product_url": product_url,
            "in_stock": True,
            "material_category": self._categorize(title),
            "brand": self._extract_brand(title),
        }

    async def _text(self, el, selectors: list[str]) -> str | None:
        for sel in selectors:
            try:
                node = await el.query_selector(sel)
                if node:
                    text = (await node.inner_text()).strip()
                    if text:
                        return text
            except Exception:
                continue
        return None

    def _parse_price(self, text: str | None) -> float:
        if not text:
            return 0.0
        match = re.search(r"[\d,]+\.?\d*", text.replace(",", ""))
        return float(match.group()) if match else 0.0

    def _categorize(self, title: str) -> str | None:
        t = title.lower()
        if any(k in t for k in ["vinyl", "wrap", "adhesive film", "cast film", "calendered"]):
            return "Vinyl"
        if any(k in t for k in ["aluminum", "aluminium", "dibond", "alupanel", "acm", "aluminum composite"]):
            return "Aluminum"
        if any(k in t for k in ["led", "neon flex", "light module", "power supply", "driver"]):
            return "LED"
        if any(k in t for k in ["sintra", "pvc foam", "foam board", "gatorfoam", "gatorboard"]):
            return "Substrate"
        if any(k in t for k in ["coroplast", "corrugated plastic", "fluted"]):
            return "Coroplast"
        if any(k in t for k in ["laminate", "overlaminate", "overlam"]):
            return "Laminate"
        if any(k in t for k in ["acrylic", "plexiglass", "plexiglas"]):
            return "Acrylic"
        if any(k in t for k in ["ink", "toner", "cartridge"]):
            return "Ink"
        if any(k in t for k in ["standoff", "bracket", "channel cap", "fastener", "screw", "hardware", "cap return"]):
            return "Hardware"
        return None

    def _extract_brand(self, title: str) -> str | None:
        brands = ["3M", "Oracal", "Orajet", "Avery", "Avery Dennison", "Roland", "Epson",
                  "Mimaki", "Mutoh", "HP", "Canon", "Dibond", "Sintra", "Coroplast",
                  "Gatorboard", "Alupanel", "General Formulations", "Mactac", "FDC"]
        t = title.lower()
        for brand in brands:
            if brand.lower() in t:
                return brand
        return None
