/*
 * Submit pipeline: build the row -> show the exact diff -> require an explicit
 * confirm -> hand the write off to log_observation.
 *
 * WHY THERE IS A HANDOFF STEP
 * This is a static GitHub Pages site. A browser cannot call an MCP tool, and it must
 * not hold Google credentials. So the page does the part it can do safely and
 * verifiably — build a row that is guaranteed schema-valid, diff it, and require a
 * confirmation — then emits the exact `log_observation` call for the coordinator's
 * Claude session to execute. `WRITE_ADAPTER` is the single seam: point it at an
 * authenticated endpoint later and nothing else in the app changes.
 */

import { buildRow, verifySchema, columnsFor } from './data/schema.js';
import { IAT_ROWS, RATINGS, printedLabel, NO_EVIDENCE } from './data/iat.js';
import { domainScores, lowestDimension } from './report-pop.js';
import { performanceGate } from './guardrails.js';
import { dateOf, durationMinutes } from './time.js';

const ratingWord = (v) => {
  const r = RATINGS.find((x) => x.value === Number(v));
  return r ? r.label : '';
};

/** Lowest rating a given rater gave across all dimensions. */
function lowestBy(rubric, field) {
  const vals = IAT_ROWS
    .map((r) => rubric?.[r.id]?.[field])
    .filter((v) => v != null)
    .map(Number);
  return vals.length ? Math.min(...vals) : null;
}

/** Evidence summary: dimensions that carry evidence, and how many do not. */
function evidenceSummary(rubric = {}) {
  const withEvidence = [];
  let none = 0;
  for (const row of IAT_ROWS) {
    const e = rubric[row.id] || {};
    if (e.noEvidence || !String(e.evidence || '').trim()) { none += 1; continue; }
    withEvidence.push(printedLabel(row));
  }
  const parts = [];
  if (withEvidence.length) parts.push(`Evidence recorded for: ${withEvidence.join('; ')}.`);
  if (none) parts.push(`${none} dimension(s) marked "${NO_EVIDENCE}".`);
  return parts.join(' ');
}

export function buildPopRow(state) {
  const rubric = state.rubric || {};
  const scores = domainScores(rubric);
  const lowest = lowestDimension(rubric);
  const gate = performanceGate(state.popCycle, lowest.score);

  const selfOverall = state.selfScoreOverride ?? ratingWord(lowestBy(rubric, 'selfRating'));
  const hostOverall = state.hostScoreOverride ?? ratingWord(lowestBy(rubric, 'hostRating'));
  const scOverall   = state.scScoreOverride   ?? ratingWord(lowestBy(rubric, 'scRating'));

  return buildRow('POP Cycles', {
    'Resident Name':                        state.residentName,
    'TEA ID':                               state.teaId,
    'Campus':                               state.schoolName,
    'Host Teacher':                         state.hostTeacher,
    'POP Cycle #':                          state.popCycle,
    'Observation Date':                     dateOf(state.timeIn),
    'Lesson Topic / Subject':               state.lessonTopic,
    'Domain 1 Score (Planning)':            ratingWord(scores[1]),
    'Domain 2 Score (Instruction)':         ratingWord(scores[2]),
    'Domain 3 Score (Learning Env.)':       ratingWord(scores[3]),
    'Lowest Dimension Score':               lowest.score != null ? `${ratingWord(lowest.score)}${lowest.label ? ` (${lowest.label})` : ''}` : '',
    'Performance Gate Status':              gate.status,
    'Area of Reinforcement (R+)':           state.reinforcementDomain,
    'Area of Refinement (R-)':              state.refinementDomain,
    'SMART Goal / Next Steps':              state.smartGoal,
    'UDL Strategy Noted':                   state.udlStrategy,
    'Evidence Summary':                     evidenceSummary(rubric),
    'Resident Self-Score':                  selfOverall,
    'Host Teacher Score':                   hostOverall,
    'Site Coordinator Score':               scOverall,
    'SL&L Upload Status':                   state.slUploadStatus || 'Not yet uploaded',
    'SL&L Upload Date':                     state.slUploadDate,
    'Full Anchor Assessment Report (link)': state.reportDocLink,
    'Source Notes (Keep / Wave link)':      state.sourceNotesLink,
  });
}

export function buildWtRow(state) {
  const dur = durationMinutes(state.timeIn, state.timeOut);
  const reflection = [state.rPlus && `R+: ${state.rPlus}`, state.rMinus && `R−: ${state.rMinus}`]
    .filter(Boolean).join(' | ');

  return buildRow('Walkthroughs', {
    'Resident Name':                state.residentName,
    'Campus':                       state.schoolName,
    'Host Teacher':                 state.hostTeacher,
    'Walkthrough #':                state.wtNumber,
    'Date':                         dateOf(state.timeIn),
    'Duration (min)':               state.durationOverride || (dur != null ? String(dur) : ''),
    'Focus Domain / Area':          state.focusArea,
    'Reflection & Growth Feedback': reflection,
    'Follow-up Action':             state.actionSteps,
    'Source Notes (Keep link)':     state.sourceNotesLink,
  });
}

export function buildRowFor(state) {
  return state.mode === 'pop'
    ? { tab: 'POP Cycles', row: buildPopRow(state) }
    : { tab: 'Walkthroughs', row: buildWtRow(state) };
}

/**
 * Diff the row about to be written against the previous submission for the same
 * resident and cycle, when one exists. With no previous row every cell reads "new".
 */
export function diffRow(tab, row, previous = null) {
  return columnsFor(tab).map(({ key, col, required }) => {
    const value = row[key] ?? '';
    const before = previous ? (previous[key] ?? '') : null;
    let status = 'new';
    if (previous) {
      if (before === value) status = 'same';
      else if (!before && value) status = 'added';
      else if (before && !value) status = 'cleared';
      else status = 'changed';
    }
    return { col, key, value, before, status, required: Boolean(required), blank: value === '' };
  });
}

const HISTORY_KEY = 'ir-observation-history-v1';

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

export function saveHistory(entries) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-300))); }
  catch { /* private browsing or storage disabled — history is a convenience only */ }
}

export function recordSubmission(tab, row, extra = {}) {
  const history = loadHistory();
  history.push({ tab, row, at: new Date().toISOString(), ...extra });
  saveHistory(history);
  return history;
}

/** Most recent previously-logged row for the same resident and cycle number. */
export function findPrevious(tab, row) {
  const numberKey = tab === 'POP Cycles' ? 'POP Cycle #' : 'Walkthrough #';
  const matches = loadHistory().filter(
    (h) => h.tab === tab &&
           h.row['Resident Name'] === row['Resident Name'] &&
           h.row[numberKey] === row[numberKey]);
  return matches.length ? matches[matches.length - 1].row : null;
}

/**
 * WT5–WT8 history for a resident, for the POP report's trend table.
 * Reads locally logged walkthroughs, plus any rows imported from the Walkthroughs tab.
 * Returns only what it actually has — a missing walkthrough stays missing.
 */
export function walkthroughTrendFor(residentName, imported = []) {
  const rows = [
    ...loadHistory().filter((h) => h.tab === 'Walkthroughs' && h.row['Resident Name'] === residentName).map((h) => h.row),
    ...imported.filter((r) => r['Resident Name'] === residentName),
  ];
  const byNumber = new Map();
  for (const r of rows) {
    const n = Number(r['Walkthrough #']);
    if (!n) continue;
    const feedback = String(r['Reflection & Growth Feedback'] || '');
    const rPlus = (feedback.match(/R\+:\s*([^|]*)/) || [, ''])[1].trim();
    const rMinus = (feedback.match(/R[−-]:\s*([^|]*)/) || [, ''])[1].trim();
    byNumber.set(n, { number: n, rPlus, rMinus, action: String(r['Follow-up Action'] || '').trim() });
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

/**
 * The write seam. Default adapter emits the exact log_observation call for the
 * coordinator's Claude session; swap in an authenticated endpoint to write directly.
 */
export const WRITE_ADAPTER = {
  name: 'mcp-handoff',
  describe: () => 'Produces the exact log_observation call for your Claude session to run.',
  async write(tab, row) {
    const errors = verifySchema(tab, row);
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      mode: 'handoff',
      call: { tool: 'log_observation', server: 'IR_26_Observations', arguments: { tab, row } },
    };
  },
};

export function handoffText(tab, row) {
  return JSON.stringify({ tool: 'log_observation', arguments: { tab, row } }, null, 2);
}
