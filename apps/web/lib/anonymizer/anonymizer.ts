import { detectEntities, isGlinerReady } from "./gliner-engine";
import { detectContext, shouldKeepEntity, type ContextType } from "./context-rules";
import { MappingEntry } from "@/store/session-store";

/**
 * Regex patterns for structured PII that GLiNER might miss.
 * These run instantly, no model needed.
 */
const PII_REGEX: Array<{ pattern: RegExp; label: string }> = [
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "SSN" },
  // Email
  { pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, label: "EMAIL" },
  // US Phone
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: "PHONE" },
  // Credit card (basic)
  { pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, label: "CREDIT_CARD" },
  // IP address
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, label: "IP_ADDRESS" },
];

interface DetectedEntity {
  text: string;
  start: number;
  end: number;
  label: string;
  score?: number;
}

/**
 * Fake name pools for realistic substitution.
 * AI never sees [PERSON_1] — it sees "Robert Miller".
 * Lives in JS memory only — destroyed on tab close.
 */
const FAKE_NAMES: Record<string, string[]> = {
  PERSON: [
    "James Mitchell", "Sarah Chen", "Robert Miller", "Maria Santos",
    "David Park", "Emily Watson", "Michael Brown", "Lisa Anderson",
    "Thomas Wright", "Jennifer Lee", "William Harris", "Amanda Clark",
    "Christopher Young", "Rachel Kim", "Daniel Moore", "Karen White",
  ],
  LOCATION: [
    "Westfield", "Oakridge", "Riverside County", "Lakewood",
    "Cedar Heights", "Maple Grove", "Fairview", "Springdale",
    "Hillcrest", "Brookside", "Summit City", "Clearwater",
  ],
  ORGANIZATION: [
    "Meridian Corp", "Atlas Group", "Pinnacle Solutions", "Vanguard LLC",
    "Sterling Associates", "Horizon Partners", "Apex Industries", "Nova Consulting",
  ],
  EMAIL: [
    "user1@example.com", "contact@example.com", "info@example.com",
    "admin@example.com", "support@example.com", "hello@example.com",
  ],
  PHONE: [
    "(555) 123-4567", "(555) 234-5678", "(555) 345-6789",
    "(555) 456-7890", "(555) 567-8901", "(555) 678-9012",
  ],
  DATE_OF_BIRTH: [
    "March 15, 1985", "July 22, 1990", "November 3, 1978",
    "January 8, 1992", "September 19, 1988", "April 30, 1975",
  ],
  ADDRESS: [
    "742 Elm Street", "1200 Oak Avenue", "89 Pine Road",
    "456 Maple Drive", "321 Cedar Lane", "678 Birch Court",
  ],
};

const counters: Record<string, number> = {};

function getNextPlaceholder(label: string): string {
  const key = label.toUpperCase().replace(/\s+/g, "_");
  counters[key] = (counters[key] || 0) + 1;
  const pool = FAKE_NAMES[key] || FAKE_NAMES["PERSON"];
  const idx = (counters[key] - 1) % pool.length;
  return pool[idx];
}

/**
 * Find or create a placeholder for an entity.
 * Reuses existing mapping if the same text was seen before.
 */
function resolvePlaceholder(
  entityText: string,
  label: string,
  mapping: MappingEntry[]
): string {
  const existing = mapping.find(
    (m) => m.original.toLowerCase() === entityText.toLowerCase()
  );
  if (existing) return existing.replacement;
  return getNextPlaceholder(label);
}

/**
 * Remove overlapping spans, keeping the longest match.
 */
function deduplicateSpans(spans: DetectedEntity[]): DetectedEntity[] {
  // Sort by start position, then by length (longest first)
  const sorted = [...spans].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const result: DetectedEntity[] = [];

  for (const span of sorted) {
    const overlaps = result.some(
      (r) => span.start < r.end && span.end > r.start
    );
    if (!overlaps) {
      result.push(span);
    }
  }

  return result;
}

/**
 * Anonymize text by detecting PII and replacing with placeholders.
 *
 * - Regex patterns run always (instant)
 * - GLiNER runs if model is loaded (adds ~50-100ms)
 * - Mapping is cumulative across messages in a session
 * - All state lives in JS variables (ephemeral)
 */
export async function anonymizeText(
  text: string,
  existingMapping: MappingEntry[] = [],
  contextOverride?: ContextType
): Promise<{ anonymizedText: string; mapping: MappingEntry[]; entitiesFound: number; detectedContext: ContextType }> {
  // Detect context (or use override)
  const detectedContext = contextOverride || detectContext(text);
  const allEntities: DetectedEntity[] = [];

  // 1. Regex patterns (always run, instant)
  for (const { pattern, label } of PII_REGEX) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      allEntities.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
        label,
      });
    }
  }

  // 2. GLiNER NER (if model loaded)
  if (isGlinerReady()) {
    const nerEntities = await detectEntities(text);
    for (const e of nerEntities) {
      allEntities.push({
        text: e.text,
        start: e.start,
        end: e.end,
        label: e.label,
        score: e.score,
      });
    }
  }

  // ── Intelligent false-positive filtering ──
  // Three layers:
  //   1. Role/title words (static, fast)
  //   2. Common English words that GLiNER misclassifies as entities
  //   3. Heuristic checks: capitalization, word count, confidence score

  const ROLE_WORDS = new Set([
    "lawyer", "doctor", "nurse", "judge", "attorney", "plaintiff",
    "defendant", "patient", "client", "officer", "manager", "director",
    "president", "ceo", "cfo", "teacher", "professor", "engineer",
    "consultant", "analyst", "partner", "associate", "agent", "broker",
    "therapist", "counselor", "surgeon", "dentist", "pharmacist",
    "accountant", "auditor", "secretary", "assistant", "intern",
  ]);

  // Common English words GLiNER frequently misclassifies as person/org/location
  const COMMON_ENGLISH = new Set([
    "study", "studies", "investigation", "investigations", "research",
    "report", "reports", "analysis", "review", "reviews", "survey",
    "evidence", "findings", "results", "conclusion", "conclusions",
    "article", "articles", "paper", "papers", "journal", "publication",
    "document", "documents", "agreement", "contract", "policy", "policies",
    "program", "programs", "project", "projects", "system", "systems",
    "service", "services", "product", "products", "process", "plan",
    "method", "approach", "strategy", "framework", "model", "standard",
    "practice", "practices", "procedure", "procedures", "protocol",
    "committee", "commission", "council", "board", "panel", "team",
    "department", "division", "unit", "section", "office", "agency",
    "association", "foundation", "institute", "institution", "center",
    "authority", "administration", "ministry", "bureau", "registry",
    "coalition", "alliance", "federation", "union", "league", "forum",
    "network", "group", "society", "chapter", "branch", "corporation",
    "company", "firm", "enterprise", "business", "industry", "market",
    "bank", "exchange", "fund", "trust", "estate", "property",
    "court", "tribunal", "hearing", "trial", "case", "motion",
    "petition", "complaint", "claim", "charge", "appeal", "order",
    "session", "meeting", "conference", "summit", "workshop", "seminar",
    "campaign", "movement", "initiative", "effort", "operation",
    "community", "population", "public", "government", "state",
    "country", "nation", "region", "area", "district", "territory",
    "province", "county", "city", "town", "village", "neighborhood",
    "world", "global", "international", "national", "local", "federal",
    "general", "special", "specific", "major", "primary", "secondary",
    "health", "medical", "clinical", "scientific", "academic", "legal",
    "financial", "economic", "political", "social", "environmental",
    "technology", "information", "data", "internet", "media", "press",
    "education", "training", "development", "management", "security",
    "defense", "intelligence", "justice", "law", "regulation",
  ]);

  /**
   * Smart check: is this entity likely a real named entity, or a common word?
   * Real entities tend to be: capitalized, multi-word, high confidence, proper nouns.
   * False positives tend to be: lowercase, single common words, lower confidence.
   */
  function isLikelyRealEntity(e: DetectedEntity, originalText: string): boolean {
    const lower = e.text.toLowerCase();

    // Always filter role words
    if (ROLE_WORDS.has(lower)) return false;

    // Always filter common English words
    if (COMMON_ENGLISH.has(lower)) return false;

    // Too short to be meaningful
    if (e.text.length <= 2) return false;

    // Check if the word appears capitalized in the original text
    const inContext = originalText.slice(e.start, e.end);
    const isCapitalized = inContext[0] === inContext[0].toUpperCase() && inContext[0] !== inContext[0].toLowerCase();

    // Single word, not capitalized, not from regex = almost certainly a false positive
    const wordCount = e.text.trim().split(/\s+/).length;
    if (wordCount === 1 && !isCapitalized && e.score !== undefined) {
      return false;
    }

    // Single common word even if capitalized at start of sentence — require high confidence
    if (wordCount === 1 && e.score !== undefined && e.score < 0.75) {
      // Check if it's at the start of a sentence (capitalized by grammar, not because it's a name)
      const beforeEntity = originalText.slice(Math.max(0, e.start - 2), e.start).trim();
      const isStartOfSentence = e.start === 0 || beforeEntity.endsWith(".") || beforeEntity.endsWith("?") || beforeEntity.endsWith("!") || beforeEntity.endsWith("\n");
      if (isStartOfSentence) return false;
    }

    // Low confidence + single word = skip
    if (wordCount === 1 && e.score !== undefined && e.score < 0.7) {
      return false;
    }

    return true;
  }

  const filtered = allEntities.filter((e) => isLikelyRealEntity(e, text));

  // No entities found — return as-is
  if (filtered.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0, detectedContext };
  }

  // 3. Deduplicate overlapping spans
  const unique = deduplicateSpans(filtered);

  // 4. Context-aware filtering — keep entities that matter for this context
  const contextFiltered = unique.filter((e) => {
    if (shouldKeepEntity(e.label, detectedContext)) {
      return false; // Don't anonymize — this entity is needed for useful AI response
    }
    return true;
  });

  // No entities left after context filtering — return as-is
  if (contextFiltered.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0, detectedContext };
  }

  // 5. Sort by position (reverse) to replace from end to start
  contextFiltered.sort((a, b) => b.start - a.start);

  // 6. Build mapping and replace
  const newMapping: MappingEntry[] = [...existingMapping];
  let result = text;

  for (const entity of contextFiltered) {
    const placeholder = resolvePlaceholder(entity.text, entity.label, newMapping);

    // Add to mapping if new
    if (!newMapping.find((m) => m.original.toLowerCase() === entity.text.toLowerCase())) {
      newMapping.push({
        original: entity.text,
        replacement: placeholder,
        entity_type: entity.label,
      });
    }

    result = result.slice(0, entity.start) + placeholder + result.slice(entity.end);
  }

  return {
    anonymizedText: result,
    mapping: newMapping,
    entitiesFound: contextFiltered.length,
    detectedContext,
  };
}

/**
 * Reset placeholder counters. Call when starting a new session.
 */
export function resetCounters(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
}
