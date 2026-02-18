import time

from fastapi import HTTPException, Request

# In-memory store: IP -> (request_count, window_start_timestamp)
_rate_store: dict[str, tuple[int, float]] = {}

RATE_LIMIT = 60  # requests
RATE_WINDOW = 60  # seconds (1 minute)


async def rate_limit(request: Request) -> None:
    """Simple in-memory per-IP rate limiter.

    Allows up to 60 requests per minute per IP address.

    Use as a FastAPI dependency:
        Depends(rate_limit)
    """
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    if client_ip in _rate_store:
        count, window_start = _rate_store[client_ip]

        # If we're still within the current window
        if now - window_start < RATE_WINDOW:
            if count >= RATE_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limit exceeded. Please try again later.",
                )
            _rate_store[client_ip] = (count + 1, window_start)
        else:
            # Window has expired; start a new one
            _rate_store[client_ip] = (1, now)
    else:
        _rate_store[client_ip] = (1, now)
