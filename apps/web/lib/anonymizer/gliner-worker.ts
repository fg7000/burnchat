/**
 * GLiNER Web Worker — runs PII detection off the main thread.
 * Uses the SMALL model for speed. Server-side Presidio is the safety net.
 */

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

let glinerInstance: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, id, text, texts } = e.data;

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
        threshold: 0.5,
        flatNer: true,
      });
      const entities = (results[0] || []).map((r: any) => ({
        text: r.spanText, start: r.start, end: r.end, label: r.label, score: r.score,
      }));
      self.postMessage({ type: "detect-result", id, entities });
    } catch (err: any) {
      self.postMessage({ type: "detect-error", id, error: err?.message || String(err) });
    }
  } else if (type === "detect-batch") {
    if (!glinerInstance) {
      self.postMessage({ type: "detect-batch-result", id, batchEntities: texts.map(() => []) });
      return;
    }
    try {
      const results = await glinerInstance.inference({
        texts: texts,
        entities: ENTITY_LABELS,
        threshold: 0.5,
        flatNer: true,
      });
      const batchEntities = results.map((chunkResults: any[]) =>
        (chunkResults || []).map((r: any) => ({
          text: r.spanText, start: r.start, end: r.end, label: r.label, score: r.score,
        }))
      );
      self.postMessage({ type: "detect-batch-result", id, batchEntities });
    } catch (err: any) {
      self.postMessage({ type: "detect-batch-error", id, error: err?.message || String(err) });
    }
  }
};
