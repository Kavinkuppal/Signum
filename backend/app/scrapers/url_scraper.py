"""
Scrape an arbitrary supplier URL on behalf of a specific user.
Strategies (in order): Shopify API → WooCommerce API → AI extraction.
All products are tagged with user_id so they're only visible to that user.
"""

import asyncio
import json
import re
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.scrapers.shopify_base import (
    ShopifyScraper,
    extract_dimensions,
    compute_normalized_price,
)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SignumProcurementPro/1.0)",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
}


def _base(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


def _domain(url: str) -> str:
    return urlparse(url).netloc.lower().lstrip("www.")


def _abs(href: str, page_url: str) -> str:
    if href.startswith(("http://", "https://")):
        return href
    p = urlparse(page_url)
    return f"{p.scheme}://{p.netloc}{href}" if href.startswith("/") else page_url


def _parse_price(text: str) -> Optional[float]:
    m = re.search(r"\$?\s*(\d[\d,]*(?:\.\d{1,2})?)", text.replace(",", ""))
    return float(m.group(1)) if m else None


def _make_product(supplier_name: str, user_id: str, title: str, price: float,
                  sku: str = "", product_url: str = "", in_stock: bool = True,
                  image_url: str = None, description: str = None, brand: str = None) -> dict:
    dims = extract_dimensions(title)
    norm_price, norm_unit = compute_normalized_price(price, dims, title)
    return {
        "user_id": user_id,
        "supplier_name": supplier_name,
        "sku": (sku or title)[:100],
        "title": title[:500],
        "brand": brand,
        "material_category": None,
        "dimensions_length": dims.get("length"),
        "dimensions_width": dims.get("width"),
        "dimensions_thickness": dims.get("thickness"),
        "color": None,
        "finish": None,
        "price": price,
        "normalized_price": norm_price,
        "normalized_unit": norm_unit,
        "pack_quantity": None,
        "in_stock": in_stock,
        "lead_time_days": None,
        "product_url": product_url[:2000],
        "image_url": image_url,
        "description": (description or "")[:1000] or None,
    }


# ── Strategy 1: Shopify ───────────────────────────────────────────────────────

class _Scraper(ShopifyScraper):
    def __init__(self, supplier_name: str, base_url: str, user_id: str):
        self.supplier_name = supplier_name
        self.base_url = base_url
        self._user_id = user_id

    async def normalize_product(self, raw: dict):
        async for p in super().normalize_product(raw):
            p["user_id"] = self._user_id
            yield p


async def _try_shopify(client: httpx.AsyncClient, base: str, name: str, user_id: str) -> list[dict]:
    products = []
    scraper = _Scraper(name, base, user_id)
    page = 1
    while True:
        try:
            r = await client.get(f"{base}/products.json?limit=250&page={page}")
            if r.status_code != 200:
                break
            raw_list = r.json().get("products", [])
            if not raw_list:
                break
            for raw in raw_list:
                async for p in scraper.normalize_product(raw):
                    products.append(p)
            if len(raw_list) < 250:
                break
            page += 1
            await asyncio.sleep(0.5)
        except Exception:
            break
    return products


# ── Strategy 2: WooCommerce ───────────────────────────────────────────────────

async def _try_woocommerce(client: httpx.AsyncClient, base: str, name: str, user_id: str) -> list[dict]:
    products = []
    page = 1
    while True:
        try:
            r = await client.get(f"{base}/wp-json/wc/v3/products?per_page=100&page={page}&status=publish")
            if r.status_code == 401 or r.status_code not in (200,):
                break
            items = r.json()
            if not items or not isinstance(items, list):
                break
            for item in items:
                title = item.get("name", "").strip()
                if not title:
                    continue
                try:
                    price = float(item.get("price") or item.get("regular_price") or 0)
                except (ValueError, TypeError):
                    continue
                if price <= 0:
                    continue
                imgs = item.get("images", [])
                products.append(_make_product(
                    supplier_name=name, user_id=user_id, title=title, price=price,
                    sku=item.get("sku") or title[:50],
                    product_url=item.get("permalink", base),
                    in_stock=bool(item.get("in_stock", True)),
                    image_url=imgs[0].get("src") if imgs else None,
                ))
            if len(items) < 100:
                break
            page += 1
            await asyncio.sleep(0.3)
        except Exception:
            break
    return products


# ── Strategy 3: AI extraction ─────────────────────────────────────────────────

async def _try_ai(html: str, name: str, user_id: str, page_url: str) -> list[dict]:
    try:
        import anthropic
        from app.core.config import settings
        if not settings.ANTHROPIC_API_KEY:
            return []
    except Exception:
        return []

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
        tag.decompose()
    page_text = soup.get_text(separator="\n", strip=True)[:4000]

    prompt = f"""Extract products from this signage supplier page.
URL: {page_url}
Supplier: {name}

Page text:
{page_text}

Return ONLY valid JSON:
{{
  "products": [
    {{"title": "...", "sku": "...", "price": 0.00, "in_stock": true, "product_url": "...", "description": "..."}}
  ]
}}
If no products found return {{"products": []}}."""

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return []
        data = json.loads(m.group())
        products = []
        for p in data.get("products", []):
            title = str(p.get("title", "")).strip()
            if not title:
                continue
            try:
                price = float(p.get("price", 0))
            except (ValueError, TypeError):
                continue
            if price <= 0:
                continue
            products.append(_make_product(
                supplier_name=name, user_id=user_id, title=title, price=price,
                sku=str(p.get("sku", title))[:100],
                product_url=str(p.get("product_url", page_url)),
                in_stock=bool(p.get("in_stock", True)),
                description=str(p.get("description", ""))[:1000],
            ))
        return products
    except Exception as e:
        print(f"[URL Scraper AI] {e}")
        return []


# ── Public entry point ────────────────────────────────────────────────────────

async def scrape_url(url: str, supplier_name: str, user_id: str) -> tuple[list[dict], str]:
    """
    Scrape url on behalf of user_id. Returns (products, strategy).
    All products have user_id set so they're private to that user.
    """
    base = _base(url)

    async with httpx.AsyncClient(timeout=30, headers=_HEADERS, follow_redirects=True) as client:
        products = await _try_shopify(client, base, supplier_name, user_id)
        if products:
            return products, "shopify"

        products = await _try_woocommerce(client, base, supplier_name, user_id)
        if products:
            return products, "woocommerce"

        try:
            r = await client.get(url)
            html = r.text if r.status_code == 200 else None
        except Exception:
            html = None

        if html:
            products = await _try_ai(html, supplier_name, user_id, url)
            if products:
                return products, "ai"

    return [], "failed"
