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


def is_gdrive_url(url: str) -> bool:
    """Return True if *url* points to Google Drive or Google Docs."""
    return bool(GDRIVE_PATTERN.match(url))


async def fetch_url(url: str) -> dict:
    """Fetch a URL and return its readable text content.

    Returns:
        A dict with keys ``text``, ``source_type``, and ``title``.

    Raises:
        httpx.HTTPStatusError: on 4xx / 5xx responses.
        ValueError: when the response body exceeds *MAX_CONTENT_SIZE*.
    """
    if is_gdrive_url(url):
        return {
            "text": "",
            "source_type": "gdrive",
            "title": "",
        }

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

    # Extract the simplified HTML, then strip remaining tags to get plain text.
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
