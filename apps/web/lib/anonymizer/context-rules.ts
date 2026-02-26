/**
 * Context-aware anonymization rules.
 * Detects what kind of query the user is making,
 * then decides which entity types to keep vs strip.
 *
 * "Keep" means the real value goes through to the AI.
 * "Strip" means it gets replaced with a fake name.
 */

export type ContextType = "legal" | "medical" | "financial" | "general";

/**
 * Detect context from text using keyword patterns.
 * Not ML — just pattern matching. Fast and predictable.
 */
export function detectContext(text: string): ContextType {
  const lower = text.toLowerCase();

  // Legal
  if (/\b(lawsuit|court|filed|attorney|plaintiff|defendant|judge|jurisdiction|statute|deposition|litigation|verdict|appeal|tribunal|arbitration|motion|subpoena|injunction|tort|indictment|bail|probation|parole|custody|alimony|divorce|settlement|plea|felony|misdemeanor|prosecution|defense counsel)\b/.test(lower)) {
    return "legal";
  }

  // Medical
  if (/\b(patient|diagnosis|prescription|symptoms|doctor|hospital|treatment|medical|surgery|disease|medication|therapy|clinic|nurse|prognosis|chronic|acute|cancer|diabetes|hypertension|cholesterol|mri|ct scan|x-ray|lab results|blood test|biopsy|oncology|cardiology|pediatric|psychiatric|dosage|side effects|allergies|immunization|vaccine)\b/.test(lower)) {
    return "medical";
  }

  // Financial
  if (/\b(portfolio|investment|stock|trading|revenue|quarterly|earnings|dividend|hedge fund|mutual fund|securities|bonds|equity|ipo|nasdaq|s&p|dow jones|market cap|balance sheet|income statement|profit|loss|audit|tax return|capital gains|depreciation|amortization|roi|ebitda|valuation|merger|acquisition)\b/.test(lower)) {
    return "financial";
  }

  return "general";
}

/**
 * Rules per context: which entity types to strip vs keep.
 *
 * "strip" = always replace with fake (identifies the user)
 * "keep"  = pass through to AI (needed for useful response)
 *
 * Entity types from GLiNER: person, location, organization, date of birth, address
 * Entity types from regex: SSN, EMAIL, PHONE, CREDIT_CARD, IP_ADDRESS
 */
interface ContextRules {
  strip: string[];
  keep: string[];
  description: string;
}

export const CONTEXT_RULES: Record<ContextType, ContextRules> = {
  legal: {
    strip: ["person", "date of birth", "SSN", "EMAIL", "PHONE", "CREDIT_CARD", "IP_ADDRESS", "address"],
    keep: ["location", "organization"],
    description: "Legal: keeping jurisdictions & courts, stripping names",
  },
  medical: {
    strip: ["person", "date of birth", "SSN", "EMAIL", "PHONE", "CREDIT_CARD", "IP_ADDRESS", "address"],
    keep: ["organization"],
    description: "Medical: keeping conditions & facilities, stripping patient info",
  },
  financial: {
    strip: ["person", "SSN", "CREDIT_CARD", "PHONE", "EMAIL", "IP_ADDRESS", "address", "date of birth"],
    keep: ["organization", "location"],
    description: "Financial: keeping companies & markets, stripping personal info",
  },
  general: {
    strip: ["person", "location", "organization", "date of birth", "SSN", "EMAIL", "PHONE", "CREDIT_CARD", "IP_ADDRESS", "address"],
    keep: [],
    description: "General: stripping all identifiable info",
  },
};

/**
 * Check if an entity type should be kept (not anonymized) for a given context.
 */
export function shouldKeepEntity(entityType: string, context: ContextType): boolean {
  const rules = CONTEXT_RULES[context];
  const normalized = entityType.toLowerCase();
  return rules.keep.some((k) => normalized.includes(k.toLowerCase()));
}
