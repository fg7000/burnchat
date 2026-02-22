const PARSE_TIMEOUT_MS = 30_000; // 30 seconds

export type ProgressCallback = (pct: number, detail?: string) => void;

export async function parsePDF(
  file: File,
  onProgress?: ProgressCallback
): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Always set workerSrc — empty string no longer disables the worker in v5+.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
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
