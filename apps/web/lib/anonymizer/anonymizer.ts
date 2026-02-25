import { detectEntities, isGlinerReady } from "./gliner-engine";
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
}

/**
 * Counter state for placeholder generation.
 * Lives in JS memory only — destroyed on tab close.
 */
const counters: Record<string, number> = {};

function getNextPlaceholder(label: string): string {
  const key = label.toUpperCase().replace(/\s+/g, "_");
  counters[key] = (counters[key] || 0) + 1;
  return `[${key}_${counters[key]}]`;
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
  existingMapping: MappingEntry[] = []
): Promise<{ anonymizedText: string; mapping: MappingEntry[]; entitiesFound: number }> {
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
      });
    }
  }

  // No entities found — return as-is
  if (allEntities.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0 };
  }

  // 3. Deduplicate overlapping spans
  const unique = deduplicateSpans(allEntities);

  // 4. Sort by position (reverse) to replace from end to start
  unique.sort((a, b) => b.start - a.start);

  // 5. Build mapping and replace
  const newMapping: MappingEntry[] = [...existingMapping];
  let result = text;

  for (const entity of unique) {
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
    entitiesFound: unique.length,
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
