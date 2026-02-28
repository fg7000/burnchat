/**
 * PII Detection Web Worker — runs NER off the main thread.
 * Uses gravitee-io/bert-small-pii-detection (~28MB INT8) via Transformers.js.
 * 10-20x faster than the previous gliner_multi_pii-v1 (650MB).
 */

let classifier: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, id, text } = e.data;

  if (type === "init") {
    try {
      self.postMessage({ type: "progress", message: "Downloading privacy model..." });

      const { pipeline, env } = await import("@huggingface/transformers");

      // Configure for browser worker
      env.allowLocalModels = false;

      self.postMessage({ type: "progress", message: "Initializing privacy engine..." });

      // Load the tiny PII model — 28MB quantized vs 650MB before
      classifier = await pipeline(
        "token-classification",
        "gravitee-io/bert-small-pii-detection",
        {
          dtype: "q8",       // INT8 quantized
          device: "wasm",    // CPU via WebAssembly
        }
      );

      self.postMessage({ type: "progress", message: "Privacy engine ready" });
      self.postMessage({ type: "init-done" });
      console.log("[BurnChat Worker] bert-small-pii-detection loaded (INT8, ~28MB)");
    } catch (err: any) {
      console.error("[BurnChat Worker] PII model init failed:", err);
      self.postMessage({ type: "init-error", error: err?.message || String(err) });
    }
  } else if (type === "detect") {
    if (!classifier) {
      self.postMessage({ type: "detect-result", id, entities: [] });
      return;
    }
    try {
      const t0 = Date.now();

      // Transformers.js token-classification with aggregation
      const results = await classifier(text, {
        aggregation_strategy: "simple",
      });

      const elapsed = Date.now() - t0;

      // Map Transformers.js output → our entity format
      // Output: { entity_group, score, word, start, end }
      const entities = (results || [])
        .filter((r: any) => r.score >= 0.4)
        .map((r: any) => ({
          text: r.word || text.slice(r.start, r.end),
          start: r.start,
          end: r.end,
          label: mapLabel(r.entity_group || r.entity || ""),
          score: r.score,
        }));

      console.log(`[BurnChat Worker] #${id}: ${elapsed}ms, ${entities.length} entities found`);
      self.postMessage({ type: "detect-result", id, entities });
    } catch (err: any) {
      console.error(`[BurnChat Worker] Inference error:`, err);
      self.postMessage({ type: "detect-error", id, error: err?.message || String(err) });
    }
  }
};

/**
 * Map gravitee-io label names to our internal labels.
 * Model outputs: PERSON, LOCATION, ORGANIZATION, EMAIL_ADDRESS,
 * PHONE_NUMBER, US_SSN, CREDIT_CARD, IP_ADDRESS, DATE_TIME, URL, etc.
 */
function mapLabel(label: string): string {
  const clean = label.replace(/^[BI]-/, "").toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    PERSON: "person",
    LOCATION: "address",
    LOCATION_ADDRESS: "address",
    LOCATION_CITY: "city",
    LOCATION_STATE: "state",
    LOCATION_ZIP: "zip",
    LOCATION_STREET: "street",
    ORGANIZATION: "organization",
    EMAIL_ADDRESS: "email",
    PHONE_NUMBER: "phone number",
    US_SSN: "social security number",
    CREDIT_CARD: "credit card number",
    IP_ADDRESS: "ip address",
    DATE_TIME: "date of birth",
    URL: "url",
    US_PASSPORT: "passport number",
    US_DRIVER_LICENSE: "driver's license number",
    US_BANK_NUMBER: "bank account number",
    IBAN_CODE: "bank account number",
    NRP: "organization",
    AGE: "age",
    TITLE: "title",
    PASSWORD: "password",
    USERNAME: "username",
    FINANCIAL: "financial",
    MAC_ADDRESS: "ip address",
    IMEI: "device id",
    US_ITIN: "social security number",
    US_LICENSE_PLATE: "license plate",
    COORDINATE: "coordinate",
  };
  return map[clean] || clean.toLowerCase();
}
