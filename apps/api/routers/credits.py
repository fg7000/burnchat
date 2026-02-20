import os

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from database import get_supabase
from middleware.auth import get_current_user
from models.schemas import CreditDeductRequest, CreditPurchaseRequest
from services.stripe_client import (
    PACKAGES,
    create_checkout_session,
    ensure_stripe_products,
    verify_webhook,
)

router = APIRouter(tags=["credits"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3001")


@router.get("/credits/balance")
async def get_balance(user: dict = Depends(get_current_user)):
    """Return the authenticated user's current credit balance."""
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

    return {"credit_balance": response.data["credit_balance"]}


@router.get("/credits/history")
async def get_history(user: dict = Depends(get_current_user)):
    """Return the authenticated user's credit transaction history."""
    db = get_supabase()

    response = (
        db.table("credit_transactions")
        .select("*")
        .eq("user_id", user["user_id"])
        .order("created_at", desc=True)
        .execute()
    )

    return {"transactions": response.data or []}


@router.post("/credits/purchase")
async def purchase_credits(body: CreditPurchaseRequest, user: dict = Depends(get_current_user)):
    """Create a Stripe checkout session for the requested credit package."""
    if body.package_id not in PACKAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid package_id. Must be one of: {', '.join(PACKAGES.keys())}",
        )

    package = PACKAGES[body.package_id]
    price_map = ensure_stripe_products()
    price_id = price_map[body.package_id]

    checkout_url = create_checkout_session(
        price_id=price_id,
        user_id=user["user_id"],
        credits_amount=package["credits"],
        package_id=body.package_id,
        success_url=f"{FRONTEND_URL}?payment=success",
        cancel_url=f"{FRONTEND_URL}?payment=cancelled",
    )

    return {"checkout_url": checkout_url}


@router.post("/credits/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None, alias="stripe-signature")):
    """Handle Stripe webhook events.

    The raw body is read directly from the request so that Stripe's
    signature verification works correctly.
    """
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")

    payload = await request.body()

    try:
        event = verify_webhook(payload, stripe_signature)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        user_id = metadata.get("user_id")
        credits_amount = int(metadata.get("credits_amount", 0))
        package_id = metadata.get("package_id", "")
        stripe_payment_id = session.get("payment_intent", session.get("id", ""))

        if user_id and credits_amount > 0:
            db = get_supabase()

            # Fetch current balance
            user_response = (
                db.table("users")
                .select("credit_balance")
                .eq("id", user_id)
                .single()
                .execute()
            )

            if user_response.data:
                current_balance = user_response.data["credit_balance"]
                new_balance = current_balance + credits_amount

                # Update user's credit balance
                db.table("users").update(
                    {"credit_balance": new_balance}
                ).eq("id", user_id).execute()

                # Log the transaction
                db.table("credit_transactions").insert(
                    {
                        "user_id": user_id,
                        "type": "purchase",
                        "amount": credits_amount,
                        "description": f"Purchased {package_id} package ({credits_amount} credits)",
                        "stripe_payment_id": stripe_payment_id,
                        "balance_after": new_balance,
                    }
                ).execute()

    return JSONResponse(content={"received": True}, status_code=200)


@router.post("/credits/deduct")
async def deduct_credits(body: CreditDeductRequest, user: dict = Depends(get_current_user)):
    """Deduct credits from the authenticated user's balance.

    Used internally after model inference completes.
    """
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    db = get_supabase()

    # Fetch current balance
    user_response = (
        db.table("users")
        .select("credit_balance")
        .eq("id", user["user_id"])
        .single()
        .execute()
    )

    if not user_response.data:
        raise HTTPException(status_code=404, detail="User not found")

    current_balance = user_response.data["credit_balance"]

    if current_balance < body.amount:
        raise HTTPException(status_code=402, detail="Insufficient credits")

    new_balance = current_balance - body.amount

    # Update user's credit balance
    db.table("users").update(
        {"credit_balance": new_balance}
    ).eq("id", user["user_id"]).execute()

    # Log the transaction
    db.table("credit_transactions").insert(
        {
            "user_id": user["user_id"],
            "type": "deduction",
            "amount": -body.amount,
            "description": body.description,
            "balance_after": new_balance,
        }
    ).execute()

    return {"credit_balance": new_balance}
