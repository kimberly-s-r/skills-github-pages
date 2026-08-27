/*
 * Anchor Assessment Report — POP Cycle mode.
 *
 * Section order, and the opening sentences that must appear verbatim, follow the
 * Anchor Assessment Lens rules:
 *   1 Header · 2 Pre-Conference Summary · 3 Growth Summary · 4 Reinforcement
 *   5 Refinement · 6 Rubric Alignment Table · 7 Required Domain Comments
 *
 * NO-FABRICATION RULE
 * Every claim is sourced to the rough notes or the uploaded packet. Where a
 * dimension has nothing behind it the table says, literally,
 * "No evidence available in this observation" — never blank, never guessed.
 * Provenance (notes vs packet) is recorded per row and emitted as hidden metadata
 * on the exported Doc; it never appears on the printed page.
 */

import { IAT_ROWS, DOMAINS, printedLabel, NO_EVIDENCE, RATINGS } from './data/iat.js';
import { prettyStamp, dateOf } from './time.js';
import { performanceGate } from './guardrails.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ratingLabel = (v) => {
  const r = RATINGS.find((x) => x.value === Number(v));
  return r ? r.short : '';
};

/** Combined rating shown in the rubric table: self / host / site coordinator. */
function ratingCell(entry = {}) {
  const parts = [];
  if (entry.selfRating != null) parts.push(`IR self: ${ratingLabel(entry.selfRating)}`);
  if (entry.hostRating != null) parts.push(`HT: ${ratingLabel(entry.hostRating)}`);
  if (entry.scRating != null) parts.push(`SC: ${ratingLabel(entry.scRating)}`);
  return parts.length ? parts.join(' · ') : '—';
}

/** Where a row's evidence came from. Hidden metadata only. */
export function provenanceFor(entry = {}) {
  if (entry.noEvidence) return 'none';
  const fromPacket = Boolean(entry.packetEvidence);
  const fromNotes = Boolean(String(entry.evidence || '').trim()) && !entry.evidenceFromPacketOnly;
  if (fromPacket && fromNotes) return 'both';
  if (fromPacket) return 'packet';
  if (fromNotes) return 'notes';
  return 'none';
}

export function domainScores(rubric = {}) {
  const out = {};
  for (const d of DOMAINS) {
    const vals = IAT_ROWS.filter((r) => r.domain === d.id)
      .map((r) => {
        const e = rubric[r.id] || {};
        const scores = [e.scRating, e.hostRating, e.selfRating].filter((v) => v != null).map(Number);
        return scores.length ? Math.min(...scores) : null;
      })
      .filter((v) => v != null);
    out[d.id] = vals.length ? Math.min(...vals) : null;
  }
  return out;
}

export function lowestDimension(rubric = {}) {
  let lowest = null, label = null;
  for (const row of IAT_ROWS) {
    const e = rubric[row.id] || {};
    const scores = [e.scRating, e.hostRating, e.selfRating].filter((v) => v != null).map(Number);
    if (!scores.length) continue;
    const v = Math.min(...scores);
    if (lowest == null || v < lowest) { lowest = v; label = printedLabel(row); }
  }
  return { score: lowest, label };
}

/** WT5–WT8 trend table, drawn from the Walkthroughs tab for this resident. */
function walkthroughTrendTable(trend = []) {
  const wanted = [5, 6, 7, 8];
  const rows = wanted.map((n) => {
    const hit = trend.find((t) => Number(t.number) === n);
    return {
      number: n,
      rPlus: hit?.rPlus || '',
      rMinus: hit?.rMinus || '',
      action: hit?.action || '',
      present: Boolean(hit),
    };
  });
  const any = rows.some((r) => r.present);

  if (!any) {
    return `<p class="no-evidence">No Walkthrough 5–8 records were available from the Walkthroughs tab for this resident, so no trend can be shown.</p>`;
  }

  return `<table>
  <thead><tr><th>Walkthrough</th><th>R+</th><th>R−</th><th>Action</th></tr></thead>
  <tbody>
${rows.map((r) => `    <tr><td>WT${r.number}</td>${
      r.present
        ? `<td>${esc(r.rPlus) || '<span class="no-evidence">Not recorded</span>'}</td>` +
          `<td>${esc(r.rMinus) || '<span class="no-evidence">Not recorded</span>'}</td>` +
          `<td>${esc(r.action) || '<span class="no-evidence">Not recorded</span>'}</td>`
        : `<td colspan="3" class="no-evidence">No record on the Walkthroughs tab</td>`
    }</tr>`).join('\n')}
  </tbody>
</table>`;
}

function rubricTable(rubric = {}) {
  const parts = [`<table>
  <thead><tr><th style="width:22%">Dimension (as printed)</th><th style="width:20%">Rating</th><th>Evidence</th></tr></thead>
  <tbody>`];

  for (const d of DOMAINS) {
    parts.push(`    <tr><td colspan="3"><strong>Domain ${d.id}: ${esc(d.name)}</strong></td></tr>`);
    for (const row of IAT_ROWS.filter((r) => r.domain === d.id)) {
      const e = rubric[row.id] || {};
      const evidence = String(e.evidence || '').trim();
      const cell = e.noEvidence || !evidence
        ? `<span class="no-evidence">${NO_EVIDENCE}</span>`
        : esc(evidence).replace(/\n/g, '<br>');
      const src = provenanceFor(e);
      parts.push(
        `    <tr data-dimension="${esc(row.id)}" data-source="${esc(src)}">` +
        `<td>${esc(printedLabel(row))}</td>` +
        `<td>${esc(ratingCell(e))}</td>` +
        `<td>${cell}<span class="source-tag" data-source="${esc(src)}"></span></td></tr>`);
    }
  }
  parts.push('  </tbody>\n</table>');
  return parts.join('\n');
}

/** Hidden provenance metadata: which source supported each rubric row. */
export function provenanceMetadata(state) {
  const rows = IAT_ROWS.map((row) => {
    const e = state.rubric?.[row.id] || {};
    return {
      dimension: row.id,
      printedAs: printedLabel(row),
      domain: row.domain,
      source: provenanceFor(e),
      hasRating: e.selfRating != null || e.hostRating != null || e.scRating != null,
      markedNoEvidence: Boolean(e.noEvidence),
      mergedFromPrintedSlots: row.slots,
    };
  });
  return {
    generatedAt: state.generatedAt || null,
    resident: state.residentName || null,
    popCycle: state.popCycle || null,
    packetFile: state.packet?.filename || null,
    notesProvided: Boolean(String(state.notes || '').trim()),
    printedSlotCount: 13,
    rubricRowCount: rows.length,
    rows,
  };
}

/**
 * Build the report. `opts.trend` is the WT5–WT8 history from the Walkthroughs tab.
 * Returns { html, metadata } — metadata is hidden and never rendered on the page.
 */
export function buildPopReport(state, opts = {}) {
  const trend = opts.trend || [];
  const rubric = state.rubric || {};
  const scores = domainScores(rubric);
  const lowest = lowestDimension(rubric);
  const gate = performanceGate(state.popCycle, lowest.score);
  const cycle = Number(state.popCycle) || 0;

  const S = (v, fallback = '<span class="no-evidence">Not recorded in the notes or packet</span>') =>
    String(v || '').trim() ? esc(String(v).trim()) : fallback;

  // --- 3. Growth Summary — verbatim opener ---
  const priorDate = state.priorObservationDate;
  const growthOpen = `Since your last observation on ${
    priorDate ? esc(priorDate) : '<span class="no-evidence">[DATE — no prior observation on record]</span>'
  }, you have worked to improve the refinement by…`;

  const growthBody = String(state.growthEvidence || '').trim()
    ? `<p>${esc(state.growthEvidence).replace(/\n/g, '<br>')}</p>`
    : `<p class="no-evidence">${NO_EVIDENCE} — no evidence connecting this observation to the prior cycle's refinement was found in the notes or packet.</p>`;

  const priorRMinus = String(state.priorRefinement || '').trim()
    ? `<p><strong>Prior cycle refinement (R−):</strong> ${esc(state.priorRefinement)}</p>`
    : '';

  // Wrapped so a column or page break never separates the heading from its table.
  const trendSection = cycle > 1
    ? `<div class="keep-together"><p><strong>Walkthrough 5–8 trend</strong></p>\n${walkthroughTrendTable(trend)}</div>`
    : `<p class="small muted">Walkthrough trend table is included from POP Cycle 2 onward; this is POP Cycle ${cycle || '—'}.</p>`;

  // --- 4. Reinforcement — verbatim opener ---
  const reinforceOpen = `During your last observation, you did well on ${
    S(state.reinforcementDomain, '<span class="no-evidence">[Domain/Indicator — not recorded]</span>')
  }. In this observation, you continue this trend.`;

  // --- 5. Refinement ---
  const refineIndicator = S(state.refinementDomain, '<span class="no-evidence">[Domain/Indicator — not recorded]</span>');

  const html = `<article class="report" data-mode="pop">

  <h1>Anchor Assessment Report — POP Cycle ${esc(state.popCycle || '')}</h1>
  <p class="small muted">Islander Residency · TAMU-CC · Corpus Christi ISD</p>

  <div class="report-meta">
    <div><span class="rm-k">Resident:</span><span class="rm-v">${S(state.residentName)}</span></div>
    <div><span class="rm-k">Host Teacher:</span><span class="rm-v">${S(state.hostTeacher)}</span></div>
    <div><span class="rm-k">Content Area:</span><span class="rm-v">${S(state.contentArea)}</span></div>
    <div><span class="rm-k">School:</span><span class="rm-v">${S(state.schoolName)}</span></div>
    <div><span class="rm-k">Observation Date:</span><span class="rm-v">${S(dateOf(state.timeIn))}</span></div>
    <div><span class="rm-k">Time In:</span><span class="rm-v">${S(prettyStamp(state.timeIn))}</span></div>
    <div><span class="rm-k">Time Out:</span><span class="rm-v">${S(prettyStamp(state.timeOut))}</span></div>
  </div>

  <div class="narrative-block">

  <h2>Pre-Conference Summary</h2>
  <p><strong>Stated lesson objective / focus:</strong> ${S(state.lessonObjective)}</p>
  <p><strong>Planned strategies and activities:</strong> ${S(state.plannedStrategies)}</p>
  <p><strong>Anticipated challenges:</strong> ${S(state.anticipatedChallenges)}</p>

  <h2>Growth Summary</h2>
  <p>${growthOpen}</p>
  ${growthBody}
  ${priorRMinus}
  ${trendSection}

  <h2>Reinforcement</h2>
  <p>${reinforceOpen}</p>
  <p><strong>Evidence:</strong> ${S(state.reinforcementEvidence)}</p>
  <p><strong>Why this matters:</strong> ${S(state.reinforcementWhy)}</p>
  <p>What is your goal for the next walkthrough?</p>

  <h2>Refinement</h2>
  <p><strong>Growth area (Domain/Indicator):</strong> ${refineIndicator}</p>
  <p><strong>Evidence:</strong> ${S(state.refinementEvidence)}</p>
  <p><strong>Research-based strategy:</strong> ${S(state.refinementStrategy)}</p>
  ${String(state.refinementPriorLink || '').trim()
    ? `<p><strong>Connection to prior feedback:</strong> ${esc(state.refinementPriorLink)}</p>` : ''}

  </div><!-- /narrative-block -->

  <h2>Rubric Alignment Table</h2>
  <p class="small muted">All 13 printed IAT dimension slots. The two printings of 3.2 Managing Student Behavior are merged into one row, keeping both evidence lines where they differ — 12 rows in total.</p>
  ${rubricTable(rubric)}

  <h2>Required Domain Comments</h2>
  <div class="domain-comments">
${DOMAINS.map((d) => {
    const key = `domainComment${d.id}`;
    const range = d.id === 1 ? '1.1–1.4' : d.id === 2 ? '2.1–2.5' : '3.1–3.3';
    return `  <p><strong>Domain ${d.id} — ${esc(d.name)} (${range}):</strong> ${S(state[key])}</p>`;
  }).join('\n')}
  </div>

  <h2>Summary Scores</h2>
  <table>
    <thead><tr><th>Domain 1 (Planning)</th><th>Domain 2 (Instruction)</th><th>Domain 3 (Learning Env.)</th><th>Lowest Dimension</th><th>Performance Gate</th></tr></thead>
    <tbody><tr>
      <td>${scores[1] != null ? esc(ratingLabel(scores[1])) : '<span class="no-evidence">Not scored</span>'}</td>
      <td>${scores[2] != null ? esc(ratingLabel(scores[2])) : '<span class="no-evidence">Not scored</span>'}</td>
      <td>${scores[3] != null ? esc(ratingLabel(scores[3])) : '<span class="no-evidence">Not scored</span>'}</td>
      <td>${lowest.score != null ? `${esc(ratingLabel(lowest.score))}${lowest.label ? ` (${esc(lowest.label)})` : ''}` : '<span class="no-evidence">Not scored</span>'}</td>
      <td>${esc(gate.status)}</td>
    </tr></tbody>
  </table>

</article>`;

  return { html, metadata: provenanceMetadata(state), scores, lowest, gate };
}

/**
 * Doc export. The provenance metadata rides along as an HTML comment plus a
 * display:none block — recorded on the Doc, absent from the printed page.
 */
export function toDocHtml(reportHtml, metadata, title) {
  const json = JSON.stringify(metadata, null, 2);
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
 /* Matches the app's print stylesheet so a downloaded Doc is also ONE PAGE. */
 @page{size:letter;margin:.34in}
 body{font-family:Montserrat,Segoe UI,sans-serif;font-size:7.6pt;line-height:1.28;color:#16181C;margin:0}
 h1,h2,h3{font-family:Fraunces,Georgia,serif;color:#16181C}
 h1{font-size:12pt;margin:0 0 1pt}
 h2{font-size:8.2pt;color:#0067C5;border-bottom:1px solid #EDF0F3;padding-bottom:1pt;margin:5pt 0 1.5pt;break-after:avoid}
 h2:first-of-type{margin-top:3pt}
 p{margin:0 0 2.5pt}
 table{width:100%;border-collapse:collapse;font-size:6.6pt;margin:2pt 0 3pt}
 th{background:#F4F6F8;text-align:left;border:1px solid #DFE3E8;padding:1.5pt 2.5pt;font-size:6pt;text-transform:uppercase;letter-spacing:.03em;color:#5A6068}
 td{border:1px solid #DFE3E8;padding:1.5pt 2.5pt;vertical-align:top}
 tr{break-inside:avoid}
 .no-evidence{color:#A82D27;font-style:italic}
 .report-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:1pt 8pt;font-size:7.2pt;margin:3pt 0 1pt}
 .report-meta div{display:flex;gap:4pt;align-items:baseline}
 .report-meta .rm-k{color:#5A6068;font-weight:600;white-space:nowrap} .report-meta .rm-v{color:#16181C}
 .narrative-block{column-count:2;column-gap:14pt;column-rule:1px solid #EDF0F3;margin-bottom:3pt}
 .narrative-block table{font-size:6.4pt}
 .keep-together{break-inside:avoid} .keep-together>p:first-child{break-after:avoid}
 .domain-comments{column-count:3;column-gap:12pt;font-size:7.2pt}
 .domain-comments p{break-inside:avoid}
 .small{font-size:6.4pt} .muted{color:#5A6068}
 .report{padding:0;border:none}
 .source-tag,#ir-provenance{display:none}
 .band-bar{display:flex;height:5pt;margin-top:6pt}
 .band-bar span{flex:1}
</style></head>
<body>
${reportHtml}
<div class="band-bar"><span style="background:#0067C5"></span><span style="background:#007F3E"></span><span style="background:#AE8439"></span><span style="background:#A82D27"></span><span style="background:#16181C"></span></div>

<!-- IR-PROVENANCE-BEGIN
${json}
IR-PROVENANCE-END -->
<div id="ir-provenance" data-ir-provenance='${json.replace(/'/g, '&#39;')}' aria-hidden="true"></div>
</body></html>`;
}
