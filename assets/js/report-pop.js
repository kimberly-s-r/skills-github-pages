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

import { IAT_ROWS, DOMAINS, printedLabel, printedLabelCompact, NO_EVIDENCE, RATINGS } from './data/iat.js';
import { prettyStamp, dateOf, timeRange } from './time.js';
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
    parts.push(`    <tr class="domain-row"><td colspan="3">Domain ${d.id}: ${esc(d.name)}</td></tr>`);
    for (const row of IAT_ROWS.filter((r) => r.domain === d.id)) {
      const e = rubric[row.id] || {};
      const evidence = String(e.evidence || '').trim();
      const cell = e.noEvidence || !evidence
        ? `<span class="no-evidence">${NO_EVIDENCE}</span>`
        : esc(evidence).replace(/\n/g, '<br>');
      const src = provenanceFor(e);
      parts.push(
        `    <tr data-dimension="${esc(row.id)}" data-source="${esc(src)}">` +
        `<td>${esc(printedLabelCompact(row))}</td>` +
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

  /*
   * Single column, top to bottom, in the seven specified sections and no others.
   * The reader follows 1 -> 7 in one unbroken flow; nothing is columned, because a
   * column break is exactly what destroys the specified order.
   */
  const html = `<article class="report" data-mode="pop">

  <header class="report-head">
    <h1>Anchor Assessment Report</h1>
    <p class="report-sub">POP Cycle ${esc(state.popCycle || '—')} · Islander Residency · TAMU-CC · Corpus Christi ISD</p>
    <div class="report-meta">
      <div><span class="rm-k">Resident</span><span class="rm-v">${S(state.residentName)}</span></div>
      <div><span class="rm-k">Host Teacher</span><span class="rm-v">${S(state.hostTeacher)}</span></div>
      <div><span class="rm-k">Content Area</span><span class="rm-v">${S(state.contentArea)}</span></div>
      <div><span class="rm-k">School</span><span class="rm-v">${S(state.schoolName)}</span></div>
      <div><span class="rm-k">Observation Date</span><span class="rm-v">${S(dateOf(state.timeIn))}</span></div>
      <div><span class="rm-k">Time In / Out</span><span class="rm-v">${S(timeRange(state.timeIn, state.timeOut))}</span></div>
    </div>
  </header>

  <section>
    <h2>Pre-Conference Summary</h2>
    <p><span class="lead">Stated lesson objective / focus.</span> ${S(state.lessonObjective)}</p>
    <p><span class="lead">Planned strategies and activities.</span> ${S(state.plannedStrategies)}</p>
    <p><span class="lead">Anticipated challenges.</span> ${S(state.anticipatedChallenges)}</p>
  </section>

  <section>
    <h2>Growth Summary</h2>
    <p>${growthOpen}</p>
    ${growthBody}
    ${priorRMinus}
    ${trendSection}
  </section>

  <section>
    <h2>Reinforcement</h2>
    <p>${reinforceOpen}</p>
    <p><span class="lead">Evidence.</span> ${S(state.reinforcementEvidence)}</p>
    <p><span class="lead">Why this matters.</span> ${S(state.reinforcementWhy)}</p>
    <p class="closing-q">What is your goal for the next walkthrough?</p>
  </section>

  <section>
    <h2>Refinement</h2>
    <p><span class="lead">Growth area.</span> ${refineIndicator}</p>
    <p><span class="lead">Evidence.</span> ${S(state.refinementEvidence)}</p>
    <p><span class="lead">Research-based strategy.</span> ${S(state.refinementStrategy)}</p>
    ${String(state.refinementPriorLink || '').trim()
      ? `<p><span class="lead">Connection to prior feedback.</span> ${esc(state.refinementPriorLink)}</p>` : ''}
  </section>

  <section>
    <h2>Rubric Alignment Table</h2>
    ${rubricTable(rubric)}
    <p class="fidelity-note">As printed in Appendix G: 2.1 and 2.2 carry a number but no title, and three
    dimensions carry neither — those are identified by their slot and no title has been supplied for them.
    3.2 Managing Student Behavior is printed twice and is merged here into one row, keeping both evidence
    lines. 13 printed slots, 12 rows.</p>
  </section>

  <section>
    <h2>Required Domain Comments</h2>
${DOMAINS.map((d) => {
    const key = `domainComment${d.id}`;
    const range = d.id === 1 ? '1.1–1.4' : d.id === 2 ? '2.1–2.5' : '3.1–3.3';
    return `    <p><span class="lead">Domain ${d.id} — ${esc(d.name)} (${range}).</span> ${S(state[key])}</p>`;
  }).join('\n')}
  </section>

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
 /* Mirrors the app's print stylesheet: single column, seven sections, ONE PAGE. */
 @page{size:letter;margin:.45in}
 body{font-family:Montserrat,Segoe UI,sans-serif;font-size:8.4pt;line-height:1.38;color:#16181C;margin:0}
 h1,h2{font-family:Fraunces,Georgia,serif;color:#16181C}
 h1{font-size:14pt;margin:0 0 1pt;letter-spacing:-.01em}
 .report-sub{font-size:7.6pt;color:#5A6068;margin:0 0 5pt}
 .report-head{border-bottom:2px solid #16181C;padding-bottom:4pt;margin-bottom:7pt}
 h2{font-size:9.4pt;color:#0067C5;margin:0 0 3pt;break-after:avoid}
 section{margin-bottom:7pt;break-inside:avoid}
 p{margin:0 0 3pt}
 .lead{font-weight:700;color:#16181C}
 .closing-q{font-style:italic;color:#0067C5;margin-top:3pt}
 table{width:100%;border-collapse:collapse;font-size:7.4pt;margin:3pt 0}
 th{background:#F4F6F8;text-align:left;border:1px solid #DFE3E8;padding:2pt 3.5pt;font-size:6.6pt;text-transform:uppercase;letter-spacing:.04em;color:#5A6068}
 td{border:1px solid #DFE3E8;padding:2pt 3.5pt;vertical-align:top}
 tr{break-inside:avoid}
 .domain-row td{background:#F4F6F8;font-weight:700;font-size:7.2pt}
 .no-evidence{color:#A82D27;font-style:italic}
 .report-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:2pt 14pt;font-size:7.8pt;margin:0}
 .report-meta div{display:flex;flex-direction:column}
 .report-meta .rm-k{color:#5A6068;font-size:6.4pt;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
 .report-meta .rm-v{color:#16181C}
 .keep-together{break-inside:avoid}
 .fidelity-note{font-size:6.6pt;color:#868C95;line-height:1.3;margin-top:2pt}
 .small{font-size:7pt} .muted{color:#5A6068}
 .report{padding:0;border:none}
 .source-tag,#ir-provenance{display:none}
 .band-bar{display:flex;height:5pt;margin-top:8pt}
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
