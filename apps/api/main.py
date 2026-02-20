import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(_env_path, override=True)

from routers import anonymize, ingest, chat, documents, sessions, models, auth, credits
from database import init_database

# Path to the Next.js static export
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "web" / "out"

_REQ_LOG = Path("/tmp/requests.log")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    yield


app = FastAPI(title="BurnChat API", version="1.0.0", lifespan=lifespan)


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Log every request to /tmp/requests.log for debugging."""
    async def dispatch(self, request: Request, call_next):
        ts = datetime.now(timezone.utc).isoformat()
        line = f"[{ts}] {request.method} {request.url.path}?{request.url.query} from {request.client.host if request.client else '?'}\n"
        with open(_REQ_LOG, "a") as f:
            f.write(line)
            f.flush()
        response = await call_next(request)
        with open(_REQ_LOG, "a") as f:
            f.write(f"  -> {response.status_code}\n")
            f.flush()
        return response


class NoCacheMiddleware(BaseHTTPMiddleware):
    """Force no-cache on every response to prevent stale JS in proxy/browser."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


app.add_middleware(RequestLogMiddleware)
app.add_middleware(NoCacheMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(anonymize.router, prefix="/api")
app.include_router(ingest.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(credits.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


# --- Serve the Next.js static export ---

NO_CACHE_HEADERS = {"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}


def _html_response(file_path: str) -> Response:
    """Serve an HTML file with no-cache headers to prevent proxy caching."""
    return FileResponse(str(file_path), headers=NO_CACHE_HEADERS)


if FRONTEND_DIR.is_dir():
    # Serve Next.js static assets (_next/static/...)
    _next_dir = FRONTEND_DIR / "_next"
    if _next_dir.is_dir():
        app.mount("/_next", StaticFiles(directory=str(_next_dir)), name="next-static")

    @app.get("/")
    async def root_redirect():
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/app")

    @app.get("/app")
    async def app_page():
        return _html_response(FRONTEND_DIR / "index.html")

    @app.get("/auth/callback")
    async def auth_callback_page():
        return _html_response(FRONTEND_DIR / "auth" / "callback.html")

    @app.get("/privacy")
    async def privacy_page():
        return _html_response(FRONTEND_DIR / "privacy.html")

    @app.get("/{filepath:path}")
    async def serve_frontend(filepath: str):
        file_path = FRONTEND_DIR / filepath
        if file_path.is_file():
            return FileResponse(str(file_path))
        html_path = FRONTEND_DIR / f"{filepath}.html"
        if html_path.is_file():
            return _html_response(html_path)
        return _html_response(FRONTEND_DIR / "index.html")
