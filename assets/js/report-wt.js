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

import { prettyStamp, dateOf, durationMinutes, clockRange } from './time.js';
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
    ? `<section>
    <h2>Student Work</h2>
    <p class="reflection-note">Photograph captured during the walkthrough.</p>
    <img src="${esc(state.studentWorkPhoto)}" alt="Student work sample captured during the walkthrough"
         style="max-width:56%;border:1px solid #DFE3E8;border-radius:4px">
  </section>`
    : '';

  return `<article class="report" data-mode="wt">

  <header class="report-head">
    <h1>Walkthrough ${esc(state.wtNumber || '')} Feedback</h1>
    <p class="report-sub">Islander Residency · Site Coordinator and Host Teacher feedback${
      win ? ` · ${esc(win.term)} window ${esc(win.start)} – ${esc(win.end)}` : ''}</p>
    <div class="report-meta">
      <div><span class="rm-k">Resident</span><span class="rm-v">${S(state.residentName)}</span></div>
      <div><span class="rm-k">Host Teacher</span><span class="rm-v">${S(state.hostTeacher)}</span></div>
      <div><span class="rm-k">Campus</span><span class="rm-v">${S(state.schoolName)}</span></div>
      <div><span class="rm-k">Date</span><span class="rm-v">${S(dateOf(state.timeIn))}</span></div>
      <div><span class="rm-k">Time</span><span class="rm-v">${S(clockRange(state.timeIn, state.timeOut))}</span></div>
      <div><span class="rm-k">Duration</span><span class="rm-v">${
        dur != null ? `${dur} min` : '<span class="no-evidence">Not recorded</span>'}</span></div>
      <div><span class="rm-k">Grade</span><span class="rm-v">${S(state.grade)}</span></div>
      <div><span class="rm-k">Content</span><span class="rm-v">${S(state.contentArea)}</span></div>
    </div>
  </header>

  <section>
    <h2>Host Teacher Notes</h2>
    <p><span class="lead">What is your current coaching goal with your IR?</span><br>${S(state.htCoachingGoal)}</p>
    <p><span class="lead">Describe one piece of actionable feedback OR a coaching strategy you have used to support your IR based on their most recent informal observation.</span><br>${S(state.htFeedback)}</p>
  </section>

  <section>
    <h2>Site Coordinator Notes</h2>
    <p><span class="lead">Co-Teaching Observed:</span> ${S(state.coTeachingModel)}</p>
    <table>
      <thead><tr><th style="width:8%">&nbsp;</th><th style="width:34%">Area</th><th>Evidence</th></tr></thead>
      <tbody>
        <tr><td><strong>R+</strong></td><td>${S(state.rPlus)}</td><td>${S(state.rPlusEvidence)}</td></tr>
        <tr><td><strong>R−</strong></td><td>${S(state.rMinus)}</td><td>${S(state.rMinusEvidence)}</td></tr>
      </tbody>
    </table>
    <p><span class="lead">Actionable Feedback/Action Steps/Resources:</span><br>${S(state.actionSteps)}</p>
  </section>
  ${photo}

  <section>
    <h2>Islander Resident Notes — Reflection</h2>
    <p class="reflection-note">To be completed by the resident.</p>
${REFLECTION_PROMPTS.map((q) => `    <div class="reflection-item">
      <p class="reflection-q">${esc(q)}</p>
      <div class="reflection-rule"></div>
      <div class="reflection-rule"></div>
    </div>`).join('\n')}
  </section>

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
 @page{size:letter;margin:.8in .85in}
 body{font-family:Montserrat,Segoe UI,sans-serif;font-size:10.5pt;line-height:1.6;color:#16181C;margin:0}
 h1,h2{font-family:Fraunces,Georgia,serif;color:#16181C}
 h1{font-size:21pt;line-height:1.1;margin:0 0 2pt;letter-spacing:-.02em}
 .report-sub{font-size:8pt;color:#868C95;margin:0 0 12pt;letter-spacing:.04em;text-transform:uppercase;font-weight:600}
 .report-head{border-bottom:2.5pt solid #007F3E;padding-bottom:11pt;margin-bottom:17pt}
 .report-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:9pt 18pt;margin:0}
 .report-meta div{display:flex;flex-direction:column;gap:1pt}
 .report-meta .rm-k{color:#868C95;font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
 .report-meta .rm-v{color:#16181C;font-size:10pt;line-height:1.35}
 section{margin-bottom:18pt;break-inside:avoid}
 h2{font-size:13pt;font-weight:600;color:#007F3E;margin:0 0 7pt;letter-spacing:-.01em;break-after:avoid}
 p{margin:0 0 6pt}
 .lead{font-weight:600;color:#16181C}
 table{width:100%;border-collapse:collapse;font-size:9.5pt;margin:8pt 0 4pt}
 th{text-align:left;padding:0 8pt 4pt 0;font-family:Montserrat,sans-serif;font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#868C95;border:none;border-bottom:2px solid #16181C}
 td{padding:5pt 8pt 5pt 0;border:none;border-bottom:1px solid #EDF0F3;vertical-align:top;line-height:1.45}
 tr{break-inside:avoid}
 .no-evidence{color:#868C95;font-style:italic}
 .reflection-note{font-size:8.5pt;color:#868C95;margin-bottom:10pt}
 .reflection-item{margin-bottom:14pt;break-inside:avoid}
 .reflection-q{font-weight:600;margin:0 0 10pt}
 .reflection-rule{border-bottom:1px solid #DFE3E8;height:17pt}
 .report{padding:0;border:none}
 #ir-provenance{display:none}
 .band-bar{display:flex;height:6pt;margin-top:20pt} .band-bar span{flex:1}
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
