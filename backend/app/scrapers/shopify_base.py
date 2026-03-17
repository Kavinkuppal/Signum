import httpx
import asyncio
import re
from typing import AsyncGenerator
from app.services.job_tracker import update_job, JobStatus
from app.services.product_service import upsert_product
from datetime import datetime


class ShopifyScraper:
    """
    Base scraper for public Shopify stores.
    Uses the /products.json API endpoint — no browser or auth needed.
    """
    supplier_name: str = ""
    base_url: str = ""
    collection: str = "all"

    # Subclasses can override these for supplier-specific category/brand mapping
    CATEGORY_MAP: dict[str, str] = {}

    async def run(self) -> int:
        update_job(self.supplier_name, status=JobStatus.SCRAPING, message="Fetching catalog via Shopify API...")
        total = 0

        async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "Mozilla/5.0"}) as client:
            page = 1
            while True:
                url = f"{self.base_url}/collections/{self.collection}/products.json?limit=250&page={page}"
                try:
                    resp = await client.get(url)
                    if resp.status_code != 200:
                        break
                    data = resp.json()
                    products = data.get("products", [])
                    if not products:
                        break

                    for raw in products:
                        async for normalized in self.normalize_product(raw):
                            await upsert_product(normalized)
                            total += 1

                    update_job(self.supplier_name, products_scraped=total, message=f"Scraped {total} products...")

                    if len(products) < 250:
                        break
                    page += 1
                    await asyncio.sleep(0.5)  # be polite

                except Exception as e:
                    print(f"[{self.supplier_name}] Error on page {page}: {e}")
                    break

        update_job(
            self.supplier_name,
            status=JobStatus.DONE,
            products_scraped=total,
            message=f"Done — {total} products imported.",
            finished_at=datetime.utcnow(),
        )
        return total

    async def normalize_product(self, raw: dict) -> AsyncGenerator[dict, None]:
        """
        Convert a Shopify product JSON object into one normalized product dict per variant.
        Subclasses can override for supplier-specific logic.
        """
        title = raw.get("title", "").strip()
        brand = raw.get("vendor", "").strip() or None
        product_type = raw.get("product_type", "").strip()
        handle = raw.get("handle", "")
        product_url = f"{self.base_url}/products/{handle}"
        category = self._map_category(product_type, title)

        # Extract image and description
        images = raw.get("images", [])
        image_url = images[0].get("src") if images else None
        body_html = raw.get("body_html", "") or ""
        description = re.sub(r'<[^>]+>', ' ', body_html).strip()
        description = re.sub(r'\s+', ' ', description)[:1000] or None

        variants = raw.get("variants", [])
        # If only one variant, treat the product as a single item
        # If multiple variants (e.g. different widths/colors), emit one per variant
        for variant in variants:
            sku = variant.get("sku") or f"{handle}-{variant.get('id', '')}"
            price_str = variant.get("price", "0")
            try:
                price = float(price_str)
            except (ValueError, TypeError):
                price = 0.0
            if price <= 0:
                continue

            available = variant.get("available", True)
            variant_title = variant.get("title", "")

            # Build full title: combine product title + variant if meaningful
            full_title = title
            if variant_title and variant_title.lower() not in ("default title", ""):
                full_title = f"{title} — {variant_title}"

            # Extract dimensions from title/variant
            dims = self._extract_dimensions(full_title + " " + variant_title)

            # Compute normalized price
            norm_price, norm_unit = self._compute_normalized_price(price, dims, full_title)

            yield {
                "supplier_name": self.supplier_name,
                "sku": sku[:100],
                "title": full_title[:500],
                "brand": brand,
                "material_category": category,
                "dimensions_length": dims.get("length"),
                "dimensions_width": dims.get("width"),
                "dimensions_thickness": dims.get("thickness"),
                "color": self._extract_color(variant_title + " " + title),
                "finish": self._extract_finish(variant_title + " " + title),
                "price": price,
                "normalized_price": norm_price,
                "normalized_unit": norm_unit,
                "pack_quantity": self._extract_pack_qty(full_title),
                "in_stock": available,
                "lead_time_days": None,
                "product_url": product_url,
                "image_url": image_url,
                "description": description,
            }

    def _map_category(self, product_type: str, title: str) -> str | None:
        t = (product_type + " " + title).lower()
        if any(k in t for k in ["vinyl", "wrap film", "cast film", "calendered", "adhesive film", "htv", "heat transfer"]):
            return "Vinyl"
        if any(k in t for k in ["aluminum", "aluminium", "dibond", "alupanel", "acm", "aluminum composite"]):
            return "Aluminum"
        if any(k in t for k in ["led", "neon flex", "light module", "power supply", "driver"]):
            return "LED"
        if any(k in t for k in ["sintra", "pvc foam", "foam board", "gatorfoam", "gatorboard", "foamboard"]):
            return "Substrate"
        if any(k in t for k in ["coroplast", "corrugated plastic", "fluted", "coro"]):
            return "Coroplast"
        if any(k in t for k in ["laminate", "overlaminate", "overlam"]):
            return "Laminate"
        if any(k in t for k in ["acrylic", "plexiglass", "plexiglas"]):
            return "Acrylic"
        if any(k in t for k in ["ink", "toner", "cartridge"]):
            return "Ink"
        if any(k in t for k in ["standoff", "bracket", "channel cap", "fastener", "hardware"]):
            return "Hardware"
        if any(k in t for k in ["banner", "mesh banner"]):
            return "Banner"
        if any(k in t for k in ["substrate", "sign blank", "sign board"]):
            return "Substrate"
        # Check supplier-specific map
        if product_type in self.CATEGORY_MAP:
            return self.CATEGORY_MAP[product_type]
        return product_type.title() if product_type else None

    def _extract_dimensions(self, text: str) -> dict:
        """Extract width x length (in inches/feet/yards) from product title."""
        dims: dict = {}
        text_lower = text.lower()

        # Pattern: NNin x NNyd or NN" x NN' or NN x NN (inches assumed)
        # Width x Length in yards: e.g. "54\" x 50yd", "60in x 50yd"
        m = re.search(r'(\d+\.?\d*)\s*(?:"|in|inch)?\s*[xX×]\s*(\d+\.?\d*)\s*(yd|yard|ft|feet|in|")?', text)
        if m:
            w = float(m.group(1))
            l_val = float(m.group(2))
            l_unit = (m.group(3) or "").lower()
            dims["width"] = w  # inches
            if "yd" in l_unit or "yard" in l_unit:
                dims["length"] = l_val * 36  # convert yards to inches
            elif "ft" in l_unit or "feet" in l_unit:
                dims["length"] = l_val * 12
            else:
                dims["length"] = l_val  # assume inches

        # Thickness: e.g. ".040", "3mm", "1/8\""
        m2 = re.search(r'(\d+\.?\d*)\s*mm', text_lower)
        if m2:
            dims["thickness"] = float(m2.group(1))
        else:
            m3 = re.search(r'\.(0\d{2})', text_lower)
            if m3:
                dims["thickness"] = float("0." + m3.group(1))

        return dims

    def _compute_normalized_price(self, price: float, dims: dict, title: str) -> tuple[float | None, str | None]:
        """Calculate $/ft² or $/linear ft based on available dimensions."""
        width_in = dims.get("width")
        length_in = dims.get("length")

        if width_in and length_in:
            sq_inches = width_in * length_in
            sq_ft = sq_inches / 144.0
            if sq_ft > 0:
                return round(price / sq_ft, 4), "ft²"

        # Linear ft: if only width or only length
        if width_in and not length_in:
            lin_ft = width_in / 12.0
            if lin_ft > 0:
                return round(price / lin_ft, 4), "linear ft"

        # Default: $/unit
        return price, "unit"

    def _extract_color(self, text: str) -> str | None:
        colors = ["white", "black", "red", "blue", "green", "yellow", "silver", "gold",
                  "clear", "transparent", "chrome", "orange", "purple", "brown", "gray", "grey",
                  "bronze", "copper", "matte black", "gloss black", "gloss white", "matte white"]
        t = text.lower()
        for c in colors:
            if c in t:
                return c.title()
        return None

    def _extract_finish(self, text: str) -> str | None:
        t = text.lower()
        if "matte" in t or "mat " in t:
            return "Matte"
        if "gloss" in t or "glossy" in t:
            return "Gloss"
        if "satin" in t:
            return "Satin"
        if "brushed" in t:
            return "Brushed"
        if "carbon fiber" in t or "carbon fibre" in t:
            return "Carbon Fiber"
        if "chrome" in t:
            return "Chrome"
        return None

    def _extract_pack_qty(self, text: str) -> int | None:
        m = re.search(r'pack\s*(?:of\s*)?(\d+)|(\d+)\s*(?:pack|pcs|pieces|count|ct\b)', text.lower())
        if m:
            return int(m.group(1) or m.group(2))
        return None
