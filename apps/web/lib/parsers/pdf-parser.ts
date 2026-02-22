export async function parsePDF(file: File): Promise<string> {
  // Use legacy build — it bundles a fake worker and works without external worker setup
  const { getDocument, GlobalWorkerOptions } = await import(
    /* webpackChunkName: "pdfjs" */ 'pdfjs-dist/legacy/build/pdf.mjs'
  );

  // Point worker at the legacy worker bundled alongside
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(text);
  }
  return pages.join('\n\n');
}
