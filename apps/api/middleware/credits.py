from fastapi import Depends, HTTPException

from database import get_supabase
from middleware.auth import get_current_user


async def check_credits(user: dict = Depends(get_current_user)) -> dict:
    """Verify the authenticated user has a positive credit balance.

    Returns the user dict enriched with ``credit_balance``.

    Use as a FastAPI dependency:
        user = Depends(check_credits)
    """
    db = get_supabase()

    response = (
        db.table("users")
        .select("credit_balance")
        .eq("id", user["user_id"])
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")

    balance = response.data["credit_balance"]

    if balance <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    return {**user, "credit_balance": balance}
