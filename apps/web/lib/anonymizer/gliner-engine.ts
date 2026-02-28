"use client";

/**
 * GLiNER PII Engine — Web Worker wrapper
 *
 * Same API as before (initGliner, detectEntities, isGlinerReady)
 * but inference now runs in a Web Worker so the UI never freezes.
 */

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

const pendingDetects = new Map
  number,
  { resolve: (entities: DetectedEntity[]) => void; reject: (err: Error) => void }
>();

let initProgressCallback: ProgressCallback | null = null;
let initResolve: (() => void) | null = null;
let initReject: ((err: Error) => void) | null = null;

function handleWorkerMessage(e: MessageEvent) {
  const { type, id, entities, error, message } = e.data;

  if (type === "progress") {
    initProgressCallback?.(message);
  } else if (type === "init-done") {
    ready = true;
    console.log("[BurnChat] GLiNER PII model loaded \u2014 running in background thread");
    initResolve?.();
  } else if (type === "init-error") {
    console.error("[BurnChat] GLiNER worker init failed:", error);
    loadingPromise = null;
    initReject?.(new Error(error));
  } else if (type === "detect-result") {
    const pending = pendingDetects.get(id);
    if (pending) {
      pending.resolve(entities);
      pendingDetects.delete(id);
    }
  } else if (type === "detect-error") {
    const pending = pendingDetects.get(id);
    if (pending) {
      pending.reject(new Error(error));
      pendingDetects.delete(id);
    }
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
      worker.onerror = (err) => {
        console.error("[BurnChat] Worker error:", err);
        loadingPromise = null;
        reject(new Error("Worker failed to load"));
      };
      worker.postMessage({ type: "init" });
    } catch (err) {
      console.error("[BurnChat] Failed to create worker:", err);
      loadingPromise = null;
      reject(err);
    }
  });

  return loadingPromise;
}

export async function detectEntities(text: string): Promise<DetectedEntity[]> {
  if (!worker || !ready) return [];

  const id = ++detectIdCounter;

  return new Promise<DetectedEntity[]>((resolve) => {
    pendingDetects.set(id, {
      resolve,
      reject: (err) => {
        console.error("[BurnChat] Detect error:", err);
        resolve([]);
      },
    });
    worker!.postMessage({ type: "detect", id, text });

    setTimeout(() => {
      if (pendingDetects.has(id)) {
        console.warn("[BurnChat] Worker timeout for request", id);
        pendingDetects.delete(id);
        resolve([]);
      }
    }, 30000);
  });
}

export function isGlinerReady(): boolean {
  return ready;
}
