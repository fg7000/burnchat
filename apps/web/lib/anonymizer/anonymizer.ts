import { detectEntities, isGlinerReady } from "./gliner-engine";
import { detectContext, shouldKeepEntity, type ContextType } from "./context-rules";
import { MappingEntry } from "@/store/session-store";

const PII_REGEX: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "social security number" },
  { pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, label: "email" },
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: "phone number" },
  { pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, label: "credit card number" },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, label: "ip address" },
  { pattern: /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Judge|Rev)\.?\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g, label: "person" },
];

interface DetectedEntity {
  text: string;
  start: number;
  end: number;
  label: string;
  score?: number;
}

function normalizeLabel(label: string): string {
  const map: Record<string, string> = {
    "person": "PERSON", "email": "EMAIL_ADDRESS", "phone number": "PHONE_NUMBER",
    "address": "ADDRESS", "social security number": "SSN", "date of birth": "DATE_OF_BIRTH",
    "credit card number": "CREDIT_CARD", "bank account number": "BANK_ACCOUNT",
    "passport number": "PASSPORT", "driver's license number": "DRIVERS_LICENSE",
    "medical record number": "MEDICAL_RECORD", "ip address": "IP_ADDRESS",
    "username": "USERNAME", "location": "LOCATION", "organization": "ORGANIZATION",
  };
  return map[label.toLowerCase()] || label.toUpperCase().replace(/\s+/g, "_");
}

const FAKE_VALUES: Record<string, string[]> = {
  PERSON: [
    "James Mitchell", "Sarah Chen", "Robert Miller", "Maria Santos",
    "David Park", "Emily Watson", "Michael Brown", "Lisa Anderson",
    "Thomas Wright", "Jennifer Lee", "William Harris", "Amanda Clark",
    "Christopher Young", "Rachel Kim", "Daniel Moore", "Karen White",
  ],
  LOCATION: ["Westfield", "Oakridge", "Riverside County", "Lakewood",
    "Cedar Heights", "Maple Grove", "Fairview", "Springdale"],
  ORGANIZATION: ["Meridian Corp", "Atlas Group", "Pinnacle Solutions", "Vanguard LLC",
    "Sterling Associates", "Horizon Partners", "Apex Industries", "Nova Consulting"],
  EMAIL_ADDRESS: ["jmitchell@example.com", "schen@example.org", "rmiller@example.com",
    "msantos@example.org", "dpark@example.com", "ewatson@example.org"],
  PHONE_NUMBER: ["(555) 123-4567", "(555) 234-5678", "(555) 345-6789",
    "(555) 456-7890", "(555) 567-8901", "(555) 678-9012"],
  DATE_OF_BIRTH: ["March 15, 1985", "July 22, 1990", "November 3, 1978",
    "January 8, 1992", "September 19, 1988", "April 30, 1975"],
  ADDRESS: ["742 Elm Street, Apt 4B", "1200 Oak Avenue, Suite 200", "89 Pine Road",
    "456 Maple Drive", "321 Cedar Lane", "678 Birch Court, Unit 12"],
  SSN: ["***-**-4567", "***-**-8901", "***-**-2345", "***-**-6789", "***-**-0123", "***-**-4561"],
  CREDIT_CARD: ["****-****-****-1234", "****-****-****-5678", "****-****-****-9012"],
  BANK_ACCOUNT: ["****4567", "****8901", "****2345", "****6789"],
  PASSPORT: ["X12345678", "Y98765432", "Z45678901"],
  DRIVERS_LICENSE: ["D1234567", "D9876543", "D4567890"],
  MEDICAL_RECORD: ["MRN-0001234", "MRN-0005678", "MRN-0009012"],
  IP_ADDRESS: ["192.168.1.100", "10.0.0.50", "172.16.0.25"],
  USERNAME: ["user_alpha", "user_beta", "user_gamma", "user_delta"],
};

const counters: Record<string, number> = {};

function getNextPlaceholder(normalizedLabel: string): string {
  counters[normalizedLabel] = (counters[normalizedLabel] || 0) + 1;
  const pool = FAKE_VALUES[normalizedLabel] || FAKE_VALUES["PERSON"];
  const idx = (counters[normalizedLabel] - 1) % pool.length;
  return pool[idx];
}

function resolvePlaceholder(entityText: string, normalizedLabel: string, mapping: MappingEntry[]): string {
  const existing = mapping.find((m) => m.original.toLowerCase() === entityText.toLowerCase());
  if (existing) return existing.replacement;
  return getNextPlaceholder(normalizedLabel);
}

function deduplicateSpans(spans: DetectedEntity[]): DetectedEntity[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const result: DetectedEntity[] = [];
  for (const span of sorted) {
    const overlaps = result.some((r) => span.start < r.end && span.end > r.start);
    if (!overlaps) result.push(span);
  }
  return result;
}

function isLikelyRealEntity(e: DetectedEntity): boolean {
  if (e.text.length <= 2) return false;
  if (e.score !== undefined && e.score < 0.4) return false;
  return true;
}

function catchNameFragments(text: string, mapping: MappingEntry[]): { text: string; extraCount: number } {
  let result = text;
  let extraCount = 0;
  const personMappings = mapping.filter((m) => m.entity_type === "PERSON");
  for (const m of personMappings) {
    const origWords = m.original.split(/\s+/).filter((w) => w.length >= 3);
    const replWords = m.replacement.split(/\s+/);
    for (let i = 0; i < origWords.length; i++) {
      const origWord = origWords[i];
      const escaped = origWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp("(?<![A-Za-z])" + escaped + "(?![A-Za-z])", "gi");
      if (pattern.test(result)) {
        pattern.lastIndex = 0;
        const replWord = replWords[i] || replWords[replWords.length - 1] || m.replacement;
        result = result.replace(pattern, replWord);
        extraCount++;
      }
    }
  }
  return { text: result, extraCount };
}

function globalMappingSweep(text: string, mapping: MappingEntry[]): string {
  let result = text;
  const sorted = [...mapping].sort((a, b) => b.original.length - a.original.length);
  for (const m of sorted) {
    const escaped = m.original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "gi");
    result = result.replace(pattern, m.replacement);
  }
  return result;
}

export async function anonymizeText(
  text: string,
  existingMapping: MappingEntry[] = [],
  contextOverride?: ContextType
): Promise<{ anonymizedText: string; mapping: MappingEntry[]; entitiesFound: number; detectedContext: ContextType }> {
  const detectedContext = contextOverride || detectContext(text);
  const allEntities: DetectedEntity[] = [];

  for (const { pattern, label } of PII_REGEX) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      allEntities.push({ text: match[0], start: match.index, end: match.index + match[0].length, label });
    }
  }

  if (isGlinerReady()) {
    const nerEntities = await detectEntities(text);
    for (const e of nerEntities) {
      allEntities.push({ text: e.text, start: e.start, end: e.end, label: e.label, score: e.score });
    }
  }

  const filtered = allEntities.filter((e) => isLikelyRealEntity(e));
  if (filtered.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0, detectedContext };
  }

  const unique = deduplicateSpans(filtered);
  const contextFiltered = unique.filter((e) => {
    const normalized = normalizeLabel(e.label);
    return !shouldKeepEntity(normalized, detectedContext);
  });

  if (contextFiltered.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0, detectedContext };
  }

  contextFiltered.sort((a, b) => b.start - a.start);

  const newMapping: MappingEntry[] = [...existingMapping];
  let result = text;

  for (const entity of contextFiltered) {
    const normalized = normalizeLabel(entity.label);
    const placeholder = resolvePlaceholder(entity.text, normalized, newMapping);
    if (!newMapping.find((m) => m.original.toLowerCase() === entity.text.toLowerCase())) {
      newMapping.push({ original: entity.text, replacement: placeholder, entity_type: normalized });
    }
    result = result.slice(0, entity.start) + placeholder + result.slice(entity.end);
  }

  const { text: finalResult, extraCount } = catchNameFragments(result, newMapping);

  return {
    anonymizedText: finalResult,
    mapping: newMapping,
    entitiesFound: contextFiltered.length + extraCount,
    detectedContext,
  };
}

export async function anonymizeDocument(
  text: string,
  onProgress?: (pct: number, detail: string) => void,
): Promise<{
  anonymized_text: string;
  mapping: MappingEntry[];
  entities_found: Array<{ type: string; count: number }>;
}> {
  const CHUNK_SIZE = 4000;
  const chunks = splitTextIntoChunks(text, CHUNK_SIZE);

  let allAnonymized = "";
  let accumulatedMapping: MappingEntry[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(Math.round((i / chunks.length) * 100), `Scanning part ${i + 1} of ${chunks.length}...`);
    const result = await anonymizeText(chunks[i], accumulatedMapping);
    allAnonymized += result.anonymizedText;
    accumulatedMapping = result.mapping;
  }

  allAnonymized = globalMappingSweep(allAnonymized, accumulatedMapping);
  const { text: swept } = catchNameFragments(allAnonymized, accumulatedMapping);
  allAnonymized = swept;

  onProgress?.(100, "Anonymization complete");

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

export function resetCounters(): void {
  for (const key of Object.keys(counters)) { delete counters[key]; }
}
