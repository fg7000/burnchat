"""Async wrapper around the OpenRouter API.

Provides helpers for listing models, streaming chat completions, and
creating embeddings.  Model metadata is cached for one hour to reduce
redundant network calls.
"""

import os
import time
from pathlib import Path
from typing import AsyncGenerator

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# Simple in-memory cache: {"data": [...], "fetched_at": <epoch>}
_models_cache: dict = {}
_CACHE_TTL_SECONDS = 3600  # 1 hour


def _headers() -> dict[str, str]:
    """Return common request headers for OpenRouter."""
    return {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://burnchat.ai",
        "X-Title": "BurnChat",
        "Content-Type": "application/json",
    }


async def fetch_models() -> list[dict]:
    """Fetch the list of available models from OpenRouter.

    Results are cached in memory for one hour.  Subsequent calls within
    the TTL return the cached list without making a network request.

    Returns
    -------
    list[dict]
        A list of model metadata dicts as returned by OpenRouter's
        ``GET /models`` endpoint.
    """
    now = time.time()

    if (
        _models_cache.get("data") is not None
        and now - _models_cache.get("fetched_at", 0) < _CACHE_TTL_SECONDS
    ):
        return _models_cache["data"]

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/models",
            headers=_headers(),
        )
        response.raise_for_status()
        data = response.json()

    models = data.get("data", [])
    _models_cache["data"] = models
    _models_cache["fetched_at"] = now
    return models


async def chat_completion(
    model: str,
    messages: list[dict],
    stream: bool = True,
) -> AsyncGenerator[str, None]:
    """Stream (or fetch) a chat completion from OpenRouter.

    Parameters
    ----------
    model:
        The OpenRouter model identifier (e.g. ``"openai/gpt-4o"``).
    messages:
        A list of message dicts with ``role`` and ``content`` keys.
    stream:
        Whether to stream the response.  Defaults to ``True``.

    Yields
    ------
    str
        Individual content chunks from the completion stream.  When
        *stream* is ``False`` the entire response content is yielded as a
        single string.
    """
    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
    }

    if stream:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{BASE_URL}/chat/completions",
                headers=_headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[len("data: "):]
                    if data_str.strip() == "[DONE]":
                        break
                    import json

                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    choices = chunk.get("choices", [])
                    if choices:
                        delta = choices[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
    else:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{BASE_URL}/chat/completions",
                headers=_headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices", [])
        if choices:
            content = choices[0].get("message", {}).get("content", "")
            if content:
                yield content


async def create_embedding(texts: list[str]) -> list[list[float]]:
    """Create embeddings for a list of texts via OpenRouter.

    Parameters
    ----------
    texts:
        The input texts to embed.

    Returns
    -------
    list[list[float]]
        A list of embedding vectors, one per input text.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BASE_URL}/embeddings",
            headers=_headers(),
            json={
                "model": "openai/text-embedding-3-small",
                "input": texts,
            },
        )
        response.raise_for_status()
        data = response.json()

    sorted_embeddings = sorted(data["data"], key=lambda x: x["index"])
    return [item["embedding"] for item in sorted_embeddings]
