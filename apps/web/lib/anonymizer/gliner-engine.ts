"use client";

import nlp from "compromise";

export type ProgressCallback = (message: string) => void;

interface DetectedEntity {
  text: string;
  start: number;
  end: number;
  label: string;
  score: number;
}

// ─── Compromise.js NLP (instant, no model download) ───

function detectWithCompromise(text: string): DetectedEntity[] {
  const doc = nlp(text);
  const entities: DetectedEntity[] = [];

  // Person names
  doc.people().forEach((m: any) => {
    const t = m.text();
    const offset = text.indexOf(t);
    if (offset >= 0 && t.length >= 3) {
      entities.push({ text: t, start: offset, end: offset + t.length, label: "person", score: 0.7 });
    }
  });

  // Organizations
  doc.organizations().forEach((m: any) => {
    const t = m.text();
    const offset = text.indexOf(t);
    if (offset >= 0 && t.length >= 2) {
      entities.push({ text: t, start: offset, end: offset + t.length, label: "organization", score: 0.65 });
    }
  });

  // Places/locations
  doc.places().forEach((m: any) => {
    const t = m.text();
    const offset = text.indexOf(t);
    if (offset >= 0 && t.length >= 3) {
      entities.push({ text: t, start: offset, end: offset + t.length, label: "location", score: 0.6 });
    }
  });

  return entities;
}

// ─── ML Worker (CDN-loaded, background) ───

let mlWorker: Worker | null = null;
let mlReady = false;
let compromiseReady = false;
let loadingPromise: Promise<void> | null = null;
let detectIdCounter = 0;

const pendingDetects: Record<number, { resolve: (v: any) => void; reject: (err: Error) => void }> = {};
let initProgressCallback: ProgressCallback | null = null;
let initResolve: (() => void) | null = null;
let initReject: ((err: Error) => void) | null = null;

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

/**
 * Initialize the PII detection engine.
 * Compromise.js is ready instantly (npm package, no download).
 * ML worker starts loading in background from CDN.
 */
export async function initGliner(onProgress?: ProgressCallback): Promise<void> {
  if (compromiseReady) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise<void>((resolve) => {
    initProgressCallback = onProgress || null;

    // Compromise.js is ready immediately — it's just a JS import
    compromiseReady = true;
    onProgress?.("Privacy engine active");
    console.log("[BurnChat] Compromise.js NLP ready (instant)");

    // Start ML worker in background (CDN-loaded, takes a few seconds)
    // The worker lives in /public/ — completely outside webpack
    try {
      mlWorker = new Worker("/ner-worker.js", { type: "module" });
      mlWorker.onmessage = handleWorkerMessage;
      mlWorker.onerror = (err) => {
        console.warn("[BurnChat] ML worker failed — continuing with Compromise.js + regex:", err);
      };
      mlWorker.postMessage({ type: "init" });
    } catch (err) {
      console.warn("[BurnChat] Worker creation failed, using Compromise.js + regex only:", err);
    }

    // Resolve immediately — Compromise.js is ready, ML is a bonus
    resolve();
  });

  return loadingPromise;
}

/**
 * Detect entities using all available layers:
 * 1. Compromise.js (instant, always available)
 * 2. ML model (if loaded — higher accuracy for names)
 */
export async function detectEntities(text: string): Promise<DetectedEntity[]> {
  if (!compromiseReady) return [];

  // Layer 1: Compromise.js (instant)
  const compromiseEntities = detectWithCompromise(text);

  // Layer 2: ML model (if ready)
  if (mlReady && mlWorker) {
    const id = ++detectIdCounter;
    const mlEntities = await new Promise<DetectedEntity[]>((resolve) => {
      pendingDetects[id] = { resolve, reject: () => resolve([]) };
      mlWorker!.postMessage({ type: "detect", id, text });
      setTimeout(() => {
        if (pendingDetects[id]) {
          console.warn("[BurnChat] ML inference timed out");
          delete pendingDetects[id];
          resolve([]);
        }
      }, 60000);
    });

    return deduplicateEntities([...compromiseEntities, ...mlEntities]);
  }

  return compromiseEntities;
}

/**
 * Batch detection for documents.
 */
export async function detectEntitiesBatch(texts: string[]): Promise<DetectedEntity[][]> {
  if (!compromiseReady) return texts.map(() => []);

  // Layer 1: Compromise.js for all chunks (instant)
  const compromiseResults = texts.map((t) => detectWithCompromise(t));

  // Layer 2: ML model batch (if ready)
  if (mlReady && mlWorker) {
    const id = ++detectIdCounter;
    const mlResults = await new Promise<DetectedEntity[][]>((resolve) => {
      pendingDetects[id] = { resolve, reject: () => resolve(texts.map(() => [])) };
      mlWorker!.postMessage({ type: "detect-batch", id, texts });
      setTimeout(() => {
        if (pendingDetects[id]) {
          console.warn("[BurnChat] Batch ML inference timed out");
          delete pendingDetects[id];
          resolve(texts.map(() => []));
        }
      }, 300000);
    });

    return texts.map((_, i) =>
      deduplicateEntities([...(compromiseResults[i] || []), ...(mlResults[i] || [])])
    );
  }

  return compromiseResults;
}

export function isGlinerReady(): boolean {
  return compromiseReady;
}

export function isMLReady(): boolean {
  return mlReady;
}

// ─── Helpers ───

function deduplicateEntities(entities: DetectedEntity[]): DetectedEntity[] {
  const sorted = [...entities].sort((a, b) => a.start - b.start || b.score - a.score);
  const result: DetectedEntity[] = [];
  for (const entity of sorted) {
    const overlaps = result.some((r) => entity.start < r.end && entity.end > r.start);
    if (!overlaps) result.push(entity);
  }
  return result;
}
