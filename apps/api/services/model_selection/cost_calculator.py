"""Credit estimation for LLM API calls.

Maintains hardcoded fallback pricing for supported models and provides
functions to look up per-token costs and convert them into BurnChat credits.
"""

import math

# Hardcoded fallback pricing (USD per 1 million tokens).
# Updated periodically from OpenRouter's /models endpoint.
MODEL_PRICING: dict[str, dict[str, float]] = {
    "openai/gpt-4o-mini": {
        "prompt_per_million": 0.15,
        "completion_per_million": 0.60,
    },
    "openai/gpt-4o": {
        "prompt_per_million": 2.50,
        "completion_per_million": 10.00,
    },
    "anthropic/claude-sonnet-4-5-20250929": {
        "prompt_per_million": 3.00,
        "completion_per_million": 15.00,
    },
    "anthropic/claude-opus-4-6": {
        "prompt_per_million": 15.00,
        "completion_per_million": 75.00,
    },
    "google/gemini-2.0-flash-001": {
        "prompt_per_million": 0.10,
        "completion_per_million": 0.40,
    },
    "google/gemini-2.5-pro-preview-03-25": {
        "prompt_per_million": 1.25,
        "completion_per_million": 10.00,
    },
    "meta-llama/llama-3.3-70b-instruct": {
        "prompt_per_million": 0.39,
        "completion_per_million": 0.39,
    },
}

# 1 credit = $0.01
DOLLARS_PER_CREDIT = 0.01

# Margin multiplier applied to raw API costs.
MARGIN = 1.5


def get_model_pricing(model: str) -> dict[str, float]:
    """Return pricing info for *model*.

    Returns a dict with keys ``prompt_per_million`` and
    ``completion_per_million`` (USD).  If the model is unknown the function
    falls back to ``openai/gpt-4o`` pricing so callers always receive a
    usable result.
    """
    return MODEL_PRICING.get(model, MODEL_PRICING["openai/gpt-4o"]).copy()


def estimate_credits(
    model: str,
    input_tokens: int,
    output_estimate: int = 2000,
    chunked: bool = False,
) -> int:
    """Estimate the credit cost of a single LLM call (or chunked pipeline).

    Parameters
    ----------
    model:
        The OpenRouter model identifier.
    input_tokens:
        Number of prompt / input tokens.
    output_estimate:
        Expected number of completion tokens.  Defaults to 2000.
    chunked:
        When ``True`` the estimate assumes the input will be split into
        overlapping chunks that are each processed independently.  This
        roughly doubles the effective input token count to account for
        overlap and synthesis passes.

    Returns
    -------
    int
        Estimated credits (minimum 1).  1 credit = $0.01.
    """
    pricing = get_model_pricing(model)

    effective_input = input_tokens * 2 if chunked else input_tokens

    prompt_cost = (effective_input / 1_000_000) * pricing["prompt_per_million"]
    completion_cost = (output_estimate / 1_000_000) * pricing["completion_per_million"]

    raw_cost = prompt_cost + completion_cost
    total_cost = raw_cost * MARGIN

    credits = math.ceil(total_cost / DOLLARS_PER_CREDIT)
    return max(credits, 1)
