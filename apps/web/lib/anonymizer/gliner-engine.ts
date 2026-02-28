"use client";

/**
 * GLiNER PII Engine - Browser-side Named Entity Recognition
 * 
 * Uses the PII-specific GLiNER model (gliner_multi_pii-v1) which is
 * fine-tuned for detecting personally identifiable information.
 * 60+ PII categories vs the 4 generic NER categories of the old model.
 * 
 * Model downloads once (~90MB) and gets cached by the browser.
 * All inference runs locally — no PII ever leaves the device.
 */

type GlinerInstance = {
  inference: (params: {
    texts: string[];
    entities: string[];
    threshold?: number;
    flatNer?: boolean;
  }) => Promise<Array<Array<{
    spanText: string;
    start: number;
    end: number;
    label: string;
    score: number;
  }>>>;
};

let glinerInstance: GlinerInstance | null = null;
let loadingPromise: Promise<void> | null = null;
let ready = false;

const MODEL_CONFIG = {
  tokenizerPath: "onnx-community/gliner_multi_pii-v1",
  onnxSettings: {
    modelPath: "https://huggingface.co/onnx-community/gliner_multi_pii-v1/resolve/main/onnx/model.onnx",
    executionProvider: "cpu" as const,
  },
  transformersSettings: {
    useBrowserCache: true,
  },
};

/**
 * PII-focused entity labels.
 * The PII model is trained specifically on these categories and will
 * NOT misclassify durations as dates or tool names as people.
 * 
 * We ask for the entities we actually want to anonymize — not generic
 * NER categories. GLiNER's zero-shot design means we can be specific.
 */
const ENTITY_LABELS = [
  "person",
  "email",
  "phone number",
  "address",
  "social security number",
  "date of birth",
  "credit card number",
  "bank account number",
  "passport number",
  "driver's license number",
  "medical record number",
  "ip address",
  "username",
];

export type ProgressCallback = (message: string) => void;

/**
 * Initialize GLiNER model. Safe to call multiple times —
 * returns immediately if already loaded or loading.
 */
export async function initGliner(onProgress?: ProgressCallback): Promise<void> {
  if (ready) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      onProgress?.("Downloading privacy model...");

      const glinerModule = await import("gliner");
      const GlinerClass = glinerModule.default || glinerModule.Gliner || glinerModule.GLiNER || glinerModule;

      console.log("[BurnChat] GLiNER PII module keys:", Object.keys(glinerModule));
      console.log("[BurnChat] Using constructor:", GlinerClass?.name || typeof GlinerClass);

      const instance = new (GlinerClass as any)(MODEL_CONFIG);

      onProgress?.("Initializing privacy engine...");
      await instance.initialize();

      glinerInstance = instance as unknown as GlinerInstance;
      ready = true;
      onProgress?.("Privacy engine ready ✓");
      console.log("[BurnChat] GLiNER PII model loaded — all detection runs locally");
    } catch (err) {
      console.error("GLiNER PII init failed:", err);
      loadingPromise = null;
      throw err;
    }
  })();

  return loadingPromise;
}

/**
 * Detect PII entities in text.
 * Returns empty array if model not loaded (regex still runs separately).
 */
export async function detectEntities(text: string): Promise<Array<{
  text: string;
  start: number;
  end: number;
  label: string;
  score: number;
}>> {
  if (!glinerInstance || !ready) return [];

  try {
    const results = await glinerInstance.inference({
      texts: [text],
      entities: ENTITY_LABELS,
      threshold: 0.5,
      flatNer: true,
    });

    return (results[0] || []).map((r) => ({
      text: r.spanText,
      start: r.start,
      end: r.end,
      label: r.label,
      score: r.score,
    }));
  } catch (err) {
    console.error("GLiNER PII inference failed:", err);
    return [];
  }
}

export function isGlinerReady(): boolean {
  return ready;
}
