export async function parsePDF(file: File): Promise<string> {
  console.log('[pdf-parser] parsePDF called, dynamically importing pdfjs-dist...');

  const pdfjs = await import('pdfjs-dist');

  console.log('[pdf-parser] pdfjs loaded, version:', pdfjs.version);
  console.log('[pdf-parser] Setting workerSrc to CDN...');

  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  console.log('[pdf-parser] workerSrc set to:', pdfjs.GlobalWorkerOptions.workerSrc);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
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
