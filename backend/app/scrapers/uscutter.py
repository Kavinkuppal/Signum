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
    BASE_URL = "https://uscutter.com"

    # Search queries that cover sign-shop-relevant inventory
    SEARCH_QUERIES = [
        "sign vinyl",
        "heat transfer vinyl",
        "printable vinyl",
        "reflective vinyl",
        "banner material",
        "laminate",
        "substrate",
        "coroplast",
    ]

    async def run(self) -> int:
        update_job(self.supplier_name, status=JobStatus.SCRAPING, message="Scraping USCutter...")
        total = 0
        seen_urls: set[str] = set()

        async with httpx.AsyncClient(
            timeout=30,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            follow_redirects=True,
        ) as client:
            for query in self.SEARCH_QUERIES:
                page = 1
                while True:
                    url = f"{self.BASE_URL}/search.php?search_query={query.replace(' ', '+')}&section=product&page={page}"
                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            break

                        soup = BeautifulSoup(resp.text, "html.parser")
                        products = self._parse_products(soup, seen_urls)

                        if not products:
                            break

                        for product in products:
                            seen_urls.add(product["product_url"])
                            await upsert_product(product)
                            total += 1

                        update_job(self.supplier_name, products_scraped=total, message=f"Scraped {total} products...")

                        next_btn = soup.select_one("li.pagination-item--next a")
                        if not next_btn:
                            break
                        page += 1
                        await asyncio.sleep(0.5)

                    except Exception as e:
                        print(f"[USCutter] Error on '{query}' page {page}: {e}")
                        break

        update_job(
            self.supplier_name,
            status=JobStatus.DONE,
            products_scraped=total,
            message=f"Done — {total} products imported.",
            finished_at=datetime.utcnow(),
        )
        return total

    def _parse_products(self, soup: BeautifulSoup, seen_urls: set) -> list[dict]:
        products = []

        for card in soup.select("li.product"):
            try:
                title_el = card.select_one("h4")
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                if not title:
                    continue

                link = card.select_one("a[href]")
                if not link:
                    continue
                href = link.get("href", "")
                product_url = href if href.startswith("http") else f"{self.BASE_URL}{href}"
                # Strip search query params from URL for deduplication
                product_url = product_url.split("?")[0]
                if product_url in seen_urls:
                    continue

                price_el = card.select_one(".price--withoutTax")
                price = 0.0
                if price_el:
                    price_text = price_el.get_text(strip=True)
                    # Take the lower bound if it's a range like "$19.99 - $150.99"
                    m = re.search(r"[\d,]+\.?\d*", price_text.replace(",", ""))
                    if m:
                        price = float(m.group())
                if price <= 0:
                    continue

                img_el = card.select_one("img")
                image_url = None
                if img_el:
                    image_url = img_el.get("src") or img_el.get("data-src") or None
                    # Skip placeholder/blank images
                    if image_url and ("blank.gif" in image_url or "placeholder" in image_url):
                        image_url = None

                category = self._map_category(title)
                dims = extract_dimensions(title)
                norm_price, norm_unit = compute_normalized_price(price, dims, title)

                products.append({
                    "supplier_name": self.supplier_name,
                    "sku": title[:100],
                    "title": title[:500],
                    "brand": self._extract_brand(title),
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
                    "image_url": image_url,
                })
            except Exception as e:
                print(f"[USCutter] Parse error: {e}")
                continue

        return products

    def _extract_brand(self, title: str) -> str | None:
        brands = ["ORACAL", "Siser", "3M", "Avery", "Greenstar", "USCutter", "Arlon",
                  "Mactac", "FDC", "VinylEfx", "Roland", "Mimaki"]
        for brand in brands:
            if brand.lower() in title.lower():
                return brand
        return None

    def _map_category(self, title: str) -> str:
        t = title.lower()
        if any(k in t for k in ["heat transfer", "htv", "siser", "easyweed"]):
            return "Vinyl"
        if any(k in t for k in ["vinyl", "wrap", "cast", "calendered", "adhesive film"]):
            return "Vinyl"
        if any(k in t for k in ["banner", "mesh"]):
            return "Banner"
        if any(k in t for k in ["laminate", "overlaminate"]):
            return "Laminate"
        if any(k in t for k in ["coroplast", "corrugated", "fluted"]):
            return "Coroplast"
        if any(k in t for k in ["substrate", "foam board", "sintra", "pvc foam"]):
            return "Substrate"
        return "Vinyl"
