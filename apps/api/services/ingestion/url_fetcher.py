import re

import httpx
from lxml.html.clean import Cleaner
from readability import Document

MAX_CONTENT_SIZE = 10 * 1024 * 1024  # 10 MB
TIMEOUT = 30.0
USER_AGENT = (
    "Mozilla/5.0 (compatible; BurnChatBot/1.0; +https://burnchat.ai)"
)

GDRIVE_PATTERN = re.compile(
    r"https?://(?:docs|drive)\.google\.com/"
)

GDOCS_DOC_PATTERN = re.compile(
    r"https?://docs\.google\.com/document/d/([^/]+)"
)
GDOCS_SHEET_PATTERN = re.compile(
    r"https?://docs\.google\.com/spreadsheets/d/([^/]+)"
)
GDOCS_SLIDES_PATTERN = re.compile(
    r"https?://docs\.google\.com/presentation/d/([^/]+)"
)
GDRIVE_FOLDER_PATTERN = re.compile(
    r"https?://drive\.google\.com/drive/folders/"
)


def is_gdrive_url(url: str) -> bool:
    """Return True if *url* points to Google Drive or Google Docs."""
    return bool(GDRIVE_PATTERN.match(url))


def is_gdrive_folder(url: str) -> bool:
    """Return True if *url* points to a Google Drive folder."""
    return bool(GDRIVE_FOLDER_PATTERN.match(url))


def get_google_export_url(url: str) -> str | None:
    """Convert a Google Docs/Sheets/Slides URL to its text export URL.
    
    Returns None if the URL is not a recognized Google document,
    or if it's already an export URL.
    """
    # Already an export URL — use as-is
    if "/export?" in url:
        return url

    m = GDOCS_DOC_PATTERN.search(url)
    if m:
        return f"https://docs.google.com/document/d/{m.group(1)}/export?format=txt"

    m = GDOCS_SHEET_PATTERN.search(url)
    if m:
        return f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv"

    m = GDOCS_SLIDES_PATTERN.search(url)
    if m:
        return f"https://docs.google.com/presentation/d/{m.group(1)}/export?format=txt"

    return None


async def fetch_url(url: str) -> dict:
    """Fetch a URL and return its readable text content.

    For Google Docs/Sheets/Slides, automatically converts to export URL.
    For Google Drive folders, returns empty text with source_type "gdrive"
    so the caller can redirect to the folder ingestion endpoint.

    Returns:
        A dict with keys ``text``, ``source_type``, and ``title``.
    """
    # Google Drive folders -> redirect to folder endpoint
    if is_gdrive_folder(url):
        return {
            "text": "",
            "source_type": "gdrive",
            "title": "",
        }

    # Google Docs/Sheets/Slides -> convert to export URL and fetch as plain text
    export_url = get_google_export_url(url) if is_gdrive_url(url) else None

    if export_url:
        async with httpx.AsyncClient(
            timeout=TIMEOUT,
            follow_redirects=True,
            max_redirects=5,
        ) as client:
            response = await client.get(
                export_url,
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            text = response.text.strip()

        return {
            "text": text,
            "source_type": "gdocs",
            "title": "",
        }

    # Regular web page
    async with httpx.AsyncClient(
        timeout=TIMEOUT,
        follow_redirects=True,
        max_redirects=5,
    ) as client:
        response = await client.get(
            url,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()

        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_CONTENT_SIZE:
            raise ValueError(
                f"Content too large: {content_length} bytes "
                f"(max {MAX_CONTENT_SIZE})"
            )

        raw_html = response.text
        if len(raw_html.encode("utf-8", errors="replace")) > MAX_CONTENT_SIZE:
            raise ValueError(
                f"Downloaded content exceeds {MAX_CONTENT_SIZE} bytes"
            )

    doc = Document(raw_html)
    title = doc.title() or ""

    summary_html = doc.summary()
    cleaner = Cleaner(
        scripts=True,
        javascript=True,
        style=True,
        comments=True,
        page_structure=False,
        remove_unknown_tags=False,
        safe_attrs_only=True,
    )
    from lxml.html import fromstring, tostring

    cleaned_element = cleaner.clean_html(fromstring(summary_html))
    text = cleaned_element.text_content().strip()

    return {
        "text": text,
        "source_type": "web",
        "title": title,
    }
