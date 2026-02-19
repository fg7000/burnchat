"""Automatic model recommendation based on document characteristics.

Selects the best model for a given workload by considering token count,
entity density, and query complexity.  Returns a recommendation with
reasoning, credit estimate, and alternative options.
"""

from typing import Optional

from services.model_selection.cost_calculator import estimate_credits


def recommend_model(
    token_count: int,
    entity_count: int = 0,
    query: str = "",
) -> dict:
    """Choose the best model for the given workload.

    Parameters
    ----------
    token_count:
        Total number of tokens in the document(s) to be processed.
    entity_count:
        Number of PII / named entities detected (used for tie-breaking).
    query:
        The user's query text (reserved for future complexity heuristics).

    Returns
    -------
    dict
        A recommendation dict containing ``model``, ``reason``,
        ``estimated_credits``, ``alternatives``, and optionally ``strategy``.
    """

    strategy: Optional[str] = None

    if token_count >= 1_000_000:
        # Massive document -- must be chunked regardless of model context.
        model = "anthropic/claude-sonnet-4-5-20250929"
        reason = (
            "Document exceeds 1M tokens. Using Claude Sonnet 4.5 with a "
            "chunk-and-synthesize strategy for cost-effective processing."
        )
        strategy = "chunk_and_synthesize"
        alternatives = [
            {
                "model": "anthropic/claude-opus-4-6",
                "reason": "Higher quality synthesis but significantly more expensive.",
                "estimated_credits": estimate_credits(
                    "anthropic/claude-opus-4-6",
                    token_count,
                    output_estimate=4000,
                    chunked=True,
                ),
            },
        ]

    elif token_count >= 500_000:
        # Very large document -- needs extended context.
        model = "anthropic/claude-opus-4-6"
        reason = (
            "Very large document (500K-1M tokens). Claude Opus 4.6 provides "
            "the extended context window and strong reasoning needed."
        )
        alternatives = [
            {
                "model": "anthropic/claude-sonnet-4-5-20250929",
                "reason": "Cheaper alternative with chunk-and-synthesize strategy.",
                "estimated_credits": estimate_credits(
                    "anthropic/claude-sonnet-4-5-20250929",
                    token_count,
                    output_estimate=4000,
                    chunked=True,
                ),
                "strategy": "chunk_and_synthesize",
            },
        ]

    elif token_count >= 128_000:
        # Large document -- needs strong reasoning over long context.
        model = "anthropic/claude-opus-4-6"
        reason = (
            "Large document (128K-500K tokens). Claude Opus 4.6 offers "
            "extended context and superior reasoning for complex analysis."
        )
        alternatives = [
            {
                "model": "anthropic/claude-sonnet-4-5-20250929",
                "reason": "Good balance of quality and cost for large documents.",
                "estimated_credits": estimate_credits(
                    "anthropic/claude-sonnet-4-5-20250929",
                    token_count,
                    output_estimate=3000,
                ),
            },
            {
                "model": "google/gemini-2.5-pro-preview-03-25",
                "reason": "Strong long-context performance at lower cost.",
                "estimated_credits": estimate_credits(
                    "google/gemini-2.5-pro-preview-03-25",
                    token_count,
                    output_estimate=3000,
                ),
            },
        ]

    elif token_count >= 32_000:
        # Standard-to-large document.
        model = "anthropic/claude-sonnet-4-5-20250929"
        reason = (
            "Standard-to-large document (32K-128K tokens). Claude Sonnet 4.5 "
            "provides strong reasoning at a reasonable cost."
        )
        alternatives = [
            {
                "model": "openai/gpt-4o",
                "reason": "Comparable quality, slightly different strengths.",
                "estimated_credits": estimate_credits(
                    "openai/gpt-4o",
                    token_count,
                    output_estimate=2000,
                ),
            },
            {
                "model": "google/gemini-2.5-pro-preview-03-25",
                "reason": "Cost-effective alternative with good reasoning.",
                "estimated_credits": estimate_credits(
                    "google/gemini-2.5-pro-preview-03-25",
                    token_count,
                    output_estimate=2000,
                ),
            },
        ]

    elif token_count >= 8_000:
        # Standard document.
        model = "anthropic/claude-sonnet-4-5-20250929"
        reason = (
            "Standard document (8K-32K tokens). Claude Sonnet 4.5 balances "
            "quality and cost well for this size."
        )
        alternatives = [
            {
                "model": "openai/gpt-4o",
                "reason": "Strong alternative with fast response times.",
                "estimated_credits": estimate_credits(
                    "openai/gpt-4o",
                    token_count,
                    output_estimate=2000,
                ),
            },
            {
                "model": "openai/gpt-4o-mini",
                "reason": "Much cheaper if high quality is not critical.",
                "estimated_credits": estimate_credits(
                    "openai/gpt-4o-mini",
                    token_count,
                    output_estimate=2000,
                ),
            },
        ]

    else:
        # Short document (< 8K tokens).
        model = "openai/gpt-4o-mini"
        reason = (
            "Short document (under 8K tokens). GPT-4o Mini is fast and "
            "cost-effective for smaller workloads."
        )
        alternatives = [
            {
                "model": "google/gemini-2.0-flash-001",
                "reason": "Extremely fast and cheap alternative.",
                "estimated_credits": estimate_credits(
                    "google/gemini-2.0-flash-001",
                    token_count,
                    output_estimate=1000,
                ),
            },
            {
                "model": "meta-llama/llama-3.3-70b-instruct",
                "reason": "Open-source option with competitive quality.",
                "estimated_credits": estimate_credits(
                    "meta-llama/llama-3.3-70b-instruct",
                    token_count,
                    output_estimate=1000,
                ),
            },
        ]

    # Compute estimated credits for the primary recommendation.
    is_chunked = strategy == "chunk_and_synthesize"
    output_est = 4000 if is_chunked else 2000
    estimated_credits = estimate_credits(
        model,
        token_count,
        output_estimate=output_est,
        chunked=is_chunked,
    )

    result: dict = {
        "model": model,
        "reason": reason,
        "estimated_credits": estimated_credits,
        "alternatives": alternatives,
    }

    if strategy is not None:
        result["strategy"] = strategy

    return result
