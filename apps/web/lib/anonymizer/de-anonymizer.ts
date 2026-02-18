import { MappingEntry } from "@/store/session-store";

/**
 * De-anonymize text by replacing fake values with real ones.
 * Uses the mapping stored in Zustand (browser memory only).
 */
export function deAnonymize(text: string, mapping: MappingEntry[]): string {
  if (!mapping || mapping.length === 0) return text;

  let result = text;
  // Sort by replacement length (longest first) to avoid partial matches
  const sorted = [...mapping].sort((a, b) => b.replacement.length - a.replacement.length);

  for (const entry of sorted) {
    result = result.replaceAll(entry.replacement, entry.original);
  }

  return result;
}

/**
 * Get a highlighted diff showing what was changed.
 * Returns an array of segments: { text: string, isChanged: boolean, entityType?: string }
 */
export function getAnonymizationDiff(
  originalText: string,
  mapping: MappingEntry[]
): Array<{ text: string; isChanged: boolean; original?: string; entityType?: string }> {
  if (!mapping || mapping.length === 0) {
    return [{ text: originalText, isChanged: false }];
  }

  // Sort mappings by their position in original text
  const sortedMappings = [...mapping]
    .map((m) => ({
      ...m,
      index: originalText.indexOf(m.original),
    }))
    .filter((m) => m.index !== -1)
    .sort((a, b) => a.index - b.index);

  const segments: Array<{ text: string; isChanged: boolean; original?: string; entityType?: string }> = [];
  let lastEnd = 0;

  for (const m of sortedMappings) {
    if (m.index > lastEnd) {
      segments.push({
        text: originalText.substring(lastEnd, m.index),
        isChanged: false,
      });
    }
    if (m.index >= lastEnd) {
      segments.push({
        text: m.replacement,
        isChanged: true,
        original: m.original,
        entityType: m.entity_type,
      });
      lastEnd = m.index + m.original.length;
    }
  }

  if (lastEnd < originalText.length) {
    segments.push({
      text: originalText.substring(lastEnd),
      isChanged: false,
    });
  }

  return segments;
}
