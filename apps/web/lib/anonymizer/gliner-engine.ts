"use client";

export type ProgressCallback = (message: string) => void;

interface DetectedEntity {
  text: string;
  start: number;
  end: number;
  label: string;
  score: number;
}

let worker: Worker | null = null;
let ready = false;
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
    ready = true;
    console.log("[BurnChat] Privacy engine ready");
    initResolve?.();
  } else if (type === "init-error") {
    loadingPromise = null;
    initReject?.(new Error(error));
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
  if (ready) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise<void>((resolve, reject) => {
    initProgressCallback = onProgress || null;
    initResolve = resolve;
    initReject = reject;
    try {
      worker = new Worker(new URL("./gliner-worker.ts", import.meta.url));
      worker.onmessage = handleWorkerMessage;
      worker.onerror = () => { loadingPromise = null; reject(new Error("Worker failed")); };
      worker.postMessage({ type: "init" });
    } catch (err) { loadingPromise = null; reject(err); }
  });
  return loadingPromise;
}

export async function detectEntities(text: string): Promise<DetectedEntity[]> {
  if (!worker || !ready) return [];
  const id = ++detectIdCounter;
  return new Promise<DetectedEntity[]>((resolve) => {
    pendingDetects[id] = { resolve, reject: () => resolve([]) };
    worker!.postMessage({ type: "detect", id, text });
    setTimeout(() => { if (pendingDetects[id]) { delete pendingDetects[id]; resolve([]); } }, 30000);
  });
}

export async function detectEntitiesBatch(texts: string[]): Promise<DetectedEntity[][]> {
  if (!worker || !ready) return texts.map(() => []);
  const id = ++detectIdCounter;
  return new Promise<DetectedEntity[][]>((resolve) => {
    pendingDetects[id] = { resolve, reject: () => resolve(texts.map(() => [])) };
    worker!.postMessage({ type: "detect-batch", id, texts });
    setTimeout(() => { if (pendingDetects[id]) { delete pendingDetects[id]; resolve(texts.map(() => [])); } }, 60000);
  });
}

export function isGlinerReady(): boolean { return ready; }
