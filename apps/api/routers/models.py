"""Router for model listing and recommendation endpoints."""

from fastapi import APIRouter, HTTPException

from models.schemas import (
    ModelInfo,
    RecommendModelRequest,
    RecommendModelResponse,
)
from services.model_selection.cost_calculator import MARGIN, get_model_pricing
from services.model_selection.recommender import recommend_model
from services.openrouter_client import fetch_models

router = APIRouter()


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """Fetch available models from OpenRouter and return them with our pricing.

    Each model includes both the upstream per-million-token prices and
    BurnChat's prices (upstream * 1.5x margin).
    """
    try:
        openrouter_models = await fetch_models()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch models from OpenRouter: {exc}",
        ) from exc

    results: list[ModelInfo] = []

    for m in openrouter_models:
        model_id = m.get("id", "")
        pricing = m.get("pricing", {})

        # OpenRouter returns prices as strings in dollars-per-token.
        # Convert to per-million-token floats.
        try:
            prompt_per_token = float(pricing.get("prompt", "0"))
            completion_per_token = float(pricing.get("completion", "0"))
        except (TypeError, ValueError):
            prompt_per_token = 0.0
            completion_per_token = 0.0

        prompt_per_million = prompt_per_token * 1_000_000
        completion_per_million = completion_per_token * 1_000_000

        # Fall back to our hardcoded pricing if OpenRouter returns zeros.
        if prompt_per_million == 0 and completion_per_million == 0:
            fallback = get_model_pricing(model_id)
            prompt_per_million = fallback["prompt_per_million"]
            completion_per_million = fallback["completion_per_million"]

        results.append(
            ModelInfo(
                id=model_id,
                name=m.get("name", model_id),
                context_length=m.get("context_length", 0),
                prompt_price_per_million=round(prompt_per_million, 4),
                completion_price_per_million=round(completion_per_million, 4),
                our_prompt_price=round(prompt_per_million * MARGIN, 4),
                our_completion_price=round(completion_per_million * MARGIN, 4),
            )
        )

    return results


@router.post("/recommend-model", response_model=RecommendModelResponse)
async def recommend_model_endpoint(request: RecommendModelRequest):
    """Recommend the best model for a given workload."""
    recommendation = recommend_model(
        token_count=request.token_count,
        entity_count=request.entity_count,
        query=request.query,
    )

    return RecommendModelResponse(**recommendation)
