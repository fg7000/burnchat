let worker: Worker | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;
let msgId = 0;

const pending = new Map<number, {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}>();

export function isGlinerReady(): boolean {
  return ready;
}

export async function initGliner(
  onProgress?: (msg: string) => void
): Promise<void> {
  if (ready) return;
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    try {
      worker = new Worker("/ner-worker.js");

      worker.onmessage = (e) => {
        const { type, id, message, entities, error } = e.data;

        if (type === "progress") {
          onProgress?.(message);
        } else if (type === "init-done") {
          ready = true;
          onProgress?.("Privacy model ready");
          resolve();
        } else if (type === "init-error") {
          reject(new Error(error || "Worker init failed"));
        } else if (type === "detect-result") {
          pending.get(id)?.resolve(entities || []);
          pending.delete(id);
        } else if (type === "detect-error") {
          pending.get(id)?.reject(new Error(error));
          pending.delete(id);
        }
      };

      worker.onerror = (err) => {
        reject(err);
      };

      worker.postMessage({ type: "init" });
    } catch (err) {
      reject(err);
    }
  });

  return initPromise;
}

export async function detectEntities(
  text: string
): Promise<Array<{ text: string; start: number; end: number; label: string; score?: number }>> {
  if (!worker || !ready) return [];

  const id = ++msgId;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ type: "detect", id, text });

    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve([]);
      }
    }, 10000);
  });
}
