export async function parseImage(file: File): Promise<string> {
  // Tesseract.js is heavy - lazy load
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const { data } = await worker.recognize(file);
  await worker.terminate();
  return data.text;
}
