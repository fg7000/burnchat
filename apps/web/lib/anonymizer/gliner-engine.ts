"use client";

export type ProgressCallback = (message: string) => void;

interface DetectedEntity {
  text: string;
  start: number;
  end: number;
  label: string;
  score: number;
}

// ─── Compromise.js NLP (loaded from CDN, avoids webpack bundling) ───

let nlpFn: ((text: string) => any) | null = null;

function loadCompromiseFromCDN(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(); return; }
    if (nlpFn) { resolve(); return; }
    if ((window as any).nlp) {
      nlpFn = (window as any).nlp;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/compromise@14.14.3/builds/compromise.min.js";
    script.onload = () => {
      nlpFn = (window as any).nlp || null;
      if (nlpFn) console.log("[BurnChat] Compromise.js loaded from CDN");
      else console.warn("[BurnChat] Compromise.js loaded but window.nlp not found");
      resolve();
    };
    script.onerror = () => {
      console.warn("[BurnChat] Failed to load Compromise.js from CDN");
      resolve();
    };
    document.head.appendChild(script);
  });
}

function detectWithCompromise(text: string): DetectedEntity[] {
  if (!nlpFn) return [];
  if (text.length > 50000) {
    const results: DetectedEntity[] = [];
    let offset = 0;
    while (offset < text.length) {
      const chunk = text.slice(offset, offset + 50000);
      const chunkEntities = detectWithCompromiseSafe(chunk);
      for (const e of chunkEntities) {
        results.push({ ...e, start: e.start + offset, end: e.end + offset });
      }
      offset += 50000;
    }
    return results;
  }
  return detectWithCompromiseSafe(text);
}

function detectWithCompromiseSafe(text: string): DetectedEntity[] {
  if (!nlpFn) return [];
  try {
    const doc = nlpFn(text);
    const entities: DetectedEntity[] = [];

    doc.people().forEach((m: any) => {
      const t = m.text();
      const offset = text.indexOf(t);
      if (offset >= 0 && t.length >= 3) {
        entities.push({ text: t, start: offset, end: offset + t.length, label: "person", score: 0.7 });
      }
    });

    doc.organizations().forEach((m: any) => {
      const t = m.text();
      const offset = text.indexOf(t);
      if (offset >= 0 && t.length >= 2) {
        entities.push({ text: t, start: offset, end: offset + t.length, label: "organization", score: 0.65 });
      }
    });

    doc.places().forEach((m: any) => {
      const t = m.text();
      const offset = text.indexOf(t);
      if (offset >= 0 && t.length >= 3) {
        entities.push({ text: t, start: offset, end: offset + t.length, label: "location", score: 0.6 });
      }
    });

    return entities;
  } catch (err) {
    console.warn("[BurnChat] Compromise.js failed on chunk:", err);
    return [];
  }
}

// ─── ML Worker (CDN-loaded, background) ───

let mlWorker: Worker | null = null;
let mlReady = false;
let compromiseReady = false;
let loadingPromise: Promise<void> | null = null;
let detectIdCounter = 0;

const pendingDetects: Record<number, { resolve: (v: any) => void; reject: (err: Error) => void }> = {};
let initProgressCallback: ProgressCallback | null = null;

function handleWorkerMessage(e: MessageEvent) {
  const { type, id, entities, batchEntities, error, message } = e.data;
  if (type === "progress") {
    initProgressCallback?.(message);
  } else if (type === "init-done") {
    mlReady = true;
    console.log("[BurnChat] ML NER model ready (CDN worker)");
  } else if (type === "init-error") {
    console.warn("[BurnChat] ML model failed to load — Compromise.js + regex still active:", error);
  } else if (type === "detect-result") {
    const p = pendingDetects[id];
    if (p) { p.resolve(entities); delete pendingDetects[id]; }
  } else if (type === "detect-error") {
    const p = pendingDetects[id];
    if (p) { p.resolve([]); delete pendingDetects[id]; }
  } else if (type === "detect-batch-result") {
    const p = pendingDetects[id];
    if (p) { p.resolve(batchEntities); delete pendingDetects[id]; }
  } else if (type === "detect-batch-error") {
    const p = pendingDetects[id];
    if (p) { p.resolve([]); delete pendingDetects[id]; }
  }
}

export async function initGliner(onProgress?: ProgressCallback): Promise<void> {
  if (compromiseReady) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise<void>(async (resolve) => {
    initProgressCallback = onProgress || null;

    // Load Compromise.js from CDN
    await loadCompromiseFromCDN();
    compromiseReady = true;
    onProgress?.("Privacy engine active");

    // Start ML worker in background
    try {
      mlWorker = new Worker("/ner-worker.js", { type: "module" });
      mlWorker.onmessage = handleWorkerMessage;
      mlWorker.onerror = (err) => {
        console.warn("[BurnChat] ML worker failed — continuing with Compromise.js + regex:", err);
      };
      mlWorker.postMessage({ type: "init" });
    } catch (err) {
      console.warn("[BurnChat] Worker creation failed:", err);
    }

    resolve();
  });

  return loadingPromise;
}

export async function detectEntities(text: string): Promise<DetectedEntity[]> {
  if (!compromiseReady) return [];

  const compromiseEntities = detectWithCompromise(text);

  if (mlReady && mlWorker) {
    const id = ++detectIdCounter;
    const mlEntities = await new Promise<DetectedEntity[]>((resolve) => {
      pendingDetects[id] = { resolve, reject: () => resolve([]) };
      mlWorker!.postMessage({ type: "detect", id, text });
      setTimeout(() => {
        if (pendingDetects[id]) { delete pendingDetects[id]; resolve([]); }
      }, 60000);
    });
    return deduplicateEntities([...compromiseEntities, ...mlEntities]);
  }

  return compromiseEntities;
}

export async function detectEntitiesBatch(texts: string[]): Promise<DetectedEntity[][]> {
  if (!compromiseReady) return texts.map(() => []);

  const compromiseResults = texts.map((t) => detectWithCompromise(t));

  if (mlReady && mlWorker) {
    const id = ++detectIdCounter;
    const mlResults = await new Promise<DetectedEntity[][]>((resolve) => {
      pendingDetects[id] = { resolve, reject: () => resolve(texts.map(() => [])) };
      mlWorker!.postMessage({ type: "detect-batch", id, texts });
      setTimeout(() => {
        if (pendingDetects[id]) { delete pendingDetects[id]; resolve(texts.map(() => [])); }
      }, 300000);
    });
    return texts.map((_, i) =>
      deduplicateEntities([...(compromiseResults[i] || []), ...(mlResults[i] || [])])
    );
  }

  return compromiseResults;
}

export function isGlinerReady(): boolean { return compromiseReady; }
export function isMLReady(): boolean { return mlReady; }

function deduplicateEntities(entities: DetectedEntity[]): DetectedEntity[] {
  const sorted = [...entities].sort((a, b) => a.start - b.start || b.score - a.score);
  const result: DetectedEntity[] = [];
  for (const entity of sorted) {
    const overlaps = result.some((r) => entity.start < r.end && entity.end > r.start);
    if (!overlaps) result.push(entity);
  }
  return result;
}
