/**
 * GLiNER Web Worker — runs PII detection off the main thread.
 * Uses the SMALL model for speed. Server-side Presidio is the safety net.
 */

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

const ENTITY_LABELS = [
  "person",
  "location",
  "organization",
  "date of birth",
  "address",
];

let glinerInstance: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, id, text } = e.data;

  if (type === "init") {
    try {
      self.postMessage({ type: "progress", message: "Downloading privacy model..." });
      const glinerModule = await import("gliner");
      const GlinerClass = glinerModule.default || glinerModule.Gliner || glinerModule.GLiNER || glinerModule;
      const instance = new (GlinerClass as any)(MODEL_CONFIG);
      self.postMessage({ type: "progress", message: "Initializing privacy engine..." });
      await instance.initialize();
      glinerInstance = instance;
      self.postMessage({ type: "progress", message: "Privacy engine ready" });
      self.postMessage({ type: "init-done" });
      console.log("[BurnChat Worker] GLiNER small model loaded");
    } catch (err: any) {
      console.error("[BurnChat Worker] GLiNER init failed:", err);
      self.postMessage({ type: "init-error", error: err?.message || String(err) });
    }
  } else if (type === "detect") {
    if (!glinerInstance) {
      self.postMessage({ type: "detect-result", id, entities: [] });
      return;
    }
    try {
      const results = await glinerInstance.inference({
        texts: [text],
        entities: ENTITY_LABELS,
        threshold: 0.6,
        flatNer: true,
      });
      const entities = (results[0] || []).map((r: any) => ({
        text: r.spanText,
        start: r.start,
        end: r.end,
        label: r.label,
        score: r.score,
      }));
      self.postMessage({ type: "detect-result", id, entities });
    } catch (err: any) {
      self.postMessage({ type: "detect-error", id, error: err?.message || String(err) });
    }
  }
};
