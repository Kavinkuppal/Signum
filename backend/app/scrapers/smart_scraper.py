"""
Smart fallback scraping chain for arbitrary supplier websites.

Strategy order:
  1. Shopify /products.json API         — fastest, most complete
  2. WooCommerce /wp-json/wc/v3/products — REST, no-auth public stores
  3. JSON-LD structured data in HTML     — schema.org Product markup
  4. Saved CSS selector template         — from a previous successful scrape
  5. Claude Haiku AI extraction          — last resort; generates & caches a CSS template

Each strategy returns (products: list[dict], strategy_name: str).
If all strategies fail, returns ([], "failed").
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

APP_USER_AGENT = "SignumProcurementPro/1.0 (signumprocurepro@gmail.com)"

# ── Signage relevance filter ──────────────────────────────────────────────────

SIGNAGE_CATEGORIES = {
    "Vinyl", "Aluminum", "LED", "Substrate", "Hardware",
    "Ink", "Laminate", "Foam Board", "Coroplast", "Acrylic", "Banner",
}

_SIGNAGE_TITLE_KEYWORDS = [
    "vinyl", "wrap film", "cast film", "calendered", "adhesive film",
    "aluminum", "aluminium", "dibond", "alupanel", "acm panel", "sign blank",
    "led module", "led strip", "neon flex", "power supply driver", "led driver",
    "sintra", "pvc foam", "foam board", "gatorboard", "gatorfoam",
    "coroplast", "corrugated plastic", "fluted board",
    "overlaminate", "laminate film", "oralam",
    "acrylic sheet", "plexiglass", "plexiglas",
    "standoff", "channel cap", "channel letter", "sign hardware",
    "wide format", "banner media", "banner material",
    "scotchcal", "oracal", "orajet", "avery dennison", "3m ij", "3m 1080",
]

_SIGNAGE_BRAND_KEYWORDS = [
    "3m", "oracal", "avery dennison", "arlon", "mactac", "hexis",
    "grimco", "fellers", "glantz", "mclogan",
    "sintra", "dibond", "coroplast", "gatorfoam",
    "roland", "mimaki", "epson", "mutoh",
]


def is_signage_relevant(product: dict) -> bool:
    """Return True if a scraped product is plausibly a signage supply item."""
    category = (product.get("material_category") or "").strip()
    if category in SIGNAGE_CATEGORIES:
        return True

    title = (product.get("title") or "").lower()
    if any(kw in title for kw in _SIGNAGE_TITLE_KEYWORDS):
        return True

    brand = (product.get("brand") or "").lower()
    if any(kw in brand for kw in _SIGNAGE_BRAND_KEYWORDS):
        return True

    return False


def filter_signage_products(products: list[dict]) -> list[dict]:
    return [p for p in products if is_signage_relevant(p)]

_FETCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SignumProcurementPro/1.0)",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
}


# ── Utilities ─────────────────────────────────────────────────────────────────

def _domain(url: str) -> str:
    return urlparse(url).netloc.lower().lstrip("www.")


def _base_url(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


def _abs_url(href: str, page_url: str) -> str:
    if href.startswith(("http://", "https://")):
        return href
    p = urlparse(page_url)
    return f"{p.scheme}://{p.netloc}{href}" if href.startswith("/") else page_url


async def _fetch(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        r = await client.get(url, follow_redirects=True)
        return r.text if r.status_code == 200 else None
    except Exception:
        return None


def _parse_price(text: str) -> Optional[float]:
    m = re.search(r"\$?\s*(\d[\d,]*(?:\.\d{1,2})?)", text.replace(",", ""))
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return None


def _make_product(
    supplier_name: str,
    title: str,
    price: float,
    sku: Optional[str] = None,
    product_url: str = "",
    in_stock: bool = True,
    image_url: Optional[str] = None,
    description: Optional[str] = None,
    brand: Optional[str] = None,
) -> dict:
    dims = extract_dimensions(title)
    norm_price, norm_unit = compute_normalized_price(price, dims, title)
    return {
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

class _ShopifyScraper(ShopifyScraper):
    def __init__(self, supplier_name: str, base_url: str):
        self.supplier_name = supplier_name
        self.base_url = base_url


async def _try_shopify(
    client: httpx.AsyncClient, base: str, supplier_name: str
) -> list[dict]:
    products: list[dict] = []
    page = 1
    scraper = _ShopifyScraper(supplier_name, base)

    while True:
        url = f"{base}/products.json?limit=250&page={page}"
        try:
            r = await client.get(url)
            if r.status_code != 200:
                break
            raw_products = r.json().get("products", [])
            if not raw_products:
                break
            for raw in raw_products:
                async for p in scraper.normalize_product(raw):
                    products.append(p)
            if len(raw_products) < 250:
                break
            page += 1
            await asyncio.sleep(0.5)
        except Exception:
            break

    return products


# ── Strategy 2: WooCommerce ───────────────────────────────────────────────────

async def _try_woocommerce(
    client: httpx.AsyncClient, base: str, supplier_name: str
) -> list[dict]:
    products: list[dict] = []
    page = 1

    while True:
        url = f"{base}/wp-json/wc/v3/products?per_page=100&page={page}&status=publish"
        try:
            r = await client.get(url)
            if r.status_code == 401:
                break  # auth required
            if r.status_code != 200:
                break
            items = r.json()
            if not items or not isinstance(items, list):
                break

            for item in items:
                name = item.get("name", "").strip()
                if not name:
                    continue
                try:
                    price = float(item.get("price") or item.get("regular_price") or 0)
                except (ValueError, TypeError):
                    continue
                if price <= 0:
                    continue

                imgs = item.get("images", [])
                products.append(_make_product(
                    supplier_name=supplier_name,
                    title=name,
                    price=price,
                    sku=item.get("sku") or name[:50],
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


# ── Strategy 3: JSON-LD ───────────────────────────────────────────────────────

async def _try_json_ld(
    html: str, supplier_name: str, page_url: str
) -> list[dict]:
    products: list[dict] = []
    soup = BeautifulSoup(html, "html.parser")

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        items = data if isinstance(data, list) else [data]
        for item in items:
            if item.get("@type") == "Product":
                p = _ld_product(item, supplier_name, page_url)
                if p:
                    products.append(p)
            elif item.get("@type") in ("ItemList", "ProductCollection"):
                for el in item.get("itemListElement", []):
                    inner = el.get("item", el)
                    if inner.get("@type") == "Product":
                        p = _ld_product(inner, supplier_name, page_url)
                        if p:
                            products.append(p)

    return products


def _ld_product(item: dict, supplier_name: str, page_url: str) -> Optional[dict]:
    name = item.get("name", "").strip()
    if not name:
        return None
    offers = item.get("offers", {})
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    try:
        price = float(str(offers.get("price") or offers.get("lowPrice") or 0).replace(",", ""))
    except (ValueError, TypeError):
        return None
    if price <= 0:
        return None

    avail = offers.get("availability", "")
    in_stock = not avail or "InStock" in avail or "InStoreOnly" in avail

    brand_raw = item.get("brand")
    brand = brand_raw.get("name") if isinstance(brand_raw, dict) else brand_raw

    img = item.get("image")
    img_url = img if isinstance(img, str) else (img[0] if isinstance(img, list) and img else None)

    return _make_product(
        supplier_name=supplier_name,
        title=name,
        price=price,
        sku=item.get("sku") or item.get("mpn") or name[:50],
        product_url=offers.get("url") or item.get("url") or page_url,
        in_stock=in_stock,
        image_url=img_url,
        description=item.get("description", "")[:1000],
        brand=brand,
    )


# ── Strategy 4: Saved CSS template ───────────────────────────────────────────

async def _try_css_template(
    html: str, template_data: dict, supplier_name: str, page_url: str
) -> list[dict]:
    products: list[dict] = []
    soup = BeautifulSoup(html, "html.parser")

    container_sel = template_data.get("container", ".product")
    title_sel = template_data.get("title", "h2,h3,.product-title")
    price_sel = template_data.get("price", ".price,[class*='price']")
    sku_sel = template_data.get("sku")
    url_sel = template_data.get("url", "a")
    img_sel = template_data.get("image", "img")

    containers = soup.select(container_sel)
    if not containers:
        return []

    for container in containers[:100]:
        title_el = container.select_one(title_sel)
        price_el = container.select_one(price_sel)
        if not title_el or not price_el:
            continue

        title = title_el.get_text(strip=True)
        price = _parse_price(price_el.get_text(strip=True))
        if not price or price <= 0:
            continue

        sku = None
        if sku_sel:
            sel = container.select_one(sku_sel)
            if sel:
                sku = sel.get_text(strip=True)

        url_el = container.select_one(url_sel)
        prod_url = _abs_url(url_el.get("href", page_url) if url_el else page_url, page_url)

        img_el = container.select_one(img_sel)
        img_url = (img_el.get("src") or img_el.get("data-src")) if img_el else None

        products.append(_make_product(
            supplier_name=supplier_name,
            title=title,
            price=price,
            sku=sku or title[:50],
            product_url=prod_url,
            image_url=img_url,
        ))

    return products


# ── Strategy 5: Claude Haiku AI extraction ───────────────────────────────────

async def _try_ai_extraction(
    html: str, supplier_name: str, page_url: str
) -> tuple[list[dict], Optional[dict]]:
    """
    Use Claude Haiku to extract products and generate reusable CSS selectors.
    Returns (products, css_template_dict | None).
    """
    try:
        import anthropic
        from app.core.config import settings
        if not settings.ANTHROPIC_API_KEY:
            return [], None
    except Exception:
        return [], None

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
        tag.decompose()

    page_text = soup.get_text(separator="\n", strip=True)[:4000]
    html_snippet = str(soup.find("body") or soup)[:5000]

    prompt = f"""You are analyzing a product page from a signage supply company.

URL: {page_url}
Supplier: {supplier_name}

Page text:
{page_text}

HTML snippet:
{html_snippet}

Extract all products. For each product provide:
- title: product name
- sku: product SKU or ID (use title if absent)
- price: numeric USD price (number only, no $ sign)
- in_stock: true/false
- product_url: URL for this product (use page URL if no specific link)
- description: short description if visible

Also identify CSS selectors to reliably extract products from this page:
- container: selector for each product card or row
- title: selector for product name inside container
- price: selector for price inside container
- sku: selector for SKU (null if not available)
- url: selector for product link (usually "a")
- image: selector for product image (usually "img")

Respond ONLY with valid JSON:
{{
  "products": [
    {{"title": "...", "sku": "...", "price": 0.00, "in_stock": true, "product_url": "...", "description": "..."}}
  ],
  "css_template": {{
    "container": "...",
    "title": "...",
    "price": "...",
    "sku": null,
    "url": "a",
    "image": "img"
  }}
}}

If no products are found return {{"products": [], "css_template": null}}."""

    try:
        from app.core.config import settings
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = message.content[0].text.strip()
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            return [], None

        result = json.loads(json_match.group())
        css_template = result.get("css_template")

        products: list[dict] = []
        for p in result.get("products", []):
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
                supplier_name=supplier_name,
                title=title,
                price=price,
                sku=str(p.get("sku", title))[:100],
                product_url=str(p.get("product_url", page_url)),
                in_stock=bool(p.get("in_stock", True)),
                description=str(p.get("description", ""))[:1000],
            ))

        return products, css_template
    except Exception as e:
        print(f"[AI Extraction] {page_url}: {e}")
        return [], None


# ── Public entry point ────────────────────────────────────────────────────────

async def smart_scrape_supplier(
    website_url: str,
    supplier_name: str,
    db=None,  # AsyncSession — used for template read/write
    use_ai: bool = True,
) -> tuple[list[dict], str]:
    """
    Run the full fallback chain against website_url.
    Returns (products, strategy_name).
    strategy_name: "shopify" | "woocommerce" | "json_ld" | "css_template" | "ai" | "failed"
    """
    domain = _domain(website_url)
    base = _base_url(website_url)

    async with httpx.AsyncClient(timeout=30, headers=_FETCH_HEADERS, follow_redirects=True) as client:

        # 1. Shopify
        raw = await _try_shopify(client, base, supplier_name)
        if raw:
            products = filter_signage_products(raw)
            if products:
                return products, "shopify"

        # 2. WooCommerce
        raw = await _try_woocommerce(client, base, supplier_name)
        if raw:
            products = filter_signage_products(raw)
            if products:
                return products, "woocommerce"

        # Fetch HTML for the remaining strategies
        html = await _fetch(client, website_url)
        if not html:
            return [], "failed"

        # 3. JSON-LD
        raw = await _try_json_ld(html, supplier_name, website_url)
        if raw:
            products = filter_signage_products(raw)
            if products:
                return products, "json_ld"

        # 4. Saved CSS template
        if db is not None:
            from sqlalchemy import select, update
            from app.models.local_supplier import ScraperTemplate
            from datetime import datetime

            result = await db.execute(
                select(ScraperTemplate).where(ScraperTemplate.domain == domain)
            )
            tmpl = result.scalar_one_or_none()
            if tmpl and tmpl.template_data:
                raw = await _try_css_template(html, tmpl.template_data, supplier_name, website_url)
                products = filter_signage_products(raw)
                if products:
                    await db.execute(
                        update(ScraperTemplate)
                        .where(ScraperTemplate.id == tmpl.id)
                        .values(
                            success_count=tmpl.success_count + 1,
                            last_used_at=datetime.utcnow(),
                        )
                    )
                    await db.commit()
                    return products, "css_template"

        # 5. AI extraction (only if caller opted in)
        if not use_ai:
            return [], "failed"
        raw, css_template = await _try_ai_extraction(html, supplier_name, website_url)
        products = filter_signage_products(raw)
        if products:
            if css_template and db is not None:
                from sqlalchemy import select
                from app.models.local_supplier import ScraperTemplate
                from datetime import datetime
                import uuid

                result = await db.execute(
                    select(ScraperTemplate).where(ScraperTemplate.domain == domain)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    existing.template_data = css_template
                    existing.strategy = "ai_generated"
                    existing.success_count += 1
                    existing.last_used_at = datetime.utcnow()
                else:
                    db.add(ScraperTemplate(
                        id=str(uuid.uuid4()),
                        domain=domain,
                        strategy="ai_generated",
                        template_data=css_template,
                        success_count=1,
                    ))
                await db.commit()
            return products, "ai"

    return [], "failed"
