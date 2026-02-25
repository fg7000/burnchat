"use client";

/**
 * GLiNER Engine - Browser-side NER using ONNX Runtime
 * Model downloads once (~45MB) and gets cached by the browser.
 * All inference runs locally - no PII leaves the device.
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
  tokenizerPath: "onnx-community/gliner_small-v2",
  onnxSettings: {
    modelPath: "https://huggingface.co/onnx-community/gliner_small-v2/resolve/main/onnx/model.onnx",
    executionProvider: "cpu" as const,
  },
  transformersSettings: {
    useBrowserCache: true,
  },
};

// Entity types to detect
const ENTITY_LABELS = [
  "person",
  "location",
  "organization",
  "date of birth",
  "address",
];

export type ProgressCallback = (message: string) => void;

/**
 * Initialize GLiNER model. Safe to call multiple times -
 * returns immediately if already loaded or loading.
 */
export async function initGliner(onProgress?: ProgressCallback): Promise<void> {
  if (ready) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      onProgress?.("Downloading privacy model...");

      // Dynamic import to avoid SSR issues
      const glinerModule = await import("gliner");
      // The export might be default, Gliner, GLiNER, or the module itself
      const GlinerClass = glinerModule.default || glinerModule.Gliner || glinerModule.GLiNER || glinerModule;
      
      console.log("[BurnChat] GLiNER module keys:", Object.keys(glinerModule));
      console.log("[BurnChat] Using constructor:", GlinerClass?.name || typeof GlinerClass);

      const instance = new (GlinerClass as any)(MODEL_CONFIG);

      onProgress?.("Initializing privacy engine...");
      await instance.initialize();

      glinerInstance = instance as unknown as GlinerInstance;
      ready = true;
      onProgress?.("Privacy engine ready ✓");
    } catch (err) {
      console.error("GLiNER init failed:", err);
      loadingPromise = null;
      throw err;
    }
  })();

  return loadingPromise;
}

/**
 * Detect named entities in text.
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
      threshold: 0.4,
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
    console.error("GLiNER inference failed:", err);
    return [];
  }
}

export function isGlinerReady(): boolean {
  return ready;
}
