from fastapi import Header, HTTPException


async def get_current_user_id(x_user_email: str = Header(None)) -> str:
    if not x_user_email:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return x_user_email
