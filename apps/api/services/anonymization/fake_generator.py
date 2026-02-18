"""
Faker-based replacement generator for anonymized entities.

Produces deterministic fake values seeded from the input text so the same
document always yields the same replacements.  Each original value is mapped
to exactly one fake value to keep replacements consistent within a document.
"""

from __future__ import annotations

import hashlib
from faker import Faker


def _seed_from_text(text: str) -> int:
    """Derive a stable integer seed from the first 200 characters of *text*."""
    prefix = text[:200]
    return int(hashlib.sha256(prefix.encode("utf-8")).hexdigest(), 16) % (2**31)


class FakeGenerator:
    """Generates consistent fake replacements for detected PII entities."""

    def __init__(self, text: str) -> None:
        seed = _seed_from_text(text)
        self._faker = Faker()
        Faker.seed(seed)
        # Cache: (entity_type, original) -> replacement
        self._cache: dict[tuple[str, str], str] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def replacement_for(self, entity_type: str, original: str) -> str:
        """Return a fake value for *original* of the given *entity_type*.

        Repeated calls with the same arguments return the same value.
        """
        key = (entity_type, original)
        if key not in self._cache:
            self._cache[key] = self._generate(entity_type)
        return self._cache[key]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _generate(self, entity_type: str) -> str:
        """Dispatch to the appropriate Faker provider."""
        generators = {
            "PERSON": self._person,
            "ORGANIZATION": self._organization,
            "LOCATION": self._location,
            "PHONE_NUMBER": self._phone,
            "EMAIL_ADDRESS": self._email,
            "US_SSN": self._ssn,
            "DATE_TIME": self._date,
            "CASE_NUMBER": self._case_number,
            "COURT_NAME": self._court_name,
            "US_DRIVER_LICENSE": self._driver_license,
            "CREDIT_CARD": self._credit_card,
            "IP_ADDRESS": self._ip_address,
        }
        gen = generators.get(entity_type, self._fallback)
        return gen()

    # --- Individual generators ----------------------------------------

    def _person(self) -> str:
        return self._faker.name()

    def _organization(self) -> str:
        return self._faker.company()

    def _location(self) -> str:
        return self._faker.city()

    def _phone(self) -> str:
        return self._faker.phone_number()

    def _email(self) -> str:
        return self._faker.email()

    def _ssn(self) -> str:
        return self._faker.ssn()

    def _date(self) -> str:
        return self._faker.date()

    def _case_number(self) -> str:
        district = self._faker.random_int(min=1, max=9)
        year = self._faker.random_int(min=20, max=25)
        seq = self._faker.random_int(min=100, max=99999)
        return f"{district}:{year:02d}-cv-{seq:05d}"

    def _court_name(self) -> str:
        state = self._faker.state()
        return f"Superior Court of {state}"

    def _driver_license(self) -> str:
        letter = self._faker.random_uppercase_letter()
        number = self._faker.random_int(min=1000000, max=9999999)
        return f"{letter}{number}"

    def _credit_card(self) -> str:
        return self._faker.credit_card_number()

    def _ip_address(self) -> str:
        return self._faker.ipv4()

    def _fallback(self) -> str:
        return f"[REDACTED-{self._faker.lexify(text='??????').upper()}]"
