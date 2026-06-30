/** Convert PDF files to PNG images using pdf.js (CDN). */

let pdfjsLib = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
  return pdfjsLib;
}

/**
 * Render each PDF page to a PNG data URL.
 * @param {File} file
 * @param {number} scale - render scale (2 = good for OCR)
 * @returns {Promise<{ dataUrl: string, mimeType: string, page: number }[]>}
 */
export async function pdfToImages(file, scale = 2) {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const images = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push({
      dataUrl: canvas.toDataURL('image/png'),
      mimeType: 'image/png',
      page: pageNum,
    });
  }

  return images;
}

/** Strip data URL prefix to get raw base64. */
export function dataUrlToBase64(dataUrl) {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/** Read an image File as base64 + mime type. */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const mimeMatch = String(dataUrl).match(/^data:([^;]+);/);
      resolve({
        dataUrl,
        base64: dataUrlToBase64(dataUrl),
        mimeType: mimeMatch?.[1] || file.type || 'image/png',
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** Whether file is a PDF. */
export function isPdf(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Whether file is a supported image. */
export function isImage(file) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type.startsWith('image/') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg')
  );
}
