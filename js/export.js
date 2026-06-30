import { wideColumnHeaders, rowsToWideRecord } from './schema.js';

/** Trigger browser download of a Blob. */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Escape a CSV field value. */
function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export extracted reports to CSV (wide format).
 * @param {Array<{ filename: string, rows: object[], extractionDate: string }>} reports
 */
export function exportToCsv(reports) {
  const headers = wideColumnHeaders();
  const records = reports.map((r) =>
    rowsToWideRecord(r.filename, r.rows, r.extractionDate)
  );

  const lines = [
    headers.map(csvEscape).join(','),
    ...records.map((rec) => headers.map((h) => csvEscape(rec[h])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `pft_body_plethysmography_${stamp}.csv`);
}

let xlsxLoaded = null;

async function loadXlsx() {
  if (xlsxLoaded) return xlsxLoaded;
  if (window.XLSX) {
    xlsxLoaded = window.XLSX;
    return xlsxLoaded;
  }
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load SheetJS library'));
    document.head.appendChild(script);
  });
  xlsxLoaded = window.XLSX;
  return xlsxLoaded;
}

/**
 * Export extracted reports to XLSX (wide format).
 * @param {Array<{ filename: string, rows: object[], extractionDate: string }>} reports
 */
export async function exportToXlsx(reports) {
  const XLSX = await loadXlsx();
  const headers = wideColumnHeaders();
  const records = reports.map((r) =>
    rowsToWideRecord(r.filename, r.rows, r.extractionDate)
  );

  const wsData = [headers, ...records.map((rec) => headers.map((h) => rec[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Body Plethysmography');

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `pft_body_plethysmography_${stamp}.xlsx`);
}
