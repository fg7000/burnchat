const PARSE_TIMEOUT_MS = 30_000; // 30 seconds

export type ProgressCallback = (pct: number, detail?: string) => void;

export async function parsePDF(
  file: File,
  onProgress?: ProgressCallback
): Promise<string> {
  // Import the worker module FIRST — its side-effect sets
  // globalThis.pdfjsWorker = { WorkerMessageHandler }, which tells
  // PDFWorker to run on the main thread (no Web Worker, no workerSrc needed).
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.mjs");

  // Belt-and-suspenders: ensure the global is set even if webpack
  // tree-shook the side-effect assignment in the worker module.
  if (!(globalThis as Record<string, unknown>).pdfjsWorker) {
    (globalThis as Record<string, unknown>).pdfjsWorker = {
      WorkerMessageHandler: pdfjsWorker.WorkerMessageHandler,
    };
  }

  const pdfjsLib = await import("pdfjs-dist");

  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  const pdf = await Promise.race([
    loadingTask.promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        loadingTask.destroy();
        reject(new Error("PDF parsing timed out after 30 seconds. The file may be too large or corrupted."));
      }, PARSE_TIMEOUT_MS)
    ),
  ]);

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item && item.str ? item.str : ""))
      .join(" ");
    pages.push(text);

    onProgress?.(
      Math.round((i / pdf.numPages) * 100),
      `Page ${i} of ${pdf.numPages}`
    );
  }

  return pages.join("\n\n");
}
