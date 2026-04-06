import httpx
import asyncio
import re
from typing import AsyncGenerator
from app.services.job_tracker import update_job, JobStatus
from app.services.product_service import upsert_product
from datetime import datetime


# ─── Shared normalization helpers ────────────────────────────────────────────

def extract_dimensions(text: str) -> dict:
    """
    Extract product dimensions from a title/variant string.
    Returns dict with optional keys: width, length (both in INCHES), thickness.

    Handles:
      - "54\" x 50yd"  →  width=54in, length=1800in
      - "24in x 150ft" →  width=24in, length=1800in
      - "48\" x 96\""  →  width=48in, length=96in
      - "4' x 8'"      →  width=48in, length=96in
      - "54-inch wide, 50 yard roll"
      - "60\" wide x 25'"
      - thickness: "3mm", ".040"
    """
    dims: dict = {}
    t = text.strip()

    # ── 1. Feet x Feet  (e.g. "4' x 8'", "2' x 4'") ─────────────────────
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:ft|feet|')?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')\b", t)
    if m:
        dims["width"] = float(m.group(1)) * 12
        dims["length"] = float(m.group(2)) * 12
        return dims

    # ── 2. W (in/") x L (yd/ft/in)  — most common roll/sheet pattern ─────
    # e.g. "54\" x 50yd", "24in x 150ft", "48\" x 96\"", "60 x 25ft"
    m = re.search(
        r'(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(yd|yard|yards?|ft|feet|foot|in|")?',
        t, re.IGNORECASE
    )
    if m:
        w = float(m.group(1))
        l_val = float(m.group(2))
        l_unit = (m.group(3) or "").lower().rstrip("s")

        # Reject obviously non-dimension matches (e.g. "5-in-1", small voltages)
        if w < 1 or l_val < 1:
            pass
        else:
            if l_unit in ("yd", "yard"):
                dims["length"] = l_val * 36
            elif l_unit in ("ft", "feet", "foot"):
                dims["length"] = l_val * 12
            else:
                dims["length"] = l_val  # assume inches
            dims["width"] = w
            return dims

    # ── 3. "W-inch wide" + separate length  (e.g. "54-inch wide 50yd roll") ─
    m_w = re.search(r'(\d+(?:\.\d+)?)\s*[\-\s]?(?:inch(?:es)?|in|")\s*wide', t, re.IGNORECASE)
    m_l = re.search(r'(\d+(?:\.\d+)?)\s*-?\s*(yd|yard|yards?|ft|feet|linear\s*ft)', t, re.IGNORECASE)
    if m_w and m_l:
        dims["width"] = float(m_w.group(1))
        l_val = float(m_l.group(1))
        l_unit = m_l.group(2).lower()
        if "yd" in l_unit or "yard" in l_unit:
            dims["length"] = l_val * 36
        else:
            dims["length"] = l_val * 12
        return dims

    # ── 4. Width-only from inch marker (rolls/films without explicit length) ─
    m_w2 = re.search(r'(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)\b', t, re.IGNORECASE)
    if m_w2 and float(m_w2.group(1)) >= 6:  # ignore tiny numbers like screws
        dims["width"] = float(m_w2.group(1))

    # ── Thickness ─────────────────────────────────────────────────────────
    m_mm = re.search(r'(\d+(?:\.\d+)?)\s*mm\b', t, re.IGNORECASE)
    if m_mm:
        dims["thickness"] = float(m_mm.group(1))
    else:
        m_thou = re.search(r'(?<!\d)\.(0\d{2})\b', t)
        if m_thou:
            dims["thickness"] = float("0." + m_thou.group(1))

    return dims


def compute_normalized_price(price: float, dims: dict, title: str = "") -> tuple[float | None, str | None]:
    """
    Compute normalized price per standard unit.

    Priority:
      1. width + length → $/ft²   (rolls, sheets, films)
      2. width only     → $/linear ft  (rolls sold by linear yard/ft)
      3. no dims        → $/unit

    Sanity check: if computed $/ft² is implausibly high (>$500) or low (<$0.001),
    fall back to $/unit to avoid misleading comparisons.
    """
    width_in = dims.get("width")
    length_in = dims.get("length")

    if width_in and length_in and width_in > 0 and length_in > 0:
        sq_in = width_in * length_in
        sq_ft = sq_in / 144.0
        if sq_ft > 0:
            norm = round(price / sq_ft, 4)
            # Sanity: $0.01–$500/ft² is realistic for signage materials
            if 0.01 <= norm <= 500:
                return norm, "ft²"

    if width_in and width_in > 0 and not length_in:
        lin_ft = width_in / 12.0
        if lin_ft > 0:
            norm = round(price / lin_ft, 4)
            if 0.01 <= norm <= 10000:
                return norm, "linear ft"

    return None, None  # can't normalize — don't show misleading $/unit


# ─── Shopify base scraper ─────────────────────────────────────────────────────

class ShopifyScraper:
    """
    Base scraper for public Shopify stores.
    Uses the /products.json API endpoint — no browser or auth needed.
    """
    supplier_name: str = ""
    base_url: str = ""
    collection: str = "all"

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
                    await asyncio.sleep(0.5)

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
        title = raw.get("title", "").strip()
        brand = raw.get("vendor", "").strip() or None
        product_type = raw.get("product_type", "").strip()
        handle = raw.get("handle", "")
        product_url = f"{self.base_url}/products/{handle}"
        category = self._map_category(product_type, title)

        images = raw.get("images", [])
        image_url = images[0].get("src") if images else None
        body_html = raw.get("body_html", "") or ""
        description = re.sub(r'<[^>]+>', ' ', body_html).strip()
        description = re.sub(r'\s+', ' ', description)[:1000] or None

        variants = raw.get("variants", [])
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

            full_title = title
            if variant_title and variant_title.lower() not in ("default title", ""):
                full_title = f"{title} — {variant_title}"

            # Extract dimensions from combined title + variant (variant often has the size)
            dims = extract_dimensions(full_title + " " + variant_title)
            norm_price, norm_unit = compute_normalized_price(price, dims, full_title)

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
        if product_type in self.CATEGORY_MAP:
            return self.CATEGORY_MAP[product_type]
        return product_type.title() if product_type else None

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
