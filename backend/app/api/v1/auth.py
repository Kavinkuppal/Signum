from fastapi import APIRouter

router = APIRouter()


@router.get("/me")
async def me():
    # Placeholder — real auth via NextAuth on the frontend
    return {"user": "demo"}
