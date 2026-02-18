"""
POST /api/anonymize endpoint.

Accepts raw text, runs it through the Presidio-based anonymization engine,
and returns the anonymized text together with the entity mapping.  The raw
input is intentionally NOT persisted -- it is discarded after processing.
"""

from fastapi import APIRouter

from models.schemas import AnonymizeRequest, AnonymizeResponse
from services.anonymization.engine import anonymize

router = APIRouter()


@router.post("/anonymize", response_model=AnonymizeResponse)
async def anonymize_text(request: AnonymizeRequest) -> AnonymizeResponse:
    """Anonymize PII in the supplied text.

    The server processes the text in-memory and discards the raw input
    immediately after building the response.
    """
    raw_text: str = request.text

    result = anonymize(raw_text)

    # Explicitly discard the raw input reference.
    del raw_text

    return AnonymizeResponse(**result)
