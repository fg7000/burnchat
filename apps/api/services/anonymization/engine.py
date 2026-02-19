"""
Main Presidio-based anonymization engine.

Sets up the AnalyzerEngine with both built-in and custom legal recognizers,
detects PII entities, generates Faker-based replacements, and performs
longest-first text substitution to avoid partial-match corruption.
"""

from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING

from presidio_analyzer import AnalyzerEngine

from services.anonymization.legal_recognizers import ALL_LEGAL_RECOGNIZERS
from services.anonymization.fake_generator import FakeGenerator

if TYPE_CHECKING:
    from presidio_analyzer import RecognizerResult

# Entity types the engine will attempt to detect.
SUPPORTED_ENTITIES: list[str] = [
    "PERSON",
    "ORGANIZATION",
    "LOCATION",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "US_SSN",
    "DATE_TIME",
    "CASE_NUMBER",
    "COURT_NAME",
    "US_DRIVER_LICENSE",
    "CREDIT_CARD",
    "IP_ADDRESS",
]


def _build_analyzer() -> AnalyzerEngine:
    """Create an AnalyzerEngine with custom legal recognizers registered."""
    analyzer = AnalyzerEngine()
    for recognizer in ALL_LEGAL_RECOGNIZERS:
        analyzer.registry.add_recognizer(recognizer)
    return analyzer


# Module-level singleton -- initialized once, reused across requests.
_analyzer: AnalyzerEngine = _build_analyzer()


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------

def anonymize(text: str, existing_mapping: list[dict] | None = None) -> dict:
    """Detect PII in *text*, replace with fake values, and return results.

    If *existing_mapping* is provided, pre-populates the replacement cache so
    that entities seen in earlier chunks get the same fake value.  This enables
    consistent anonymization when the client splits large texts into chunks.

    Returns a dict matching the ``AnonymizeResponse`` schema::

        {
            "anonymized_text": str,
            "mapping": [{"original": ..., "replacement": ..., "entity_type": ...}, ...],
            "entities_found": [{"type": ..., "count": ...}, ...],
        }
    """
    # 1. Analyse -----------------------------------------------------------
    results: list[RecognizerResult] = _analyzer.analyze(
        text=text,
        language="en",
        entities=SUPPORTED_ENTITIES,
    )

    if not results:
        return {
            "anonymized_text": text,
            "mapping": [],
            "entities_found": [],
        }

    # 2. Deduplicate & resolve overlaps ------------------------------------
    #    Sort longest-first so broader spans take priority, then by start.
    results = _resolve_overlaps(results)

    # 3. Build replacements ------------------------------------------------
    generator = FakeGenerator(text)

    # Pre-populate the cache with previously seen entity replacements so
    # chunked anonymization stays consistent across calls.
    if existing_mapping:
        for entry in existing_mapping:
            key = (entry.get("entity_type", ""), entry.get("original", ""))
            if key[0] and key[1] and "replacement" in entry:
                generator._cache[key] = entry["replacement"]

    mapping: list[dict] = []
    seen: set[tuple[str, str]] = set()

    # Sort by start position descending so we can replace right-to-left
    # without invalidating earlier indices.
    results_by_position = sorted(results, key=lambda r: r.start, reverse=True)

    anonymized = text
    for result in results_by_position:
        original = text[result.start : result.end]
        replacement = generator.replacement_for(result.entity_type, original)

        anonymized = anonymized[: result.start] + replacement + anonymized[result.end :]

        key = (result.entity_type, original)
        if key not in seen:
            seen.add(key)
            mapping.append(
                {
                    "original": original,
                    "replacement": replacement,
                    "entity_type": result.entity_type,
                }
            )

    # 4. Aggregate entity counts -------------------------------------------
    counter: Counter[str] = Counter(r.entity_type for r in results)
    entities_found = [
        {"type": entity_type, "count": count}
        for entity_type, count in counter.most_common()
    ]

    return {
        "anonymized_text": anonymized,
        "mapping": mapping,
        "entities_found": entities_found,
    }


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

def _resolve_overlaps(results: list[RecognizerResult]) -> list[RecognizerResult]:
    """Remove overlapping detections, preferring longer (then higher-score) spans."""
    # Sort by length descending, then by score descending.
    results = sorted(results, key=lambda r: (-(r.end - r.start), -r.score))

    kept: list[RecognizerResult] = []
    for candidate in results:
        if not any(_overlaps(candidate, existing) for existing in kept):
            kept.append(candidate)
    return kept


def _overlaps(a: RecognizerResult, b: RecognizerResult) -> bool:
    """Return True if spans *a* and *b* overlap."""
    return a.start < b.end and b.start < a.end
