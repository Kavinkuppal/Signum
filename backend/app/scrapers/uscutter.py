import httpx
import asyncio
import re
from bs4 import BeautifulSoup
from app.services.job_tracker import update_job, JobStatus
from app.services.product_service import upsert_product
from app.scrapers.shopify_base import extract_dimensions, compute_normalized_price
from datetime import datetime


class USCutterScraper:
    supplier_name = "uscutter"
    BASE_URL = "https://www.uscutter.com"

    # Key categories on USCutter relevant to sign shops
    CATEGORIES = [
        "/Vinyl-Film",
        "/Sign-Vinyl",
        "/Heat-Transfer-Vinyl",
        "/Printable-Vinyl",
        "/Reflective-Vinyl",
        "/Outdoor-Vinyl",
        "/Banner-Material",
        "/Substrates",
        "/Laminate",
    ]

    async def run(self) -> int:
        update_job(self.supplier_name, status=JobStatus.SCRAPING, message="Scraping USCutter categories...")
        total = 0

        async with httpx.AsyncClient(
            timeout=30,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            follow_redirects=True,
        ) as client:
            for category_path in self.CATEGORIES:
                page = 1
                while True:
                    url = f"{self.BASE_URL}{category_path}?page={page}"
                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            break

                        soup = BeautifulSoup(resp.text, "html.parser")
                        products = self._parse_products(soup, category_path)

                        if not products:
                            break

                        for product in products:
                            await upsert_product(product)
                            total += 1

                        update_job(self.supplier_name, products_scraped=total, message=f"Scraped {total} products...")

                        # Check for next page
                        next_btn = soup.select_one("a.pagination-item--next, li.pagination-item--next a, a[aria-label='Next page']")
                        if not next_btn:
                            break
                        page += 1
                        await asyncio.sleep(0.5)

                    except Exception as e:
                        print(f"[USCutter] Error on {category_path} page {page}: {e}")
                        break

        update_job(
            self.supplier_name,
            status=JobStatus.DONE,
            products_scraped=total,
            message=f"Done — {total} products imported.",
            finished_at=datetime.utcnow(),
        )
        return total

    def _parse_products(self, soup: BeautifulSoup, category_path: str) -> list[dict]:
        products = []

        # USCutter product cards
        cards = soup.select("article.product, li.product, [data-product-id], .productGrid .product")
        if not cards:
            cards = soup.select(".product-item, .listItem")

        for card in cards:
            try:
                # Title
                title_el = card.select_one("h4, h3, .card-title, .product-title, [data-name]")
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                if not title:
                    continue

                # Price
                price_el = card.select_one(".price--withoutTax, .price, [data-product-price]")
                price = 0.0
                if price_el:
                    price_text = price_el.get_text(strip=True)
                    m = re.search(r"[\d,]+\.?\d*", price_text.replace(",", ""))
                    if m:
                        price = float(m.group())
                if price <= 0:
                    continue

                # URL
                link = card.select_one("a")
                href = link.get("href", "") if link else ""
                product_url = href if href.startswith("http") else f"{self.BASE_URL}{href}"

                # SKU
                sku_el = card.select_one("[data-sku], .sku")
                sku = sku_el.get_text(strip=True).replace("SKU:", "").strip() if sku_el else title[:50]

                category = self._map_category(category_path, title)
                dims = extract_dimensions(title)
                norm_price, norm_unit = compute_normalized_price(price, dims, title)

                products.append({
                    "supplier_name": self.supplier_name,
                    "sku": sku,
                    "title": title,
                    "brand": None,
                    "material_category": category,
                    "dimensions_width": dims.get("width"),
                    "dimensions_length": dims.get("length"),
                    "dimensions_thickness": dims.get("thickness"),
                    "color": None,
                    "finish": None,
                    "price": price,
                    "normalized_price": norm_price,
                    "normalized_unit": norm_unit,
                    "pack_quantity": None,
                    "in_stock": True,
                    "lead_time_days": None,
                    "product_url": product_url,
                })
            except Exception as e:
                print(f"[USCutter] Parse error: {e}")
                continue

        return products

    def _map_category(self, path: str, title: str) -> str:
        path_lower = path.lower()
        t = title.lower()
        if "heat-transfer" in path_lower or "htv" in t:
            return "Vinyl"
        if "vinyl" in path_lower or "vinyl" in t:
            return "Vinyl"
        if "banner" in path_lower:
            return "Banner"
        if "substrate" in path_lower:
            return "Substrate"
        if "laminate" in path_lower:
            return "Laminate"
        return "Vinyl"

