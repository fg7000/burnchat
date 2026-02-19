import os
import re
from typing import Optional

import httpx
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
load_dotenv(_env_path, override=True)

GDRIVE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GDRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
TIMEOUT = 30.0

FOLDER_ID_PATTERN = re.compile(r"/folders/([a-zA-Z0-9_-]+)")

GOOGLE_DOCS_MIME = "application/vnd.google-apps.document"
GOOGLE_SHEETS_MIME = "application/vnd.google-apps.spreadsheet"
GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation"

# Google Workspace types that support export.
EXPORT_MIME_MAP: dict[str, str] = {
    GOOGLE_DOCS_MIME: "text/plain",
    GOOGLE_SHEETS_MIME: "text/csv",
    GOOGLE_SLIDES_MIME: "text/plain",
}


def extract_gdrive_folder_id(url: str) -> str:
    """Extract the folder ID from a Google Drive folder URL.

    Raises:
        ValueError: when the URL does not contain a recognisable folder ID.
    """
    match = FOLDER_ID_PATTERN.search(url)
    if not match:
        raise ValueError(f"Could not extract folder ID from URL: {url}")
    return match.group(1)


async def list_folder_files(folder_id: str) -> list[dict]:
    """List files inside a public/shared Google Drive folder.

    Returns a list of dicts, each with keys ``id``, ``name``, and
    ``mimeType``.
    """
    all_files: list[dict] = []
    page_token: Optional[str] = None

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        while True:
            params: dict = {
                "q": f"'{folder_id}' in parents and trashed = false",
                "key": GDRIVE_API_KEY,
                "fields": "nextPageToken, files(id, name, mimeType, size)",
                "pageSize": 100,
            }
            if page_token:
                params["pageToken"] = page_token

            response = await client.get(GDRIVE_FILES_URL, params=params)
            response.raise_for_status()
            data = response.json()

            all_files.extend(data.get("files", []))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    return all_files


async def fetch_gdrive_file(file_id: str, mime_type: str) -> str:
    """Download or export a single Google Drive file as text.

    For Google Workspace documents (Docs, Sheets, Slides) the file is
    exported via the export endpoint.  For all other types (PDF, plain
    text, etc.) the file is downloaded directly and decoded as UTF-8.

    Returns:
        The file contents as a string.
    """
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        if mime_type in EXPORT_MIME_MAP:
            export_mime = EXPORT_MIME_MAP[mime_type]
            url = f"{GDRIVE_FILES_URL}/{file_id}/export"
            response = await client.get(
                url,
                params={
                    "mimeType": export_mime,
                    "key": GDRIVE_API_KEY,
                },
            )
        else:
            url = f"{GDRIVE_FILES_URL}/{file_id}"
            response = await client.get(
                url,
                params={
                    "alt": "media",
                    "key": GDRIVE_API_KEY,
                },
            )

        response.raise_for_status()

        # For binary formats, attempt a UTF-8 decode; fall back to
        # latin-1 so we never crash on non-text files.
        try:
            return response.text
        except UnicodeDecodeError:
            return response.content.decode("latin-1")
