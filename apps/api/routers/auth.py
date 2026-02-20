import json as json_module
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

    if error:
        return RedirectResponse(url=f"/app?auth_error={error}")

    if not code:
        return RedirectResponse(url="/app?auth_error=missing_code")

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
        return RedirectResponse(url="/app?auth_error=token_exchange_failed")

    tokens = token_response.json()
    access_token = tokens.get("access_token")
    if not access_token:
        return RedirectResponse(url="/app?auth_error=no_access_token")

    # Fetch user info from Google
    async with httpx.AsyncClient() as client:
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_response.status_code != 200:
        return RedirectResponse(url="/app?auth_error=userinfo_failed")

    google_user = userinfo_response.json()
    google_id = google_user.get("id")
    email = google_user.get("email")

    if not google_id or not email:
        return RedirectResponse(url="/app?auth_error=invalid_user_data")

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

    # Issue JWT and return a self-contained HTML page.
    # We do NOT redirect because proxy/tunnel environments may cache or
    # misroute 302 responses.  Instead the page stores the auth data in
    # localStorage and navigates to "/" via JavaScript, which the main app
    # picks up on mount.
    token = _issue_jwt(user_id, email)
    credit_balance = user.get("credit_balance", NEW_USER_BONUS_CREDITS)

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signing in…</title></head>
<body style="background:#030712;color:#9ca3af;display:flex;align-items:center;
justify-content:center;height:100vh;margin:0;font-family:sans-serif">
<div style="text-align:center">
<div style="width:32px;height:32px;border:2px solid #d1d5db;border-top-color:transparent;
border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
<p>Signing you in…</p>
</div>
<style>@keyframes spin{{from{{transform:rotate(0)}}to{{transform:rotate(360deg)}} }}</style>
<script>
try {{
  var auth = {{
    token: {json_module.dumps(token)},
    user_id: {json_module.dumps(user_id)},
    email: {json_module.dumps(email)},
    credit_balance: {json_module.dumps(credit_balance)}
  }};
  localStorage.setItem("burnchat_auth", JSON.stringify(auth));
}} catch(e) {{}}
// If inside a popup opened by the main app, notify and close
if (window.opener) {{
  try {{
    window.opener.postMessage({{ type: "burnchat_auth", auth: auth }}, "*");
  }} catch(e) {{}}
  setTimeout(function() {{ window.close(); }}, 300);
}} else {{
  window.location.replace("/");
}}
</script>
</body></html>"""
    return HTMLResponse(content=html)


@router.post("/auth/google-code")
async def google_code_login(request: Request):
    """Client-side Google Sign-In via authorization code.

    The frontend uses google.accounts.oauth2.initCodeClient() to get an
    authorization code in a Google-managed popup (no redirects). The code
    is POSTed here and exchanged for tokens using redirect_uri='postmessage'.
    """
    body = await request.json()
    code = body.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    # Exchange authorization code for tokens (redirect_uri='postmessage' for
    # codes obtained via the JS library's popup flow)
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": "postmessage",
            },
        )

    if token_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Token exchange failed")

    tokens = token_response.json()
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="No access token")

    # Fetch user info from Google
    async with httpx.AsyncClient() as client:
        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if userinfo_response.status_code != 200:
        raise HTTPException(status_code=401, detail="User info fetch failed")

    google_user = userinfo_response.json()
    google_id = google_user.get("id")
    email = google_user.get("email")

    if not google_id or not email:
        raise HTTPException(status_code=401, detail="Invalid user data")

    # Create or find user in Supabase
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
    credit_balance = user.get("credit_balance", NEW_USER_BONUS_CREDITS)
    return {"token": token, "user_id": user_id, "email": email, "credit_balance": credit_balance}


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
