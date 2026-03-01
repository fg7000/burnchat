/**
 * NER Web Worker — loads Transformers.js from CDN at runtime.
 * Lives in /public/ so webpack never touches it.
 * Runs bert-base-NER for person/location/organization detection.
 */

let classifier = null;

self.onmessage = async (e) => {
  const { type, id, text, texts } = e.data;

  if (type === "init") {
    try {
      self.postMessage({ type: "progress", message: "Loading ML model..." });

      // Dynamic import from CDN — bypasses webpack entirely
      const { pipeline, env } = await import(
        "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0"
      );

      // Don't try to load models from local filesystem
      env.allowLocalModels = false;

      self.postMessage({ type: "progress", message: "Initializing NER model..." });

      // Xenova/bert-base-NER: pre-converted ONNX, ~108MB quantized
      // Detects PER, LOC, ORG, MISC — exactly what regex can't catch
      classifier = await pipeline(
        "token-classification",
        "Xenova/bert-base-NER",
        { dtype: "q8", device: "wasm" }
      );

      console.log("[BurnChat Worker] bert-base-NER loaded from CDN");
      self.postMessage({ type: "init-done" });
    } catch (err) {
      console.error("[BurnChat Worker] ML model init failed:", err);
      self.postMessage({ type: "init-error", error: err?.message || String(err) });
    }
  } else if (type === "detect") {
    if (!classifier) {
      self.postMessage({ type: "detect-result", id, entities: [] });
      return;
    }
    try {
      const start = performance.now();
      const results = await classifier(text, { ignore_labels: ["O"] });
      const elapsed = Math.round(performance.now() - start);
      console.log(`[BurnChat Worker] NER inference: ${elapsed}ms for ${text.length} chars`);

      // Map entity_group labels to our internal labels
      const labelMap = {
        PER: "person",
        LOC: "location",
        ORG: "organization",
        MISC: "organization",
      };

      const entities = (results || []).map((r) => ({
        text: r.word.replace(/^##/, ""),
        start: r.start,
        end: r.end,
        label: labelMap[r.entity_group] || r.entity_group || "person",
        score: r.score,
      }));

      self.postMessage({ type: "detect-result", id, entities });
    } catch (err) {
      console.error("[BurnChat Worker] NER inference failed:", err);
      self.postMessage({ type: "detect-error", id, error: err?.message || String(err) });
    }
  } else if (type === "detect-batch") {
    if (!classifier) {
      self.postMessage({ type: "detect-batch-result", id, batchEntities: texts.map(() => []) });
      return;
    }
    try {
      const start = performance.now();
      const labelMap = { PER: "person", LOC: "location", ORG: "organization", MISC: "organization" };
      const batchEntities = [];

      for (const chunk of texts) {
        const results = await classifier(chunk, { ignore_labels: ["O"] });
        batchEntities.push(
          (results || []).map((r) => ({
            text: r.word.replace(/^##/, ""),
            start: r.start,
            end: r.end,
            label: labelMap[r.entity_group] || r.entity_group || "person",
            score: r.score,
          }))
        );
      }

      const elapsed = Math.round(performance.now() - start);
      console.log(`[BurnChat Worker] Batch NER: ${elapsed}ms for ${texts.length} chunks`);
      self.postMessage({ type: "detect-batch-result", id, batchEntities });
    } catch (err) {
      console.error("[BurnChat Worker] Batch NER failed:", err);
      self.postMessage({ type: "detect-batch-error", id, error: err?.message || String(err) });
    }
  }
};
