/*
 * Walkthrough windows — Appendix E: Islander Residency Walkthrough Forms,
 * TAMU-CC Islander Residency Program Guide 2026–2027.
 *
 * Fall 2026   WT1 8/31/26–9/7/26   WT2 9/21/26–10/2/26   WT3 11/16/26–11/20/26   WT4 11/30/26–12/4/26
 * Spring 2027 WT5 2/8/27–2/12/27   WT6 2/22/27–2/26/27   WT7 4/12/27–4/16/27     WT8 4/26/27–4/30/27
 *
 * Dates are inclusive and interpreted in America/Chicago, the timezone the programme runs on.
 */

export const WALKTHROUGH_WINDOWS = [
  { number: 1, term: 'Fall 2026',   start: '2026-08-31', end: '2026-09-07' },
  { number: 2, term: 'Fall 2026',   start: '2026-09-21', end: '2026-10-02' },
  { number: 3, term: 'Fall 2026',   start: '2026-11-16', end: '2026-11-20' },
  { number: 4, term: 'Fall 2026',   start: '2026-11-30', end: '2026-12-04' },
  { number: 5, term: 'Spring 2027', start: '2027-02-08', end: '2027-02-12' },
  { number: 6, term: 'Spring 2027', start: '2027-02-22', end: '2027-02-26' },
  { number: 7, term: 'Spring 2027', start: '2027-04-12', end: '2027-04-16' },
  { number: 8, term: 'Spring 2027', start: '2027-04-26', end: '2027-04-30' },
];

/**
 * Suggest a walkthrough number for a date (YYYY-MM-DD, America/Chicago).
 * Returns { number, confidence, reason } — never a bare guess. The UI presents this
 * as a suggestion the coordinator can override, never as a locked value.
 */
export function suggestWalkthrough(isoDate) {
  if (!isoDate) return { number: null, confidence: 'none', reason: 'No date set.' };

  for (const w of WALKTHROUGH_WINDOWS) {
    if (isoDate >= w.start && isoDate <= w.end) {
      return {
        number: w.number,
        confidence: 'in-window',
        reason: `${isoDate} falls inside the Walkthrough ${w.number} window (${w.start} to ${w.end}, ${w.term}).`,
      };
    }
  }

  const before = WALKTHROUGH_WINDOWS.filter((w) => w.end < isoDate).pop();
  const after = WALKTHROUGH_WINDOWS.find((w) => w.start > isoDate);

  if (before && after) {
    return {
      number: after.number,
      confidence: 'between-windows',
      reason: `${isoDate} is between windows — after Walkthrough ${before.number} (ended ${before.end}) and before Walkthrough ${after.number} (opens ${after.start}). Suggesting the next window; confirm before logging.`,
    };
  }
  if (after) {
    return {
      number: after.number,
      confidence: 'before-first',
      reason: `${isoDate} is before the first window opens (Walkthrough ${after.number} opens ${after.start}). Confirm before logging.`,
    };
  }
  if (before) {
    return {
      number: before.number,
      confidence: 'after-last',
      reason: `${isoDate} is after the final window closed (Walkthrough ${before.number} ended ${before.end}). Confirm before logging.`,
    };
  }
  return { number: null, confidence: 'none', reason: 'No walkthrough window matches this date.' };
}

export function windowFor(number) {
  return WALKTHROUGH_WINDOWS.find((w) => w.number === Number(number)) || null;
}
