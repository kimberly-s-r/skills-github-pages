/*
 * STEP 4 — accuracy guardrails, implemented as blocking checks rather than advice.
 *
 * The spreadsheet is the system of record for SL&L, so a row that is wrong is worse
 * than a row that is late. Nothing reaches log_observation until these pass and the
 * coordinator has confirmed the exact row.
 */

import { IAT_ROWS, printedLabel, NO_EVIDENCE } from './data/iat.js';
import { verifySchema } from './data/schema.js';

/**
 * A rubric row is complete when it has AT LEAST ONE of:
 *   a rating, evidence text, or the explicit "No evidence available" marker.
 * Blank-and-unmarked is the one state that blocks submission — it is the state that
 * silently turns into an empty cell on a TEA-reported rubric.
 */
export function rubricRowState(entry = {}) {
  const hasRating = entry.selfRating != null || entry.hostRating != null || entry.scRating != null;
  const hasEvidence = Boolean(String(entry.evidence || '').trim());
  const marked = entry.noEvidence === true;
  return {
    hasRating, hasEvidence, marked,
    complete: hasRating || hasEvidence || marked,
  };
}

export function checkRubricCompleteness(rubric = {}) {
  const incomplete = [];
  for (const row of IAT_ROWS) {
    const state = rubricRowState(rubric[row.id]);
    if (!state.complete) incomplete.push({ id: row.id, label: printedLabel(row) });
  }
  return {
    passed: incomplete.length === 0,
    incomplete,
    message: incomplete.length === 0
      ? `All ${IAT_ROWS.length} rubric rows carry a rating, evidence, or an explicit "${NO_EVIDENCE}" marker.`
      : `${incomplete.length} rubric row(s) have no rating, no evidence, and no "${NO_EVIDENCE}" marker. Give each one of the three.`,
  };
}

/** Shell fields both modes need before anything can be logged. */
export function checkShell(state) {
  const missing = [];
  if (!state.school) missing.push('School');
  if (!state.residentName) missing.push('Resident');
  if (!state.timeIn) missing.push('Time In');
  if (!String(state.notes || '').trim()) missing.push('Rough notes (the only evidence source)');
  if (state.mode === 'pop' && !state.popCycle) missing.push('POP Cycle #');
  if (state.mode === 'wt' && !state.wtNumber) missing.push('Walkthrough #');
  return {
    passed: missing.length === 0,
    missing,
    message: missing.length === 0 ? 'Shell complete.' : `Missing: ${missing.join(', ')}.`,
  };
}

/**
 * Performance gate: Developing-or-above on every dimension by POP #2,
 * Proficient-or-above by POP #4. Reported, never silently enforced — a resident
 * below the gate still gets a logged row; the row says so.
 */
export function performanceGate(popCycle, lowestScore) {
  const cycle = Number(popCycle);
  if (!cycle) return { status: '', note: 'No POP cycle selected.' };
  if (lowestScore == null) {
    return { status: `On Track (POP${cycle})`, note: 'No dimension scores recorded, so no gate determination is possible from ratings alone.' };
  }
  if (cycle >= 4) {
    return lowestScore >= 3
      ? { status: 'Met — Proficient+ by POP4', note: `Lowest dimension score is ${lowestScore} (Proficient or above).` }
      : { status: 'Not Met — below Proficient at POP4', note: `Lowest dimension score is ${lowestScore}; the POP4 gate requires Proficient (3) or above on every dimension.` };
  }
  if (cycle >= 2) {
    return lowestScore >= 2
      ? { status: 'Met — Developing+ by POP2', note: `Lowest dimension score is ${lowestScore} (Developing or above).` }
      : { status: 'Not Met — below Developing at POP2', note: `Lowest dimension score is ${lowestScore}; the POP2 gate requires Developing (2) or above on every dimension.` };
  }
  return { status: `On Track (POP${cycle})`, note: 'No gate applies at POP1; the first gate is Developing-or-above by POP2.' };
}

/**
 * Every claim must trace to the rough notes or the uploaded packet. This flags
 * report prose containing content that appears in neither source.
 */
export function checkNoFabrication(state, claims = []) {
  const haystack = [
    String(state.notes || ''),
    JSON.stringify(state.packet || {}),
    ...IAT_ROWS.map((r) => String((state.rubric?.[r.id]?.evidence) || '')),
  ].join(' ').toLowerCase();

  const unsourced = claims.filter((c) => {
    const text = String(c.text || '').trim();
    if (!text || text === NO_EVIDENCE) return false;
    const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    if (words.length === 0) return false;
    const hits = words.filter((w) => haystack.includes(w)).length;
    return hits / words.length < 0.34; // most substantive words absent from both sources
  });

  return {
    passed: unsourced.length === 0,
    unsourced,
    message: unsourced.length === 0
      ? 'Every narrative claim traces back to the rough notes or the packet.'
      : `${unsourced.length} claim(s) contain wording found in neither the rough notes nor the packet. Review before submitting.`,
  };
}

/** Full pre-submit gate. `blocking` false means log_observation must not be called. */
export function runAllChecks(state, row, tab) {
  const checks = [];

  const shell = checkShell(state);
  checks.push({ id: 'shell', label: 'Required shell fields', blocking: true, ...shell });

  if (state.mode === 'pop') {
    const rubric = checkRubricCompleteness(state.rubric);
    checks.push({ id: 'rubric', label: 'All 13 IAT dimensions accounted for', blocking: true, ...rubric });
  }

  const schemaErrors = verifySchema(tab, row);
  checks.push({
    id: 'schema', label: 'Row matches the sheet schema', blocking: true,
    passed: schemaErrors.length === 0,
    message: schemaErrors.length === 0
      ? `Row keys all exist on the "${tab}" tab and every required column is filled.`
      : schemaErrors.join(' '),
    errors: schemaErrors,
  });

  if (state.mode === 'wt' && !String(state.notes || '').trim()) {
    checks.push({
      id: 'wt-notes', label: 'Walkthrough evidence', blocking: true, passed: false,
      message: 'Walkthrough mode has no packet — the rough notes are the only evidence source and cannot be empty.',
    });
  }

  const blocking = checks.filter((c) => c.blocking && !c.passed);
  return { checks, canSubmit: blocking.length === 0, blockers: blocking };
}
