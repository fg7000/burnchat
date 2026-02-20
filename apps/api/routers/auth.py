import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from database import get_supabase
from middleware.auth import get_current_user

router = APIRouter(tags=["auth"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_SCOPES = "email profile openid"

NEW_USER_BONUS_CREDITS = 50


def _build_base_url(request: Request) -> str:
    """Derive the public base URL from the incoming request headers."""
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.hostname)
    port = request.url.port
    # Include port only for local development (non-standard ports)
    if port and port not in (80, 443):
        return f"{scheme}://{host}:{port}"
    return f"{scheme}://{host}"


def _build_redirect_uri(request: Request) -> str:
    """Build the OAuth callback URI based on the incoming request host."""
    return f"{_build_base_url(request)}/api/auth/callback"


def _issue_jwt(user_id: str, email: str) -> str:
    """Create a signed JWT for the given user."""
    payload = {
        "user_id": user_id,
        "email": email,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@router.get("/auth/google")
async def google_login(request: Request):
    """Redirect the user to Google's OAuth consent screen."""
    redirect_uri = _build_redirect_uri(request)
    params = urlencode(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": GOOGLE_SCOPES,
            "access_type": "offline",
            "prompt": "consent",
        }
    )
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{params}")


@router.get("/auth/callback")
async def google_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None):
    """Handle Google's OAuth callback.

    Exchanges the authorization code for tokens, fetches user info,
    upserts the user in Supabase, and redirects to the frontend with a JWT.
    """
    # Derive frontend URL from the request so it works behind tunnels/proxies
    frontend_base = _build_base_url(request)

    if error:
        return RedirectResponse(url=f"{frontend_base}/auth/callback?error={error}")

    if not code:
        return RedirectResponse(url=f"{frontend_base}/auth/callback?error=missing_code")

    redirect_uri = _build_redirect_uri(request)

    # Exchange authorization code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )

    if token_response.status_code != 200:
        return RedirectResponse(url=f"{frontend_base}/auth/callback?error=token_exchange_failed")

    tokens = token_response.json()
    access_token = tokens.get("access_token")
    if not access_token:
        return RedirectResponse(url=f"{frontend_base}/auth/callback?error=no_access_token")

    # Fetch user info from Google
    async with httpx.AsyncClient() as client:
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_response.status_code != 200:
        return RedirectResponse(url=f"{frontend_base}/auth/callback?error=userinfo_failed")

    google_user = userinfo_response.json()
    google_id = google_user.get("id")
    email = google_user.get("email")

    if not google_id or not email:
        return RedirectResponse(url=f"{frontend_base}/auth/callback?error=invalid_user_data")

    # Create or find user in Supabase
    db = get_supabase()
    existing = (
        db.table("users")
        .select("id, email, credit_balance")
        .eq("google_id", google_id)
        .execute()
    )

    if existing.data and len(existing.data) > 0:
        # Existing user
        user = existing.data[0]
        user_id = user["id"]
    else:
        # New user - create with bonus credits
        insert_result = (
            db.table("users")
            .insert(
                {
                    "google_id": google_id,
                    "email": email,
                    "credit_balance": NEW_USER_BONUS_CREDITS,
                }
            )
            .execute()
        )
        user = insert_result.data[0]
        user_id = user["id"]

        # Log the bonus credit transaction
        db.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "type": "bonus",
                "amount": NEW_USER_BONUS_CREDITS,
                "description": "Welcome bonus credits",
                "balance_after": NEW_USER_BONUS_CREDITS,
            }
        ).execute()

    # Issue JWT and redirect to frontend
    token = _issue_jwt(user_id, email)
    return RedirectResponse(url=f"{frontend_base}/auth/callback?token={token}")


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Return the current authenticated user's info including credit balance."""
    db = get_supabase()

    response = (
        db.table("users")
        .select("id, email, credit_balance")
        .eq("id", user["user_id"])
        .single()
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": response.data["id"],
        "email": response.data["email"],
        "credit_balance": response.data["credit_balance"],
    }
