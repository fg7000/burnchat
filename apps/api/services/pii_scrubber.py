"""
Server-side PII scrubber — second pass safety net using Presidio.
Browser strips ~95% of PII with small GLiNER + regex.
This catches anything exotic the browser missed.
"""

import logging

logger = logging.getLogger(__name__)

_analyzer = None
_anonymizer = None


def _get_analyzer():
    global _analyzer
    if _analyzer is not None:
        return _analyzer
    try:
        from presidio_analyzer import AnalyzerEngine
        _analyzer = AnalyzerEngine()
        logger.info("[PII Scrubber] Presidio analyzer loaded")
        return _analyzer
    except Exception as e:
        logger.error(f"[PII Scrubber] Failed to load analyzer: {e}")
        return None


def _get_anonymizer():
    global _anonymizer
    if _anonymizer is not None:
        return _anonymizer
    try:
        from presidio_anonymizer import AnonymizerEngine
        _anonymizer = AnonymizerEngine()
        logger.info("[PII Scrubber] Presidio anonymizer loaded")
        return _anonymizer
    except Exception as e:
        logger.error(f"[PII Scrubber] Failed to load anonymizer: {e}")
        return None


def scrub_text(text: str) -> str:
    if not text or len(text.strip()) == 0:
        return text

    analyzer = _get_analyzer()
    anonymizer = _get_anonymizer()

    if not analyzer or not anonymizer:
        logger.warning("[PII Scrubber] Engines not available, passing through")
        return text

    try:
        results = analyzer.analyze(text=text, language="en", score_threshold=0.5)
        if not results:
            return text

        anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
        entity_types = set(r.entity_type for r in results)
        logger.info(f"[PII Scrubber] Found {len(results)} items: {entity_types}")
        return anonymized.text
    except Exception as e:
        logger.error(f"[PII Scrubber] Scrub failed: {e}")
        return text


def scrub_messages(messages: list[dict]) -> list[dict]:
    scrubbed = []
    for msg in messages:
        scrubbed.append({**msg, "content": scrub_text(msg.get("content", ""))})
    return scrubbed
