import { detectEntities, isGlinerReady } from "./gliner-engine";
import { detectContext, shouldKeepEntity, type ContextType } from "./context-rules";
import { MappingEntry } from "@/store/session-store";

// ─── Regex PII patterns (instant, zero-cost) ───────────────────────────────

const PII_REGEX: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "social security number" },
  { pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, label: "email" },
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: "phone number" },
  { pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, label: "credit card number" },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, label: "ip address" },
  { pattern: /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Judge|Rev)\.?\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g, label: "person" },
];

// ─── Additional regex for addresses (catches what model may miss) ───────────

const ADDRESS_REGEX = /\b\d{1,5}\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Circle|Cir|Court|Ct|Place|Pl|Way|Terrace|Ter|Parkway|Pkwy|Highway|Hwy)\.?(?:\s+(?:North|South|East|West|N|S|E|W))?(?:,?\s*(?:Apt|Apartment|Suite|Ste|Unit|Floor|Fl|#)\s*[A-Za-z0-9]+)?(?:,?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)?(?:,?\s*(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY))?(?:,?\s*\d{5}(?:-\d{4})?)?\b/g;

// ─── Smart address parsing ──────────────────────────────────────────────────

const US_STATES: Record<string, string> = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
  "colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA",
  "hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS",
  "kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA",
  "michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT",
  "nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM",
  "new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK",
  "oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC",
  "south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT",
  "virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
};
const STATE_ABBREVS = new Set(Object.values(US_STATES));

const STREET_SUFFIXES = /\b(Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Circle|Cir|Court|Ct|Place|Pl|Way|Terrace|Ter|Parkway|Pkwy|Highway|Hwy)\.?\b/i;

interface AddressParts {
  streetNumber: string;
  streetName: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  raw: string;
}

function parseAddress(text: string): AddressParts | null {
  const raw = text.trim();
  const parts: AddressParts = { streetNumber: "", streetName: "", unit: "", city: "", state: "", zip: "", raw };

  // Extract ZIP code (5 or 5-4 digits at end)
  const zipMatch = raw.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
  if (zipMatch) {
    parts.zip = zipMatch[1];
  }

  // Extract state
  let remaining = zipMatch ? raw.slice(0, zipMatch.index).trim().replace(/,\s*$/, "") : raw;
  for (const [fullName, abbrev] of Object.entries(US_STATES)) {
    const stateRegex = new RegExp("\\b" + fullName.replace(/\s+/g, "\\s+") + "\\s*$", "i");
    if (stateRegex.test(remaining)) {
      parts.state = remaining.match(stateRegex)![0].trim();
      remaining = remaining.slice(0, remaining.search(stateRegex)).trim().replace(/,\s*$/, "");
      break;
    }
  }
  if (!parts.state) {
    const abbrevMatch = remaining.match(/\b([A-Z]{2})\s*$/);
    if (abbrevMatch && STATE_ABBREVS.has(abbrevMatch[1])) {
      parts.state = abbrevMatch[1];
      remaining = remaining.slice(0, abbrevMatch.index).trim().replace(/,\s*$/, "");
    }
  }

  // Extract unit (Apt, Suite, Unit, #, Floor)
  const unitMatch = remaining.match(/,?\s*(?:Apt|Apartment|Suite|Ste|Unit|Floor|Fl|#)\s*[A-Za-z0-9]+\s*$/i);
  if (unitMatch) {
    parts.unit = unitMatch[0].replace(/^,?\s*/, "").trim();
    remaining = remaining.slice(0, unitMatch.index).trim().replace(/,\s*$/, "");
  }

  // Extract city (last comma-separated segment before state/unit)
  if (STREET_SUFFIXES.test(remaining)) {
    const lastComma = remaining.lastIndexOf(",");
    if (lastComma > 0) {
      parts.city = remaining.slice(lastComma + 1).trim();
      remaining = remaining.slice(0, lastComma).trim();
    }
  }

  // Extract street number (leading digits)
  const numMatch = remaining.match(/^(\d+)\s+/);
  if (numMatch) {
    parts.streetNumber = numMatch[1];
    parts.streetName = remaining.slice(numMatch[0].length).trim();
  } else {
    parts.streetName = remaining;
  }

  // Only valid if we found at least a street
  if (!parts.streetNumber && !parts.streetName) return null;
  return parts;
}

const FAKE_STREETS = [
  "742 Elm Street", "1200 Oak Avenue", "89 Pine Road", "456 Maple Drive",
  "321 Cedar Lane", "678 Birch Court", "155 Willow Way", "910 Spruce Terrace",
  "2400 Aspen Boulevard", "367 Juniper Circle",
];
const FAKE_UNITS = ["Apt 4B", "Suite 200", "Unit 7", "Floor 3", "#12A", "Suite 100"];

let streetCounter = 0;
let unitCounter = 0;

/**
 * Smart address anonymization: replace street/unit/ZIP, keep city/state.
 * For legal documents, jurisdiction (city + state) must be preserved.
 */
function smartReplaceAddress(original: string): string {
  const parsed = parseAddress(original);
  if (!parsed) {
    // Can't parse — fall back to full replacement
    return FAKE_STREETS[streetCounter++ % FAKE_STREETS.length];
  }

  let result = FAKE_STREETS[streetCounter++ % FAKE_STREETS.length];

  if (parsed.unit) {
    result += ", " + FAKE_UNITS[unitCounter++ % FAKE_UNITS.length];
  }

  // KEEP city and state — these are jurisdiction, not PII
  if (parsed.city) {
    result += ", " + parsed.city;
  }
  if (parsed.state) {
    result += ", " + parsed.state;
  }

  // Replace ZIP with fake
  if (parsed.zip) {
    result += " " + fakeZip(parsed.zip);
  }

  return result;
}

function fakeZip(realZip: string): string {
  // Keep format (5-digit or 5+4) but randomize last 3 digits
  if (realZip.includes("-")) {
    return realZip.slice(0, 2) + "XXX-XXXX";
  }
  return realZip.slice(0, 2) + "XXX";
}

// ─── Entity processing ──────────────────────────────────────────────────────

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
    "address": "ADDRESS", "street": "ADDRESS", "city": "CITY", "state": "STATE",
    "zip": "ZIP", "social security number": "SSN", "date of birth": "DATE_OF_BIRTH",
    "credit card number": "CREDIT_CARD", "bank account number": "BANK_ACCOUNT",
    "passport number": "PASSPORT", "driver's license number": "DRIVERS_LICENSE",
    "medical record number": "MEDICAL_RECORD", "ip address": "IP_ADDRESS",
    "username": "USERNAME", "location": "ADDRESS", "organization": "ORGANIZATION",
    "url": "URL", "age": "AGE", "title": "TITLE", "password": "PASSWORD",
    "financial": "FINANCIAL", "device id": "DEVICE_ID", "license plate": "LICENSE_PLATE",
    "coordinate": "COORDINATE",
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
  ORGANIZATION: ["Meridian Corp", "Atlas Group", "Pinnacle Solutions", "Vanguard LLC",
    "Sterling Associates", "Horizon Partners", "Apex Industries", "Nova Consulting"],
  EMAIL_ADDRESS: ["jmitchell@example.com", "schen@example.org", "rmiller@example.com",
    "msantos@example.org", "dpark@example.com", "ewatson@example.org"],
  PHONE_NUMBER: ["(555) 123-4567", "(555) 234-5678", "(555) 345-6789",
    "(555) 456-7890", "(555) 567-8901", "(555) 678-9012"],
  DATE_OF_BIRTH: ["March 15, 1985", "July 22, 1990", "November 3, 1978",
    "January 8, 1992", "September 19, 1988", "April 30, 1975"],
  SSN: ["***-**-4567", "***-**-8901", "***-**-2345", "***-**-6789"],
  CREDIT_CARD: ["****-****-****-1234", "****-****-****-5678", "****-****-****-9012"],
  BANK_ACCOUNT: ["****4567", "****8901", "****2345", "****6789"],
  PASSPORT: ["X12345678", "Y98765432", "Z45678901"],
  DRIVERS_LICENSE: ["D1234567", "D9876543", "D4567890"],
  MEDICAL_RECORD: ["MRN-0001234", "MRN-0005678", "MRN-0009012"],
  IP_ADDRESS: ["192.168.1.100", "10.0.0.50", "172.16.0.25"],
  USERNAME: ["user_alpha", "user_beta", "user_gamma", "user_delta"],
  URL: ["https://example.com/page", "https://example.org/doc"],
  PASSWORD: ["[REDACTED]"],
  AGE: ["35", "42", "28", "51", "39"],
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

  // Smart address replacement — preserve city/state
  if (normalizedLabel === "ADDRESS" || normalizedLabel === "LOCATION") {
    return smartReplaceAddress(entityText);
  }

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
      const escaped = origWords[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function processChunk(
  text: string,
  existingMapping: MappingEntry[],
  nerEntities: DetectedEntity[],
): { anonymizedText: string; mapping: MappingEntry[]; entitiesFound: number } {
  const detectedContext = detectContext(text);
  const allEntities: DetectedEntity[] = [];

  // Regex patterns (instant)
  for (const { pattern, label } of PII_REGEX) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      allEntities.push({ text: match[0], start: match.index, end: match.index + match[0].length, label });
    }
  }

  // Address regex (catches structured addresses the model may miss)
  {
    const regex = new RegExp(ADDRESS_REGEX.source, ADDRESS_REGEX.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Only add if not already covered by NER
      const overlapsNer = nerEntities.some(
        (e) => match!.index < e.end && match!.index + match![0].length > e.start
      );
      if (!overlapsNer) {
        allEntities.push({ text: match[0], start: match.index, end: match.index + match[0].length, label: "address", score: 0.8 });
      }
    }
  }

  // NER entities from model
  for (const e of nerEntities) {
    allEntities.push(e);
  }

  const filtered = allEntities.filter((e) => isLikelyRealEntity(e));
  if (filtered.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0 };
  }

  const unique = deduplicateSpans(filtered);
  const contextFiltered = unique.filter((e) => {
    const normalized = normalizeLabel(e.label);
    // Never strip city/state labels — they're jurisdiction, not PII
    if (normalized === "CITY" || normalized === "STATE") return false;
    return !shouldKeepEntity(normalized, detectedContext);
  });

  if (contextFiltered.length === 0) {
    return { anonymizedText: text, mapping: existingMapping, entitiesFound: 0 };
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
  };
}

export async function anonymizeText(
  text: string,
  existingMapping: MappingEntry[] = [],
  contextOverride?: ContextType
): Promise<{ anonymizedText: string; mapping: MappingEntry[]; entitiesFound: number; detectedContext: ContextType }> {
  const detectedContext = contextOverride || detectContext(text);

  let nerEntities: DetectedEntity[] = [];
  if (isGlinerReady()) {
    nerEntities = (await detectEntities(text)).map((e) => ({
      text: e.text, start: e.start, end: e.end, label: e.label, score: e.score,
    }));
  }

  const result = processChunk(text, existingMapping, nerEntities);
  return { ...result, detectedContext };
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
    onProgress?.(
      Math.round(((i + 1) / chunks.length) * 90),
      `Scanning part ${i + 1} of ${chunks.length}...`
    );

    let nerEntities: DetectedEntity[] = [];
    if (isGlinerReady()) {
      nerEntities = (await detectEntities(chunks[i])).map((e) => ({
        text: e.text, start: e.start, end: e.end, label: e.label, score: e.score,
      }));
    }

    const result = processChunk(chunks[i], accumulatedMapping, nerEntities);
    allAnonymized += result.anonymizedText;
    accumulatedMapping = result.mapping;
  }

  onProgress?.(95, "Final sweep...");

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
  streetCounter = 0;
  unitCounter = 0;
}
