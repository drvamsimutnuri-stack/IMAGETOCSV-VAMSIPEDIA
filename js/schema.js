/** Body Plethysmography table schema (Phase 1). */

export const TEST_TYPE = 'Body Plethysmography';

export const TABLE_COLUMNS = [
  { id: 'parameter', label: 'Parameter', editable: false },
  { id: 'unit', label: 'Unit', editable: false },
  { id: 'pred', label: 'Pred', editable: true },
  { id: 'pre', label: 'Pre', editable: true },
  { id: 'pct_pred', label: '% Pred', editable: true },
  { id: 'lln', label: 'LLN', editable: true },
  { id: 'z_score', label: 'Z-Score', editable: true },
];

export const PARAMETERS = [
  { name: 'Raw tot', key: 'Raw_tot', unit: 'kPa*s/L' },
  { name: 'sRaw tot', key: 'sRaw_tot', unit: 'kPa*s' },
  { name: 'Gaw tot', key: 'Gaw_tot', unit: 'L/s/kPa' },
  { name: 'TGV', key: 'TGV', unit: 'L' },
  { name: 'ERV', key: 'ERV', unit: 'L' },
  { name: 'RV', key: 'RV', unit: 'L' },
  { name: 'TLC', key: 'TLC', unit: 'L' },
  { name: 'RV%TLC', key: 'RV_pct_TLC', unit: '%' },
  { name: 'TGV%TLC', key: 'TGV_pct_TLC', unit: '%' },
  { name: 'FEV 1', key: 'FEV_1', unit: 'L' },
  { name: 'VC MAX', key: 'VC_MAX', unit: 'L' },
  { name: 'VT', key: 'VT', unit: 'L' },
  { name: 'FRC', key: 'FRC', unit: 'L' },
];

/** Empty row template keyed by column id. */
export function emptyRow(parameter) {
  return {
    parameter: parameter.name,
    unit: parameter.unit,
    pred: '',
    pre: '',
    pct_pred: '',
    lln: '',
    z_score: '',
  };
}

/** Build default empty table for manual entry or fallback. */
export function defaultTableRows() {
  return PARAMETERS.map(emptyRow);
}

/** Normalize parameter name for fuzzy matching. */
export function normalizeParameterName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/% /g, '%')
    .trim();
}

/** Map extracted parameter name to schema key. */
export function parameterToKey(name) {
  const normalized = normalizeParameterName(name);
  const match = PARAMETERS.find(
    (p) => normalizeParameterName(p.name) === normalized
  );
  return match?.key ?? null;
}

/** Merge AI output into canonical row order. */
export function mergeExtractedRows(extractedRows) {
  const byName = new Map();
  for (const row of extractedRows || []) {
    const key = normalizeParameterName(row.parameter);
    byName.set(key, row);
  }

  return PARAMETERS.map((param) => {
    const found = byName.get(normalizeParameterName(param.name));
    if (!found) return emptyRow(param);
    return {
      parameter: param.name,
      unit: param.unit,
      pred: formatCell(found.pred),
      pre: formatCell(found.pre),
      pct_pred: formatCell(found.pct_pred ?? found.pctPred ?? found['% Pred']),
      lln: formatCell(found.lln ?? found.LLN),
      z_score: formatCell(found.z_score ?? found.zScore ?? found['Z-Score']),
    };
  });
}

function formatCell(value) {
  if (value === null || value === undefined || value === '-' || value === '—') {
    return '';
  }
  return String(value).trim();
}

/** Wide-format column headers for export. */
export function wideColumnHeaders() {
  const meta = ['filename', 'test_type', 'extraction_date'];
  const valueCols = [];
  for (const param of PARAMETERS) {
    valueCols.push(
      `${param.key}_pred`,
      `${param.key}_pre`,
      `${param.key}_pct_pred`,
      `${param.key}_lln`,
      `${param.key}_zscore`
    );
  }
  return [...meta, ...valueCols];
}

/** Convert one report's rows to a wide-format object. */
export function rowsToWideRecord(filename, rows, extractionDate) {
  const record = {
    filename,
    test_type: TEST_TYPE,
    extraction_date: extractionDate,
  };

  const rowByParam = new Map(rows.map((r) => [normalizeParameterName(r.parameter), r]));

  for (const param of PARAMETERS) {
    const row = rowByParam.get(normalizeParameterName(param.name)) || emptyRow(param);
    record[`${param.key}_pred`] = row.pred;
    record[`${param.key}_pre`] = row.pre;
    record[`${param.key}_pct_pred`] = row.pct_pred;
    record[`${param.key}_lln`] = row.lln;
    record[`${param.key}_zscore`] = row.z_score;
  }

  return record;
}
