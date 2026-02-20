import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

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
    upserts the user in Supabase, and returns an inline HTML page that
    stores the JWT in localStorage and redirects to /app.
    """

    def _error_html(msg: str) -> HTMLResponse:
        """Return an inline HTML error page that redirects to /app with the error."""
        html = f"""<!DOCTYPE html><html><head><title>Sign-in error</title></head>
<body style="background:#030712;color:#9ca3af;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif">
<p>Sign-in failed: {msg}. Redirecting…</p>
<script>window.location.replace('/app');</script></body></html>"""
        return HTMLResponse(content=html)

    if error:
        return _error_html(error)

    if not code:
        return _error_html("missing_code")

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
        return _error_html("token_exchange_failed")

    tokens = token_response.json()
    access_token = tokens.get("access_token")
    if not access_token:
        return _error_html("no_access_token")

    # Fetch user info from Google
    async with httpx.AsyncClient() as client:
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_response.status_code != 200:
        return _error_html("userinfo_failed")

    google_user = userinfo_response.json()
    google_id = google_user.get("id")
    email = google_user.get("email")

    if not google_id or not email:
        return _error_html("invalid_user_data")

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

    # Issue JWT and hand off to the frontend.
    # Return an inline HTML page that stores the token in localStorage and
    # redirects client-side.  This avoids a server redirect to /auth/callback
    # which can 404 behind web-IDE proxies / tunnels.
    token = _issue_jwt(user_id, email)
    html = f"""<!DOCTYPE html><html><head><title>Signing you in…</title></head>
<body style="background:#030712;color:#9ca3af;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif">
<p>Signing you in…</p>
<script>
try {{ localStorage.setItem('pending_auth_token', '{token}'); }} catch(e) {{}}
window.location.replace('/app');
</script></body></html>"""
    return HTMLResponse(content=html)


@router.post("/auth/google-token")
async def google_token_login(request: Request):
    """Client-side Google Sign-In: verify a Google ID token and return a JWT.

    This avoids the redirect-based OAuth flow which breaks behind web-IDE proxies.
    The frontend uses Google Identity Services to get a credential (ID token)
    and POSTs it here.
    """
    body = await request.json()
    credential = body.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing credential")

    # Verify the Google ID token via Google's tokeninfo endpoint
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    info = resp.json()

    # Verify the token was issued for our app
    if info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Token audience mismatch")

    google_id = info.get("sub")
    email = info.get("email")
    if not google_id or not email:
        raise HTTPException(status_code=401, detail="Missing user info in token")

    # Upsert user in Supabase (same logic as redirect flow)
    db = get_supabase()
    existing = (
        db.table("users")
        .select("id, email, credit_balance")
        .eq("google_id", google_id)
        .execute()
    )

    if existing.data and len(existing.data) > 0:
        user = existing.data[0]
        user_id = user["id"]
    else:
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

        db.table("credit_transactions").insert(
            {
                "user_id": user_id,
                "type": "bonus",
                "amount": NEW_USER_BONUS_CREDITS,
                "description": "Welcome bonus credits",
                "balance_after": NEW_USER_BONUS_CREDITS,
            }
        ).execute()

    token = _issue_jwt(user_id, email)
    return {"token": token}


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
