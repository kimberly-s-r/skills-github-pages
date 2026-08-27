/*
 * Walkthrough report — one page, modelled on Appendix E's feedback block:
 *   Demographic Information · Host Teacher Notes · Site Coordinator Notes ·
 *   Islander Resident Notes – Reflection
 *
 * NO-FABRICATION RULE
 * Every R+/R− claim traces to the rough notes; there is no packet in this mode.
 * The resident's reflection prompts are LEFT BLANK on purpose — they are the
 * resident's own words to write, and this tool never supplies them.
 */

import { prettyStamp, dateOf, durationMinutes } from './time.js';
import { windowFor } from './data/windows.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const CO_TEACHING_MODELS = [
  'One Teach, One Observe',
  'One Teach, One Assist',
  'Station Teaching',
  'Parallel Teaching',
  'Alternative (Differentiated) Teaching',
  'Team Teaching',
  'Led instruction independently',
  'Not observed',
];

/** Prompts the resident completes themselves — rendered as blank ruled space. */
export const REFLECTION_PROMPTS = [
  'What was your area of strength (reinforcement +) during this walkthrough?',
  'What was your area of growth (refinement −) during this walkthrough?',
  'In your upcoming lessons, how will you continue to build upon your area of strength?',
  'In your upcoming lessons, how will you address your area of growth?',
];

export function buildWtReport(state) {
  const S = (v, fallback = '<span class="no-evidence">Not recorded in the notes</span>') =>
    String(v || '').trim() ? esc(String(v).trim()).replace(/\n/g, '<br>') : fallback;

  const dur = durationMinutes(state.timeIn, state.timeOut);
  const win = windowFor(state.wtNumber);

  const photo = state.studentWorkPhoto
    ? `<h2>Student Work</h2>
  <p class="small muted">Photograph captured during the walkthrough.</p>
  <img src="${esc(state.studentWorkPhoto)}" alt="Student work sample captured during the walkthrough"
       style="max-width:52%;border:1px solid #DFE3E8;border-radius:4px">`
    : '';

  return `<article class="report" data-mode="wt">

  <h1>Walkthrough ${esc(state.wtNumber || '')} Feedback</h1>
  <p class="small muted">Islander Residency · Site Coordinator and Host Teacher feedback${
    win ? ` · ${esc(win.term)} window ${esc(win.start)} to ${esc(win.end)}` : ''}</p>

  <h2>Islander Resident Notes — Demographic Information</h2>
  <div class="report-meta">
    <div><span class="rm-k">Resident:</span><span class="rm-v">${S(state.residentName)}</span></div>
    <div><span class="rm-k">Host Teacher:</span><span class="rm-v">${S(state.hostTeacher)}</span></div>
    <div><span class="rm-k">Campus:</span><span class="rm-v">${S(state.schoolName)}</span></div>
    <div><span class="rm-k">Date:</span><span class="rm-v">${S(dateOf(state.timeIn))}</span></div>
    <div><span class="rm-k">Time:</span><span class="rm-v">${S(prettyStamp(state.timeIn))}${
      state.timeOut ? ` – ${esc(prettyStamp(state.timeOut))}` : ''}</span></div>
    <div><span class="rm-k">Duration:</span><span class="rm-v">${dur != null ? `${dur} min` : '<span class="no-evidence">Not recorded</span>'}</span></div>
    <div><span class="rm-k">Grade:</span><span class="rm-v">${S(state.grade)}</span></div>
    <div><span class="rm-k">Content:</span><span class="rm-v">${S(state.contentArea)}</span></div>
  </div>

  <h2>Host Teacher Notes</h2>
  <p><strong>What is your current coaching goal with your IR?</strong><br>${S(state.htCoachingGoal)}</p>
  <p><strong>One piece of actionable feedback or a coaching strategy used to support the IR:</strong><br>${S(state.htFeedback)}</p>

  <h2>Site Coordinator Notes</h2>
  <p><strong>Co-Teaching Observed:</strong> ${S(state.coTeachingModel)}</p>
  <table>
    <thead><tr><th style="width:14%">&nbsp;</th><th style="width:38%">Area</th><th>Evidence</th></tr></thead>
    <tbody>
      <tr><td><strong>R+</strong></td><td>${S(state.rPlus)}</td><td>${S(state.rPlusEvidence)}</td></tr>
      <tr><td><strong>R−</strong></td><td>${S(state.rMinus)}</td><td>${S(state.rMinusEvidence)}</td></tr>
    </tbody>
  </table>
  <p><strong>Actionable Feedback / Action Steps / Resources:</strong><br>${S(state.actionSteps)}</p>
  ${photo}

  <h2>Islander Resident Notes — Reflection</h2>
  <p class="small muted">To be completed by the resident.</p>
${REFLECTION_PROMPTS.map((q) => `  <p><strong>${esc(q)}</strong></p>
  <div style="border-bottom:1px solid #DFE3E8;height:16pt;margin:0 0 6pt"></div>
  <div style="border-bottom:1px solid #DFE3E8;height:16pt;margin:0 0 10pt"></div>`).join('\n')}

</article>`;
}

/** Doc export for a walkthrough page, with hidden source metadata. */
export function toWtDocHtml(reportHtml, state, title) {
  const meta = JSON.stringify({
    generatedAt: state.generatedAt || null,
    resident: state.residentName || null,
    walkthrough: state.wtNumber || null,
    campus: state.schoolName || null,
    notesProvided: Boolean(String(state.notes || '').trim()),
    studentWorkPhotoAttached: Boolean(state.studentWorkPhoto),
    evidenceSource: 'rough notes only — no packet is uploaded in walkthrough mode',
  }, null, 2);

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
 body{font-family:Montserrat,Segoe UI,sans-serif;font-size:11pt;line-height:1.45;color:#16181C;margin:0.5in}
 h1,h2{font-family:Fraunces,Georgia,serif;color:#16181C}
 h1{font-size:15pt;margin:0 0 2pt} h2{font-size:11.5pt;color:#007F3E;border-bottom:1px solid #EDF0F3;padding-bottom:2pt;margin:12pt 0 4pt}
 table{width:100%;border-collapse:collapse;font-size:9pt;margin:4pt 0 8pt}
 th{background:#F4F6F8;text-align:left;border:1px solid #DFE3E8;padding:3pt 4pt;font-size:8pt;text-transform:uppercase;letter-spacing:.05em;color:#5A6068}
 td{border:1px solid #DFE3E8;padding:3pt 4pt;vertical-align:top}
 .no-evidence{color:#A82D27;font-style:italic}
 .report-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:2pt 12pt;font-size:9.5pt;margin:6pt 0}
 .report-meta div{display:flex;gap:4pt;align-items:baseline}
 .report-meta .rm-k{color:#5A6068;font-weight:600;white-space:nowrap} .report-meta .rm-v{color:#16181C}
 .small{font-size:8.5pt} .muted{color:#5A6068}
 #ir-provenance{display:none}
 .band-bar{display:flex;height:5pt;margin-top:14pt} .band-bar span{flex:1}
</style></head>
<body>
${reportHtml}
<div class="band-bar"><span style="background:#0067C5"></span><span style="background:#007F3E"></span><span style="background:#AE8439"></span><span style="background:#A82D27"></span><span style="background:#16181C"></span></div>

<!-- IR-PROVENANCE-BEGIN
${meta}
IR-PROVENANCE-END -->
<div id="ir-provenance" data-ir-provenance='${meta.replace(/'/g, '&#39;')}' aria-hidden="true"></div>
</body></html>`;
}
