"""
Custom legal pattern recognizers for Presidio.

Defines PatternRecognizer instances for CASE_NUMBER and COURT_NAME
entity types commonly found in legal documents.
"""

from presidio_analyzer import PatternRecognizer, Pattern


# ---------------------------------------------------------------------------
# CASE_NUMBER recognizer
# Matches patterns like:
#   - 2:24-cv-01234          (federal civil)
#   - 1:23-cr-00567-ABC      (federal criminal with judge initials)
#   - No. 22-1234            (appellate)
#   - Case No. 2023-CF-001234
#   - 23-CV-2024-000123
#   - Docket No. 12345
# ---------------------------------------------------------------------------
_case_number_patterns = [
    Pattern(
        name="federal_case_number",
        regex=r"\b\d{1,2}:\d{2}-[a-zA-Z]{2,4}-\d{3,6}(?:-[A-Z]{2,4})?\b",
        score=0.85,
    ),
    Pattern(
        name="appellate_case_number",
        regex=r"\b(?:No\.|Case No\.|Docket No\.)\s*\d{2,4}-[A-Z]{0,4}-?\d{2,8}\b",
        score=0.80,
    ),
    Pattern(
        name="generic_case_number",
        regex=r"\b\d{2,4}-[A-Z]{1,4}-\d{4,8}\b",
        score=0.60,
    ),
]

case_number_recognizer = PatternRecognizer(
    supported_entity="CASE_NUMBER",
    name="CaseNumberRecognizer",
    patterns=_case_number_patterns,
    supported_language="en",
)

# ---------------------------------------------------------------------------
# COURT_NAME recognizer
# Matches patterns like:
#   - United States District Court for the Southern District of New York
#   - U.S. Court of Appeals for the Ninth Circuit
#   - Supreme Court of the United States
#   - Superior Court of California, County of Los Angeles
#   - Circuit Court of Cook County
#   - U.S. Bankruptcy Court for the District of Delaware
# ---------------------------------------------------------------------------
_court_name_patterns = [
    Pattern(
        name="us_district_court",
        regex=(
            r"\bUnited States District Court"
            r"(?:\s+for)?\s+(?:the\s+)?"
            r"(?:Northern|Southern|Eastern|Western|Central|Middle)?\s*"
            r"District\s+of\s+[A-Z][a-zA-Z\s]{2,30}"
        ),
        score=0.90,
    ),
    Pattern(
        name="us_appeals_court",
        regex=(
            r"\bU\.?S\.?\s+Court\s+of\s+Appeals"
            r"\s+for\s+the\s+"
            r"(?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|D\.?C\.?|Federal)"
            r"\s+Circuit"
        ),
        score=0.90,
    ),
    Pattern(
        name="supreme_court",
        regex=r"\bSupreme\s+Court\s+of\s+(?:the\s+)?[A-Z][a-zA-Z\s]{2,30}",
        score=0.85,
    ),
    Pattern(
        name="state_superior_court",
        regex=(
            r"\bSuperior\s+Court\s+of\s+[A-Z][a-zA-Z\s]{2,30}"
            r"(?:,\s*County\s+of\s+[A-Z][a-zA-Z\s]{2,30})?"
        ),
        score=0.85,
    ),
    Pattern(
        name="circuit_court",
        regex=r"\bCircuit\s+Court\s+of\s+[A-Z][a-zA-Z\s]{2,30}",
        score=0.80,
    ),
    Pattern(
        name="bankruptcy_court",
        regex=(
            r"\bU\.?S\.?\s+Bankruptcy\s+Court"
            r"\s+for\s+the\s+"
            r"(?:Northern|Southern|Eastern|Western|Central|Middle)?\s*"
            r"District\s+of\s+[A-Z][a-zA-Z\s]{2,30}"
        ),
        score=0.85,
    ),
]

court_name_recognizer = PatternRecognizer(
    supported_entity="COURT_NAME",
    name="CourtNameRecognizer",
    patterns=_court_name_patterns,
    supported_language="en",
)

# Convenience list for bulk registration
ALL_LEGAL_RECOGNIZERS = [case_number_recognizer, court_name_recognizer]
