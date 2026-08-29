/*
 * log_observation column schema — SINGLE SOURCE OF TRUTH for row construction.
 *
 * Transcribed verbatim from the MCP tool `log_observation` (server: IR_26_Observations)
 * on 2026-08-27. Column names below are the exact keys the tool accepts; the tool
 * rejects any key that does not belong to the chosen tab, and writes a blank cell for
 * any column omitted rather than shifting the remaining columns.
 *
 * DO NOT hand-edit column names here to "fix" a mismatch. If the sheet changes, re-read
 * the tool schema and regenerate this file (see README "Keeping the schema in sync"),
 * so the UI and the sheet cannot drift apart. `verifySchema()` below is what the
 * Schema panel in the app renders so drift is visible to the coordinator, not silent.
 */

export const SCHEMA_SOURCE = {
  tool: 'log_observation',
  server: 'IR_26_Observations',
  sheetId: '1pSXwXoP-nRYKqN-6e_kAE9VCpSKTRe-ywraCLsk1fIA',
  sheetName: 'IR26 Observations',
  transcribedOn: '2026-08-27',
};

/** POP Cycles tab, columns A–X, in sheet order. */
export const POP_COLUMNS = [
  { key: 'Resident Name',                        col: 'A', required: true },
  { key: 'TEA ID',                               col: 'B' },
  { key: 'Campus',                               col: 'C', required: true },
  { key: 'Host Teacher',                         col: 'D' },
  { key: 'POP Cycle #',                          col: 'E', required: true },
  { key: 'Observation Date',                     col: 'F', required: true },
  { key: 'Lesson Topic / Subject',               col: 'G' },
  { key: 'Domain 1 Score (Planning)',            col: 'H' },
  { key: 'Domain 2 Score (Instruction)',         col: 'I' },
  { key: 'Domain 3 Score (Learning Env.)',       col: 'J' },
  { key: 'Lowest Dimension Score',               col: 'K' },
  { key: 'Performance Gate Status',              col: 'L' },
  { key: 'Area of Reinforcement (R+)',           col: 'M' },
  { key: 'Area of Refinement (R-)',              col: 'N' },
  { key: 'SMART Goal / Next Steps',              col: 'O' },
  { key: 'UDL Strategy Noted',                   col: 'P' },
  { key: 'Evidence Summary',                     col: 'Q' },
  { key: 'Resident Self-Score',                  col: 'R' },
  { key: 'Host Teacher Score',                   col: 'S' },
  { key: 'Site Coordinator Score',               col: 'T' },
  { key: 'SL&L Upload Status',                   col: 'U' },
  { key: 'SL&L Upload Date',                     col: 'V' },
  { key: 'Full Anchor Assessment Report (link)', col: 'W' },
  { key: 'Source Notes (Keep / Wave link)',      col: 'X' },
];

/** Walkthroughs tab, columns A–J, in sheet order. */
export const WT_COLUMNS = [
  { key: 'Resident Name',                col: 'A', required: true },
  { key: 'Campus',                       col: 'B', required: true },
  { key: 'Host Teacher',                 col: 'C' },
  { key: 'Walkthrough #',                col: 'D', required: true },
  { key: 'Date',                         col: 'E', required: true },
  { key: 'Duration (min)',               col: 'F' },
  { key: 'Focus Domain / Area',          col: 'G' },
  { key: 'Reflection & Growth Feedback', col: 'H' },
  { key: 'Follow-up Action',             col: 'I' },
  { key: 'Source Notes (Keep link)',     col: 'J' },
];

export const TABS = {
  'POP Cycles':   { columns: POP_COLUMNS, label: 'POP Cycles' },
  'Walkthroughs': { columns: WT_COLUMNS,  label: 'Walkthroughs' },
};

export function columnsFor(tab) {
  const t = TABS[tab];
  if (!t) throw new Error(`Unknown tab: ${tab}`);
  return t.columns;
}

/**
 * Build a row object for `log_observation`, keyed by exact column name.
 * Values are coerced to strings (the tool's row values are all typed `string`).
 * Empty values are omitted, which the tool writes as a blank cell.
 */
export function buildRow(tab, values) {
  const row = {};
  for (const { key } of columnsFor(tab)) {
    const v = values[key];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s !== '') row[key] = s;
  }
  return row;
}

/**
 * Guard against drift in both directions: a key the tab does not accept (the tool
 * would reject the whole call) and a required column left blank.
 */
export function verifySchema(tab, row) {
  const cols = columnsFor(tab);
  const known = new Set(cols.map((c) => c.key));
  const errors = [];
  for (const key of Object.keys(row)) {
    if (!known.has(key)) {
      errors.push(`Column "${key}" does not exist on the "${tab}" tab — log_observation would reject this row.`);
    }
  }
  for (const c of cols) {
    if (c.required && !row[c.key]) {
      errors.push(`Required column "${c.key}" (${c.col}) is empty.`);
    }
  }
  return errors;
}
