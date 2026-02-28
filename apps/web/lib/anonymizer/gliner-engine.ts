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
  const { type, id, entities, error, message } = e.data;
  if (type === "progress") {
    initProgressCallback?.(message);
  } else if (type === "init-done") {
    ready = true;
    console.log("[BurnChat] Privacy engine ready (bert-small-pii)");
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
    // 60s timeout — bert-small should finish in <2s per chunk, but be generous
    setTimeout(() => {
      if (pendingDetects[id]) {
        console.warn("[BurnChat] Worker timeout for request", id);
        delete pendingDetects[id];
        resolve([]);
      }
    }, 60000);
  });
}

export function isGlinerReady(): boolean { return ready; }
