from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
import re

router = APIRouter()

MODEL = "claude-haiku-4-5-20251001"

CATEGORIES = [
    "Vinyl", "Aluminum", "LED", "Substrate", "Hardware",
    "Ink", "Laminate", "Foam Board", "Coroplast", "Acrylic", "Banner",
]

UNITS = ["rolls", "sheets", "units", "ft", "ft²", "lbs", "boxes", "packs"]


def _client():
    from app.core.config import settings
    import anthropic
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI features not configured.")
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def _extract_json(text: str) -> dict | list:
    match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON found in AI response")
    return json.loads(match.group())


# ── Natural language → search filters ────────────────────────────────────────

class SearchInterpretRequest(BaseModel):
    query: str


class SearchInterpretResponse(BaseModel):
    search: Optional[str] = None
    material_category: Optional[str] = None
    brand: Optional[str] = None
    color: Optional[str] = None
    finish: Optional[str] = None
    in_stock: Optional[bool] = None
    interpreted: str  # human-readable summary of what was understood


@router.post("/interpret-search", response_model=SearchInterpretResponse)
async def interpret_search(body: SearchInterpretRequest):
    """
    Convert a natural language query into structured search filters.
    E.g. "matte black vehicle wrap for a pickup" →
         {material_category: "Vinyl", color: "Black", finish: "Matte", search: "vehicle wrap"}
    """
    prompt = f"""You are a signage material procurement assistant for a sign shop platform.
Convert the user's natural language query into structured search filters.

Available material categories: {", ".join(CATEGORIES)}
Finishes: Matte, Gloss, Satin, Brushed, Mill

User query: "{body.query}"

Return ONLY valid JSON — no explanation:
{{
  "search": "concise keyword(s) to search product titles (null if not needed)",
  "material_category": "one of the listed categories or null",
  "brand": "specific brand name or null",
  "color": "color name or null",
  "finish": "Matte|Gloss|Satin|Brushed|Mill or null",
  "in_stock": true or null,
  "interpreted": "one sentence summarising what you understood"
}}"""

    client = _client()
    msg = await client.messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    result = _extract_json(msg.content[0].text)
    return SearchInterpretResponse(**result)


# ── Job description → BOM materials list ─────────────────────────────────────

class ParseBOMRequest(BaseModel):
    description: str


class MaterialSuggestion(BaseModel):
    material_name: str
    quantity: float
    unit: str


class ParseBOMResponse(BaseModel):
    materials: list[MaterialSuggestion]
    summary: str  # brief explanation of what was extracted


@router.post("/parse-bom", response_model=ParseBOMResponse)
async def parse_bom(body: ParseBOMRequest):
    """
    Convert a job description into a list of signage materials with quantities.
    E.g. "outdoor banner for a pizza shop, 4x8 feet" →
         [{material_name: "Vinyl banner media", quantity: 1, unit: "sheets"}, ...]
    """
    prompt = f"""You are a signage material procurement assistant for a sign shop.
Given a job description, list the signage materials needed to complete the job.

Only include materials relevant to sign making:
- Vinyl films and wraps
- Aluminum blanks or composite panels
- Substrates (Sintra, foam board, Coroplast)
- Laminates / overlaminates
- LED modules or strips
- Hardware (standoffs, channel caps, brackets)
- Inks
- Banner media / mesh

Valid units: {", ".join(UNITS)}

Job description: "{body.description}"

Return ONLY valid JSON — no explanation:
{{
  "materials": [
    {{"material_name": "...", "quantity": 1.0, "unit": "..."}},
    ...
  ],
  "summary": "one sentence describing what you understood about this job"
}}

If the description has nothing to do with signage, return {{"materials": [], "summary": "Could not identify signage materials from this description."}}"""

    client = _client()
    msg = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    result = _extract_json(msg.content[0].text)
    return ParseBOMResponse(**result)
