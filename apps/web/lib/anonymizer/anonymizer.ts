import { detectEntities, isGlinerReady } from "./gliner-engine";
import { detectContext, shouldKeepEntity, type ContextType } from "./context-rules";
import { MappingEntry } from "@/store/session-store";

/**
 * Regex patterns for structured PII that GLiNER might miss.
 * These run instantly, no model needed.
 */
const PII_REGEX: Array<{ pattern: RegExp; label: string }> = [
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "social security number" },
  // Email
  { pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, label: "email" },
  // US Phone
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: "phone number" },
  // Credit card (basic)
  { pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, label: "credit card number" },
  // IP address
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, label: "ip address" },
];

interface DetectedEntity {
  text: string;
  start: number;
  end: number;
  label: string;
  score?: number;
}

/**
 * Normalize GLiNER PII labels to display-friendly entity_type values.
 * The PII model returns lowercase descriptive labels; we map them to
 * consistent keys for the UI and mapping store.
 */
function normalizeLabel(label: string): string {
  const map: Record<string, string> = {
    "person": "PERSON",
    "email": "EMAIL_ADDRESS",
    "phone number": "PHONE_NUMBER",
    "address": "ADDRESS",
    "social security number": "SSN",
    "date of birth": "DATE_OF_BIRTH",
    "credit card number": "CREDIT_CARD",
    "bank account number": "BANK_ACCOUNT",
    "passport number": "PASSPORT",
    "driver's license number": "DRIVERS_LICENSE",
    "medical record number": "MEDICAL_RECORD",
    "ip address": "IP_ADDRESS",
    "username": "USERNAME",
    // Legacy labels from old model
    "location": "LOCATION",
    "organization": "ORGANIZATION",
  };
  return map[label.toLowerCase()] || label.toUpperCase().replace(/\s+/g, "_");
}

/**
 * Fake value pools for realistic substitution.
 * AI never sees [PERSON_1] — it sees "Robert Miller".
 * Lives in JS memory only — destroyed on tab close.
 */
const FAKE_VALUES: Record<string, string[]> = {
  PERSON: [
    "James Mitchell", "Sarah Chen", "Robert Miller", "Maria Santos",
    "David Park", "Emily Watson", "Michael Brown", "Lisa Anderson",
    "Thomas Wright", "Jennifer Lee", "William Harris", "Amanda Clark",
    "Christopher Young", "Rachel Kim", "Daniel Moore", "Karen White",
  ],
  LOCATION: [
    "Westfield", "Oakridge", "Riverside County", "Lakewood",
    "Cedar Heights", "Maple Grove", "Fairview", "Springdale",
  ],
  ORGANIZATION: [
    "Meridian Corp", "Atlas Group", "Pinnacle Solutions", "Vanguard LLC",
    "Sterling Associates", "Horizon Partners", "Apex Industries", "Nova Consulting",
  ],
  EMAIL_ADDRESS: [
    "jmitchell@example.com", "schen@example.org", "rmiller@example.com",
    "msantos@example.org", "dpark@example.com", "ewatson@example.org",
  ],
  PHONE_NUMBER: [
    "(555) 123-4567", "(555) 234-5678", "(555) 345-6789",
    "(555) 456-7890", "(555) 567-8901", "(555) 678-9012",
  ],
  DATE_OF_BIRTH: [
    "March 15, 1985", "July 22, 1990", "November 3, 1978",
    "January 8, 1992", "September 19, 1988", "April 30, 1975",
  ],
  ADDRESS: [
    "742 Elm Street, Apt 4B", "1200 Oak Avenue, Suite 200", "89 Pine Road",
    "456 Maple Drive", "321 Cedar Lane", "678 Birch Court, Unit 12",
  ],
  SSN: [
    "***-**-4567", "***-**-8901", "***-**-2345",
    "***-**-6789", "***-**-0123", "***-**-4561",
  ],
  CREDIT_CARD: [
    "****-****-****-1234", "****-****-****-5678", "****-****-****-9012",
  ],
  BANK_ACCOUNT: [
    "****4567", "****8901", "****2345", "****6789",
  ],
  PASSPORT: [
    "X12345678", "Y98765432", "Z45678901",
  ],
  DRIVERS_LICENSE: [
    "D1234567", "D9876543", "D4567890",
  ],
  MEDICAL_RECORD: [
    "MRN-0001234", "MRN-0005678", "MRN-0009012",
  ],
  IP_ADDRESS: [
    "192.168.1.100", "10.0.0.50", "172.16.0.25",
  ],
  USERNAME: [
    "user_alpha", "user_beta", "user_gamma", "user_delta",
  ],
};

const counters: Record<string, number> = {};

function getNextPlaceholder(normalizedLabel: string): string {
  counters[normalizedLabel] = (counters[normalizedLabel] || 0) + 1;
  const pool = FAKE_VALUES[normalizedLabel] || FAKE_VALUES["PERSON"];
  const idx = (counters[normalizedLabel] - 1) % pool.length;
  return pool[idx];
}

/**
 * Find or create a placeholder for an entity.
 * Reuses existing mapping if the same text was seen before.
 */
function resolvePlaceholder(
  entityText: string,
  normalizedLabel: string,
  mapping: MappingEntry[]
): string {
  const existing = mapping.find(
    (m) => m.original.toLowerCase() === entityText.toLowerCase()
  );
  if (existing) return existing.replacement;
  return getNextPlaceholder(normalizedLabel);
}

/**
 * Remove overlapping spans, keeping the longest match.
 */
function deduplicateSpans(spans: DetectedEntity[]): DetectedEntity[] {
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
 * Basic false-positive check. The PII model is much more precise
 * than the generic NER model, so we need less filtering.
 */
function isLikelyRealEntity(e: DetectedEntity): boolean {
  // Too short
  if (e.text.length <= 2) return false;

  // Low confidence
  if (e.score !== undefined && e.score < 0.4) return false;

  return true;
}

/**
 * Anonymize text by detecting PII and replacing with fake values.
 *
 * - Regex patterns run always (instant)
 * - GLiNER PII model runs if loaded (adds ~50-200ms)
 * - Mapping is cumulative across messages in a session
 * - All state lives in JS variables (ephemeral)
 */
export async function anonymizeText(
  text: string,
  existingMapping: MappingEntry[] = [],
  contextOverride?: ContextType
): Promise<{ anonymizedText: string; mapping: MappingEntry[]; entitiesFound: number; detectedContext: ContextType }> {
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

  // 2. GLiNER PII model (if loaded)
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

  // 3. Filter false positives
  const filtered = allEntities.filter((e) => isLikelyRealEntity(e));

  if (filtered.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0, detectedContext };
  }

  // 4. Deduplicate overlapping spans
  const unique = deduplicateSpans(filtered);

  // 5. Context-aware filtering
  const contextFiltered = unique.filter((e) => {
    const normalized = normalizeLabel(e.label);
    if (shouldKeepEntity(normalized, detectedContext)) {
      return false;
    }
    return true;
  });

  if (contextFiltered.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0, detectedContext };
  }

  // 6. Sort by position (reverse) for right-to-left replacement
  contextFiltered.sort((a, b) => b.start - a.start);

  // 7. Build mapping and replace
  const newMapping: MappingEntry[] = [...existingMapping];
  let result = text;

  for (const entity of contextFiltered) {
    const normalized = normalizeLabel(entity.label);
    const placeholder = resolvePlaceholder(entity.text, normalized, newMapping);

    if (!newMapping.find((m) => m.original.toLowerCase() === entity.text.toLowerCase())) {
      newMapping.push({
        original: entity.text,
        replacement: placeholder,
        entity_type: normalized,
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
 * Anonymize a large document by chunking and processing each chunk
 * through the local PII engine. Mapping accumulates across chunks
 * so the same entity always gets the same fake value.
 * 
 * This runs ENTIRELY in the browser — no data leaves the device.
 */
export async function anonymizeDocument(
  text: string,
  onProgress?: (pct: number, detail: string) => void,
): Promise<{
  anonymized_text: string;
  mapping: MappingEntry[];
  entities_found: Array<{ type: string; count: number }>;
}> {
  const CHUNK_SIZE = 2000; // characters per chunk (GLiNER handles ~512 tokens)
  const chunks = splitTextIntoChunks(text, CHUNK_SIZE);

  let allAnonymized = "";
  let accumulatedMapping: MappingEntry[] = [];
  const entityCounts: Record<string, number> = {};

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(
      Math.round((i / chunks.length) * 100),
      `Scanning part ${i + 1} of ${chunks.length}...`
    );

    const result = await anonymizeText(chunks[i], accumulatedMapping);

    allAnonymized += result.anonymizedText;
    accumulatedMapping = result.mapping;

    // Count entities
    for (const m of result.mapping) {
      entityCounts[m.entity_type] = (entityCounts[m.entity_type] || 0);
    }
    // Count new detections in this chunk
    if (result.entitiesFound > 0) {
      // We count by checking what's new in the mapping
      const prevLen = accumulatedMapping.length - result.mapping.length;
      // Actually just count from the mapping entries
    }
  }

  onProgress?.(100, "Anonymization complete");

  // Build entity counts from final mapping
  const finalCounts: Record<string, number> = {};
  for (const m of accumulatedMapping) {
    finalCounts[m.entity_type] = (finalCounts[m.entity_type] || 0) + 1;
  }

  return {
    anonymized_text: allAnonymized,
    mapping: accumulatedMapping,
    entities_found: Object.entries(finalCounts).map(([type, count]) => ({ type, count })),
  };
}

/**
 * Split text into chunks at paragraph boundaries, keeping each
 * chunk under maxChars. Falls back to hard splits if needed.
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;

    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) chunks.push(current);

      if (para.length > maxChars) {
        let remaining = para;
        while (remaining.length > maxChars) {
          chunks.push(remaining.slice(0, maxChars));
          remaining = remaining.slice(maxChars);
        }
        current = remaining;
      } else {
        current = para;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/**
 * Reset placeholder counters. Call when starting a new session.
 */
export function resetCounters(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
}
