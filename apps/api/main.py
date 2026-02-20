import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(_env_path, override=True)

from routers import anonymize, ingest, chat, documents, sessions, models, auth, credits
from database import init_database

# Path to the Next.js static export
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "web" / "out"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    yield


app = FastAPI(title="BurnChat API", version="1.0.0", lifespan=lifespan)

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
if FRONTEND_DIR.is_dir():
    # Serve Next.js static assets (_next/static/...)
    _next_dir = FRONTEND_DIR / "_next"
    if _next_dir.is_dir():
        app.mount("/_next", StaticFiles(directory=str(_next_dir)), name="next-static")

    # Redirect root to the app entry point (bypasses stale proxy cache on /)
    @app.get("/")
    async def root_redirect():
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/app")

    # Main app entry point at /app (fresh path, no proxy cache)
    @app.get("/app")
    async def app_page():
        return FileResponse(str(FRONTEND_DIR / "index.html"))

    # Serve known page routes as their HTML files
    @app.get("/auth/callback")
    async def auth_callback_page():
        return FileResponse(str(FRONTEND_DIR / "auth" / "callback.html"))

    @app.get("/privacy")
    async def privacy_page():
        return FileResponse(str(FRONTEND_DIR / "privacy.html"))

    # Serve other static files in the out/ root (favicon.ico, pdf.worker, etc.)
    @app.get("/{filepath:path}")
    async def serve_frontend(filepath: str):
        # Try exact file first
        file_path = FRONTEND_DIR / filepath
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Try with .html extension (Next.js static export pattern)
        html_path = FRONTEND_DIR / f"{filepath}.html"
        if html_path.is_file():
            return FileResponse(str(html_path))
        # Fallback to index.html for client-side routing
        return FileResponse(str(FRONTEND_DIR / "index.html"))
