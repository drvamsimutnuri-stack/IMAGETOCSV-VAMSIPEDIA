import { extractBodyPlethysmography } from './gemini.js';
import { pdfToImages, fileToBase64, isPdf, isImage } from './pdf.js';
import { exportToCsv, exportToXlsx } from './export.js';
import { TABLE_COLUMNS, defaultTableRows } from './schema.js';

const STORAGE_KEY = 'pft_extractor_api_key';
const MODEL_KEY = 'pft_extractor_model';

/** @typedef {'pending'|'processing'|'done'|'error'} FileStatus */

/**
 * @typedef {object} ReportFile
 * @property {string} id
 * @property {File} file
 * @property {FileStatus} status
 * @property {string} [error]
 * @property {object[]} rows
 * @property {string} [extractionDate]
 * @property {boolean} [found]
 */

/** @type {ReportFile[]} */
let files = [];

// DOM refs
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKeyVisibility');
const modelSelect = document.getElementById('modelSelect');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const filesPanel = document.getElementById('filesPanel');
const fileList = document.getElementById('fileList');
const processAllBtn = document.getElementById('processAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const previewPanel = document.getElementById('previewPanel');
const previewContainer = document.getElementById('previewContainer');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportXlsxBtn = document.getElementById('exportXlsxBtn');

function init() {
  const savedKey = localStorage.getItem(STORAGE_KEY);
  if (savedKey) apiKeyInput.value = savedKey;

  const savedModel = localStorage.getItem(MODEL_KEY);
  if (savedModel) modelSelect.value = savedModel;

  apiKeyInput.addEventListener('change', () => {
    localStorage.setItem(STORAGE_KEY, apiKeyInput.value);
  });

  modelSelect.addEventListener('change', () => {
    localStorage.setItem(MODEL_KEY, modelSelect.value);
  });

  toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyBtn.textContent = isPassword ? 'Hide' : 'Show';
  });

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--active');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drop-zone--active');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--active');
    addFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  processAllBtn.addEventListener('click', processAll);
  clearAllBtn.addEventListener('click', clearAll);
  exportCsvBtn.addEventListener('click', handleExportCsv);
  exportXlsxBtn.addEventListener('click', handleExportXlsx);

  render();
}

function uid() {
  return crypto.randomUUID?.() ?? `f-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addFiles(fileListLike) {
  const incoming = Array.from(fileListLike).filter(
    (f) => isPdf(f) || isImage(f)
  );

  if (!incoming.length) {
    showToast('No supported files selected (PDF, PNG, JPG).', true);
    return;
  }

  for (const file of incoming) {
    files.push({
      id: uid(),
      file,
      status: 'pending',
      rows: defaultTableRows(),
    });
  }

  render();
}

function removeFile(id) {
  files = files.filter((f) => f.id !== id);
  render();
}

async function processFile(entry) {
  const apiKey = apiKeyInput.value;
  const model = modelSelect.value;

  entry.status = 'processing';
  entry.error = undefined;
  render();

  try {
    let images = [];

    if (isPdf(entry.file)) {
      images = await pdfToImages(entry.file);
    } else if (isImage(entry.file)) {
      const img = await fileToBase64(entry.file);
      images = [{ ...img, page: 1 }];
    } else {
      throw new Error('Unsupported file type');
    }

    let bestResult = null;

    for (const img of images) {
      const base64 = img.base64 ?? (await fileToBase64FromDataUrl(img.dataUrl)).base64;
      const mimeType = img.mimeType || 'image/png';

      const result = await extractBodyPlethysmography(apiKey, model, base64, mimeType);

      if (result.found) {
        bestResult = result;
        break;
      }

      if (!bestResult) bestResult = result;
    }

    entry.rows = bestResult.rows;
    entry.found = bestResult.found;
    entry.extractionDate = new Date().toISOString();
    entry.status = 'done';

    if (!bestResult.found) {
      entry.error = 'Body Plethysmography table not found — empty template shown for manual entry.';
    }
  } catch (err) {
    entry.status = 'error';
    entry.error = err.message || String(err);
  }

  render();
}

async function fileToBase64FromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const mimeMatch = dataUrl.match(/^data:([^;]+);/);
  return {
    base64: dataUrl.slice(comma + 1),
    mimeType: mimeMatch?.[1] || 'image/png',
  };
}

async function processAll() {
  if (!apiKeyInput.value.trim()) {
    showToast('Please enter your Gemini API key first.', true);
    apiKeyInput.focus();
    return;
  }

  const pending = files.filter((f) => f.status === 'pending' || f.status === 'error');
  if (!pending.length) {
    showToast('No files to process.');
    return;
  }

  processAllBtn.disabled = true;

  for (const entry of pending) {
    await processFile(entry);
  }

  processAllBtn.disabled = false;
  showToast('Processing complete.');
}

function clearAll() {
  files = [];
  render();
}

function getCompletedReports() {
  return files
    .filter((f) => f.status === 'done')
    .map((f) => ({
      filename: f.file.name,
      rows: f.rows,
      extractionDate: f.extractionDate || new Date().toISOString(),
    }));
}

function handleExportCsv() {
  const reports = getCompletedReports();
  if (!reports.length) {
    showToast('No extracted data to export. Process files first.', true);
    return;
  }
  exportToCsv(reports);
  showToast(`Exported ${reports.length} report(s) to CSV.`);
}

async function handleExportXlsx() {
  const reports = getCompletedReports();
  if (!reports.length) {
    showToast('No extracted data to export. Process files first.', true);
    return;
  }
  try {
    await exportToXlsx(reports);
    showToast(`Exported ${reports.length} report(s) to XLSX.`);
  } catch (err) {
    showToast(err.message || 'XLSX export failed.', true);
  }
}

function statusLabel(status) {
  const labels = {
    pending: 'Pending',
    processing: 'Processing…',
    done: 'Done',
    error: 'Error',
  };
  return labels[status] || status;
}

function renderFileList() {
  fileList.innerHTML = '';

  for (const entry of files) {
    const li = document.createElement('li');
    li.className = 'file-item';

    const name = document.createElement('span');
    name.className = 'file-item__name';
    name.textContent = entry.file.name;

    const status = document.createElement('span');
    status.className = `file-item__status status--${entry.status}`;
    status.textContent = statusLabel(entry.status);

    const actions = document.createElement('div');
    actions.className = 'file-item__actions';

    if (entry.status === 'pending' || entry.status === 'error') {
      const processBtn = document.createElement('button');
      processBtn.type = 'button';
      processBtn.className = 'btn btn--secondary';
      processBtn.textContent = 'Process';
      processBtn.addEventListener('click', () => {
        if (!apiKeyInput.value.trim()) {
          showToast('Please enter your Gemini API key first.', true);
          return;
        }
        processFile(entry);
      });
      actions.appendChild(processBtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn--ghost';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeFile(entry.id));
    actions.appendChild(removeBtn);

    li.append(name, status, actions);

    if (entry.error) {
      const err = document.createElement('div');
      err.style.cssText = 'flex:1 0 100%;font-size:0.8rem;color:var(--error);margin-top:0.25rem;';
      err.textContent = entry.error;
      li.appendChild(err);
    }

    fileList.appendChild(li);
  }
}

function renderPreview() {
  previewContainer.innerHTML = '';
  const doneFiles = files.filter((f) => f.status === 'done');

  if (!doneFiles.length) {
    previewPanel.hidden = true;
    return;
  }

  previewPanel.hidden = false;

  for (const entry of doneFiles) {
    const card = document.createElement('div');
    card.className = 'preview-card';

    const header = document.createElement('div');
    header.className = 'preview-card__header';

    const title = document.createElement('span');
    title.className = 'preview-card__title';
    title.textContent = entry.file.name;

    const meta = document.createElement('span');
    meta.className = 'preview-card__meta';
    meta.textContent = entry.found
      ? `Extracted ${entry.extractionDate ? new Date(entry.extractionDate).toLocaleString() : ''}`
      : 'Table not found — edit manually';

    header.append(title, meta);

    const wrap = document.createElement('div');
    wrap.className = 'data-table-wrap';

    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const col of TABLE_COLUMNS) {
      const th = document.createElement('th');
      th.textContent = col.label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    entry.rows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      for (const col of TABLE_COLUMNS) {
        const td = document.createElement('td');
        td.textContent = row[col.id] ?? '';
        if (col.id === 'parameter') td.classList.add('col-param');
        if (col.editable) {
          td.contentEditable = 'true';
          td.dataset.rowIdx = String(rowIdx);
          td.dataset.colId = col.id;
          td.addEventListener('blur', (e) => {
            const rIdx = Number(e.target.dataset.rowIdx);
            const cId = e.target.dataset.colId;
            entry.rows[rIdx][cId] = e.target.textContent.trim();
          });
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrap.appendChild(table);
    card.append(header, wrap);
    previewContainer.appendChild(card);
  }
}

function render() {
  filesPanel.hidden = files.length === 0;
  processAllBtn.disabled = files.every((f) => f.status === 'done');
  renderFileList();
  renderPreview();
}

function showToast(message, isError = false) {
  const existing = document.querySelector('.toast');
  existing?.remove();

  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' toast--error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

init();
