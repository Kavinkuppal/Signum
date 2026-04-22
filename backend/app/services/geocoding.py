"""
Geocoding and local business discovery via OpenStreetMap free APIs.

Nominatim: converts zip code / city → lat/lng.
Overpass:  queries OSM for signage-relevant businesses near a coordinate.

Both services require a descriptive User-Agent and respect for rate limits.
Results are cached in-memory per query to avoid redundant requests.
"""

import httpx
import asyncio
import math
import time
from typing import Optional

APP_USER_AGENT = "SignumProcurementPro/1.0 (signumprocurepro@gmail.com)"

# ── In-memory caches ──────────────────────────────────────────────────────────
_geocode_cache: dict[str, tuple[float, float]] = {}
_overpass_cache: dict[str, list[dict]] = {}

# Timestamps of last API calls for rate-limit enforcement
_last_nominatim_call: float = 0.0
_last_overpass_call: float = 0.0

# Nominatim requires >= 1 second between requests per their usage policy.
NOMINATIM_MIN_INTERVAL = 1.1
# Overpass public server: be courteous, allow ~2 seconds between requests.
OVERPASS_MIN_INTERVAL = 2.0

# ── OSM tags that indicate signage-relevant suppliers ─────────────────────────
_SHOP_TAGS = ["trade", "signs", "hardware", "paint", "plastics", "electrical", "metal"]
_CRAFT_TAGS = ["signmaker", "metal_construction"]
_INDUSTRIAL_TAGS = ["distributor"]

# Keywords matched against business name (case-insensitive)
_NAME_KEYWORDS = [
    "sign", "vinyl", "acrylic", "plastic", "aluminum", "aluminium",
    "led", "graphic", "wrap", "banner", "print", "substrate",
    "laminate", "display", "lettering", "neon", "fabricat",
]


async def geocode_location(location: str) -> Optional[tuple[float, float]]:
    """
    Convert a zip code or city name to (lat, lng) using Nominatim.
    Results cached per location string. Rate-limited to 1 req/sec.
    """
    global _last_nominatim_call

    key = location.strip().lower()
    if key in _geocode_cache:
        return _geocode_cache[key]

    elapsed = time.monotonic() - _last_nominatim_call
    if elapsed < NOMINATIM_MIN_INTERVAL:
        await asyncio.sleep(NOMINATIM_MIN_INTERVAL - elapsed)

    params = {"q": location, "format": "json", "limit": 1, "countrycodes": "us,ca"}
    headers = {"User-Agent": APP_USER_AGENT, "Accept-Language": "en"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            _last_nominatim_call = time.monotonic()
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            if data:
                coords = (float(data[0]["lat"]), float(data[0]["lon"]))
                _geocode_cache[key] = coords
                return coords
    except Exception as e:
        print(f"[Geocoding] Nominatim error for '{location}': {e}")

    return None


async def find_nearby_suppliers(
    lat: float,
    lng: float,
    radius_km: float = 80.0,
) -> list[dict]:
    """
    Query Overpass API for signage-relevant businesses within radius_km of
    (lat, lng). Results are cached per rounded coordinate + radius.
    """
    global _last_overpass_call

    cache_key = f"{lat:.2f},{lng:.2f},{radius_km:.0f}"
    if cache_key in _overpass_cache:
        return _overpass_cache[cache_key]

    elapsed = time.monotonic() - _last_overpass_call
    if elapsed < OVERPASS_MIN_INTERVAL:
        await asyncio.sleep(OVERPASS_MIN_INTERVAL - elapsed)

    radius_m = int(radius_km * 1000)
    coord = f"{lat},{lng}"

    shop_filter = "|".join(_SHOP_TAGS)
    craft_filter = "|".join(_CRAFT_TAGS)
    industrial_filter = "|".join(_INDUSTRIAL_TAGS)
    name_filter = "|".join(_NAME_KEYWORDS)

    query = f"""
[out:json][timeout:30];
(
  nwr["shop"~"{shop_filter}"](around:{radius_m},{coord});
  nwr["craft"~"{craft_filter}"](around:{radius_m},{coord});
  nwr["industrial"~"{industrial_filter}"](around:{radius_m},{coord});
  nwr["name"~"{name_filter}",i]["name"](around:{radius_m},{coord});
);
out body center;
""".strip()

    headers = {"User-Agent": APP_USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            _last_overpass_call = time.monotonic()
            resp = await client.post(
                "https://overpass-api.de/api/interpreter",
                data={"data": query},
                headers=headers,
            )
            resp.raise_for_status()
            elements = resp.json().get("elements", [])
    except Exception as e:
        print(f"[Overpass] Query error: {e}")
        return []

    results: list[dict] = []
    seen: set[str] = set()

    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        if not name:
            continue

        # Deduplicate by normalised name
        name_key = name.lower()
        if name_key in seen:
            continue
        seen.add(name_key)

        # Coordinates — nodes have lat/lon directly; ways/relations provide center
        if el["type"] == "node":
            el_lat, el_lng = el.get("lat"), el.get("lon")
        else:
            center = el.get("center", {})
            el_lat, el_lng = center.get("lat"), center.get("lon")

        if el_lat is None or el_lng is None:
            continue

        address = _build_address(tags)
        dist = _haversine(lat, lng, el_lat, el_lng)
        categories = _infer_categories(tags, name)
        website = _normalise_url(tags.get("website") or tags.get("contact:website"))

        results.append({
            "osm_id": str(el.get("id", "")),
            "osm_type": el["type"],
            "name": name,
            "address": address,
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "website": website,
            "lat": el_lat,
            "lng": el_lng,
            "distance_km": round(dist, 2),
            "osm_tags": tags,
            "material_categories": categories,
        })

    results.sort(key=lambda r: r["distance_km"])
    _overpass_cache[cache_key] = results
    return results


# ── Helpers ───────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _normalise_url(url: str | None) -> str | None:
    if not url:
        return None
    url = url.strip()
    if url and not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url or None


def _build_address(tags: dict) -> str | None:
    parts = [
        tags.get("addr:housenumber", ""),
        tags.get("addr:street", ""),
        tags.get("addr:city", ""),
        tags.get("addr:state", ""),
        tags.get("addr:postcode", ""),
    ]
    return ", ".join(p for p in parts if p) or None


def _infer_categories(tags: dict, name: str) -> list[str]:
    cats: set[str] = set()
    text = (name + " " + " ".join(str(v) for v in tags.values())).lower()

    if any(k in text for k in ["vinyl", "wrap film", "adhesive film", "cast film"]):
        cats.add("Vinyl")
    if any(k in text for k in ["acrylic", "plexiglass", "plexiglas"]):
        cats.add("Acrylic")
    if any(k in text for k in ["aluminum", "aluminium", "metal", "steel", "fabricat"]):
        cats.add("Aluminum")
    if any(k in text for k in ["led", "neon", "lighting", "electrical"]):
        cats.add("LED")
    if any(k in text for k in ["plastic", "pvc", "foam board", "substrate", "coroplast"]):
        cats.add("Substrate")
    if any(k in text for k in ["hardware", "fastener", "standoff", "bracket"]):
        cats.add("Hardware")
    if any(k in text for k in ["ink", "toner"]):
        cats.add("Ink")
    if any(k in text for k in ["laminate", "overlaminate"]):
        cats.add("Laminate")

    # Sign/trade shops without more specific categories default to core materials
    if not cats:
        shop_val = tags.get("shop", "")
        craft_val = tags.get("craft", "")
        if shop_val in ("signs", "trade") or craft_val == "signmaker":
            cats = {"Vinyl", "Substrate", "Hardware"}

    return sorted(cats)


def compute_rank_score(
    biz: dict,
    priority: str,
    material_interests: list[str],
    radius_km: float,
) -> float:
    """
    Score 0–100 combining distance, category overlap, data completeness,
    and user priority preference.
    """
    score = 0.0
    dist = biz.get("distance_km", radius_km)

    # Distance: closer = higher score (up to 40 pts)
    proximity = max(0.0, 1.0 - dist / radius_km)
    dist_pts = proximity * 40
    score += dist_pts

    # Category match (up to 40 pts)
    biz_cats = set(biz.get("material_categories") or [])
    user_cats = set(material_interests)
    if user_cats and biz_cats:
        overlap = len(biz_cats & user_cats) / len(user_cats)
        score += overlap * 40
    elif biz_cats:
        score += 20  # has categories but user has no preference set

    # Data completeness bonuses
    if biz.get("website"):
        score += 10
    if biz.get("phone"):
        score += 5
    if biz.get("address"):
        score += 5

    # Priority modifier
    if priority == "local":
        score += dist_pts * 0.5  # extra weight on proximity
    elif priority == "speed":
        score += 5.0 if dist < 20 else 0.0

    return round(min(score, 100.0), 2)
