/*
 * Islander Residency Observation Log — application wiring.
 */

import { SCHOOLS, residentsAt, findResident } from './data/roster.js';
import { WALKTHROUGH_WINDOWS, suggestWalkthrough } from './data/windows.js';
import {
  IAT_ROWS, DOMAINS, RATINGS, printedLabel, NO_EVIDENCE,
  PRINTED_SLOT_COUNT, RUBRIC_ROW_COUNT,
} from './data/iat.js';
import { stampNow, todayISO, dateOf, durationMinutes } from './time.js';
import { parsePacketText, parsePacketJson, parsePacketPdfBytes } from './packet.js';
import { runAllChecks, rubricRowState, checkNoFabrication } from './guardrails.js';
import { buildPopReport, toDocHtml } from './report-pop.js';
import { buildWtReport, toWtDocHtml, CO_TEACHING_MODELS } from './report-wt.js';
import {
  buildRowFor, diffRow, findPrevious, recordSubmission,
  walkthroughTrendFor, handoffText, WRITE_ADAPTER,
} from './submit.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const state = {
  mode: 'pop',
  school: '', schoolName: '', residentName: '', hostTeacher: '', teaId: '',
  popCycle: '', wtNumber: '', timeIn: '', timeOut: '', notes: '',
  rubric: {}, packet: null, importedWtRows: [], studentWorkPhoto: null,
  generatedAt: null,
};

/* Text inputs that map straight onto state keys. */
const TEXT_FIELDS = [
  'contentArea', 'sourceNotesLink', 'lessonObjective', 'plannedStrategies',
  'anticipatedChallenges', 'lessonTopic', 'priorObservationDate', 'priorRefinement',
  'growthEvidence', 'reinforcementDomain', 'reinforcementEvidence', 'reinforcementWhy',
  'refinementDomain', 'refinementEvidence', 'refinementStrategy', 'refinementPriorLink',
  'domainComment1', 'domainComment2', 'domainComment3', 'smartGoal', 'udlStrategy',
  'slUploadStatus', 'slUploadDate', 'reportDocLink',
  'grade', 'focusArea', 'durationOverride', 'htCoachingGoal', 'htFeedback',
  'coTeachingModel', 'rPlus', 'rPlusEvidence', 'rMinus', 'rMinusEvidence', 'actionSteps',
];

/* ---------------- population ---------------- */

function populateStatic() {
  const school = $('school');
  for (const s of SCHOOLS) {
    school.insertAdjacentHTML('beforeend', `<option value="${esc(s.id)}">${esc(s.name)}</option>`);
  }

  const wt = $('wtNumber');
  for (const w of WALKTHROUGH_WINDOWS) {
    wt.insertAdjacentHTML('beforeend',
      `<option value="${w.number}">${w.number} — ${esc(w.term)} (${esc(w.start)} to ${esc(w.end)})</option>`);
  }

  const ct = $('coTeachingModel');
  for (const m of CO_TEACHING_MODELS) {
    ct.insertAdjacentHTML('beforeend', `<option value="${esc(m)}">${esc(m)}</option>`);
  }

  for (const id of ['reinforcementDomain', 'refinementDomain']) {
    const sel = $(id);
    for (const d of DOMAINS) {
      const opts = IAT_ROWS.filter((r) => r.domain === d.id)
        .map((r) => `<option value="${esc(printedLabel(r))}">${esc(printedLabel(r))}</option>`).join('');
      sel.insertAdjacentHTML('beforeend',
        `<optgroup label="Domain ${d.id}: ${esc(d.name)}">${opts}</optgroup>`);
    }
  }

  $('rubricFidelityNote').innerHTML =
    `<h4>Source fidelity</h4>Appendix G prints <strong>${PRINTED_SLOT_COUNT} dimension slots</strong>; ` +
    `3.2 Managing Student Behavior is printed twice, so the table below has ` +
    `<strong>${RUBRIC_ROW_COUNT} rows</strong> and keeps both 3.2 evidence lines when they differ. ` +
    `Dimensions the packet prints without a number or title are shown exactly as printed — no title is invented.`;
}

function buildRubricTable() {
  const tbody = $('rubricTable').querySelector('tbody');
  const ratingOptions = ['<option value="">—</option>',
    ...RATINGS.map((r) => `<option value="${r.value}">${esc(r.short)}</option>`)].join('');

  const html = [];
  html.push(`<tr><th>Dimension (as printed)</th><th>IR Self</th><th>Host Teacher</th><th>Site Coord.</th><th>Evidence</th><th>No evidence</th></tr>`);

  for (const d of DOMAINS) {
    html.push(`<tr class="domain-band d${d.id}"><td colspan="6">Domain ${d.id}: ${esc(d.name)}</td></tr>`);
    for (const row of IAT_ROWS) {
      if (row.domain !== d.id) continue;
      const notes = row.sourceNotes.length
        ? `<span class="dim-note">${row.sourceNotes.map(esc).join(' ')}</span>` : '';
      const ref = (!row.printedNumber || !row.printedTitle)
        ? `<span class="dim-ref">Programme reference: ${esc(row.programDesignation)}</span>` : '';
      html.push(`<tr data-row="${esc(row.id)}">
        <td><span class="dim-label">${esc(printedLabel(row))}</span>${ref}${notes}</td>
        <td><select data-field="selfRating" data-row="${esc(row.id)}">${ratingOptions}</select></td>
        <td><select data-field="hostRating" data-row="${esc(row.id)}">${ratingOptions}</select></td>
        <td><select data-field="scRating" data-row="${esc(row.id)}">${ratingOptions}</select></td>
        <td><textarea data-field="evidence" data-row="${esc(row.id)}" placeholder="Evidence from the notes or packet"></textarea></td>
        <td style="text-align:center"><input type="checkbox" data-field="noEvidence" data-row="${esc(row.id)}"
             title="${esc(NO_EVIDENCE)}" style="width:auto"></td>
      </tr>`);
    }
  }
  tbody.innerHTML = html.join('\n');

  tbody.addEventListener('input', (e) => {
    const t = e.target;
    const rowId = t.dataset.row, field = t.dataset.field;
    if (!rowId || !field) return;
    state.rubric[rowId] = state.rubric[rowId] || {};
    if (field === 'noEvidence') {
      state.rubric[rowId].noEvidence = t.checked;
    } else if (field === 'evidence') {
      state.rubric[rowId].evidence = t.value;
    } else {
      state.rubric[rowId][field] = t.value === '' ? null : Number(t.value);
    }
    refresh();
  });
  tbody.addEventListener('change', (e) => {
    if (e.target.dataset.row) refresh();
  });
}

/* ---------------- state sync ---------------- */

function syncFromInputs() {
  for (const id of TEXT_FIELDS) {
    const el = $(id);
    if (el) state[id] = el.value;
  }
  state.notes = $('notes').value;
  state.timeIn = $('timeIn').value;
  state.timeOut = $('timeOut').value;
  state.popCycle = $('popCycle').value;
  state.wtNumber = $('wtNumber').value;
}

function onSchoolChange() {
  const id = $('school').value;
  state.school = id;
  state.schoolName = SCHOOLS.find((s) => s.id === id)?.name || '';

  const sel = $('resident');
  const list = residentsAt(id);
  sel.innerHTML = list.length
    ? '<option value="">Select a resident…</option>' +
      list.map((r) => `<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('')
    : '<option value="">No residents on the roster for this campus</option>';
  sel.disabled = !id || list.length === 0;

  state.residentName = ''; state.hostTeacher = ''; state.teaId = '';
  $('hostTeacher').value = ''; $('teaId').value = '';
  $('residentNote').textContent = list.length === 0 && id
    ? 'No resident on the seeded roster is placed at this campus.' : '';
  $('teaIdNote').textContent = '';
  refresh();
}

function onResidentChange() {
  const name = $('resident').value;
  const r = findResident(name);
  state.residentName = name;
  state.hostTeacher = r?.hostTeacher || '';
  state.teaId = r?.teaId || '';
  $('hostTeacher').value = state.hostTeacher;
  $('teaId').value = state.teaId;
  $('teaIdNote').textContent = r && !r.teaId
    ? 'Not on file in the roster sheet — enter it manually if the packet carries it.' : '';
  $('residentNote').textContent = r?.note || '';
  $('teaId').readOnly = Boolean(r?.teaId);
  refresh();
}

function setMode(mode) {
  state.mode = mode;
  $('modePop').setAttribute('aria-pressed', String(mode === 'pop'));
  $('modeWt').setAttribute('aria-pressed', String(mode === 'wt'));
  $('step2').classList.toggle('hidden', mode !== 'pop');
  $('step3').classList.toggle('hidden', mode !== 'wt');
  $('popCycleField').classList.toggle('hidden', mode !== 'pop');
  $('wtNumberField').classList.toggle('hidden', mode !== 'wt');
  $('reportTitle').textContent = mode === 'pop' ? 'Anchor Assessment Report' : 'Walkthrough Feedback';
  $('tabChip').textContent = mode === 'pop' ? 'POP Cycles' : 'Walkthroughs';
  if (mode === 'wt') applyWtSuggestion();
  refresh();
}

function applyWtSuggestion() {
  const day = dateOf(state.timeIn) || todayISO();
  const s = suggestWalkthrough(day);
  $('wtSuggestion').textContent = s.reason;
  if (s.number && !$('wtNumber').value) {
    $('wtNumber').value = String(s.number);
    state.wtNumber = String(s.number);
  }
}

/* ---------------- packet ---------------- */

function renderPacketReport(p) {
  const box = $('packetReport');
  if (!p) { box.innerHTML = ''; return; }

  if (p.ok === false) {
    box.innerHTML = `<div class="callout stop"><h4>Could not read this PDF</h4>
      <p>${esc(p.reason)}</p><p>${esc(p.remedy)}</p></div>`;
    return;
  }

  const warn = p.warnings.length
    ? `<ul>${p.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '';

  box.innerHTML = `<div class="callout ${p.warnings.length ? 'warn' : 'ok'}">
    <h4>Packet read${p.filename ? `: ${esc(p.filename)}` : ''}</h4>
    <p>Evidence lines found for <strong>${p.stats.dimensionsWithEvidence} of ${p.stats.dimensionsTotal}</strong> rubric rows.
       Ratings parsed: <strong>${p.stats.ratingsParsed} of ${p.stats.ratingsTotal}</strong> — enter the rest by hand.</p>
    ${warn}
  </div>`;
}

function applyPacket(p) {
  state.packet = p;
  renderPacketReport(p);
  if (!p || p.ok === false) { refresh(); return; }

  const h = p.header || {};
  if (h.residentTeaId && !$('teaId').value) { $('teaId').value = h.residentTeaId; state.teaId = h.residentTeaId; }
  if (h.lessonTopic && !$('lessonTopic').value) $('lessonTopic').value = h.lessonTopic;
  if (h.gradeLevel && !$('grade').value) $('grade').value = h.gradeLevel;

  const rr = p.reinforcementRefinement || {};
  if (rr.selfRPlus && !$('reinforcementEvidence').value) $('reinforcementEvidence').value = rr.selfRPlus;
  if (rr.selfRMinus && !$('refinementEvidence').value) $('refinementEvidence').value = rr.selfRMinus;

  for (const d of p.dimensions) {
    const entry = state.rubric[d.id] = state.rubric[d.id] || {};
    if (d.evidenceLines.length) {
      const joined = d.evidenceLines.join('\n');
      if (!String(entry.evidence || '').trim()) {
        entry.evidence = joined;
        entry.packetEvidence = true;
        entry.evidenceFromPacketOnly = true;
        const ta = document.querySelector(`textarea[data-field="evidence"][data-row="${d.id}"]`);
        if (ta) ta.value = joined;
      }
    }
    for (const [field, val] of [['selfRating', d.selfRating], ['hostRating', d.hostRating]]) {
      if (val == null) continue;
      entry[field] = Number(val);
      const sel = document.querySelector(`select[data-field="${field}"][data-row="${d.id}"]`);
      if (sel) sel.value = String(val);
    }
  }
  syncFromInputs();
  refresh();
}

async function handlePacketFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    applyPacket(parsePacketPdfBytes(new Uint8Array(await file.arrayBuffer()), file.name));
  } else if (name.endsWith('.json')) {
    try { applyPacket(parsePacketJson(JSON.parse(await file.text()), file.name)); }
    catch (e) { applyPacket({ ok: false, reason: `That .json file could not be parsed: ${e.message}`, remedy: 'Check the file is valid JSON, or paste the packet text instead.' }); }
  } else {
    applyPacket(parsePacketText(await file.text(), file.name));
  }
}

/* ---------------- report + checks ---------------- */

function currentTrend() {
  let imported = [];
  const raw = $('wtTrendImport').value.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      imported = Array.isArray(parsed) ? parsed : [parsed];
    } catch { /* surfaced in the trend note below */ }
  }
  $('trendNote').textContent = raw && imported.length === 0
    ? 'That pasted text is not valid JSON, so no rows were imported. Locally logged walkthroughs are still included.'
    : 'Locally logged walkthroughs are included automatically. The trend table appears from POP Cycle 2 onward; anything missing is shown as missing, never filled in.';
  state.importedWtRows = imported;
  return walkthroughTrendFor(state.residentName, imported);
}

let lastReport = null;

function renderReport() {
  state.generatedAt = stampNow();
  if (state.mode === 'pop') {
    lastReport = buildPopReport(state, { trend: currentTrend() });
    $('reportOut').innerHTML = lastReport.html;
  } else {
    const html = buildWtReport(state);
    lastReport = { html, metadata: null };
    $('reportOut').innerHTML = html;
  }
}

function renderChecks(result, fabrication) {
  const items = [...result.checks];
  if (fabrication) items.push({ id: 'fabrication', label: 'Evidence traceability', blocking: false, ...fabrication });

  $('checksOut').innerHTML = items.map((c) => {
    const cls = c.passed ? 'ok' : (c.blocking ? 'stop' : 'warn');
    const chip = c.passed ? 'green' : (c.blocking ? 'red' : 'gold');
    const label = c.passed ? 'Pass' : (c.blocking ? 'Blocks submission' : 'Review');
    const detail = c.incomplete?.length
      ? `<ul>${c.incomplete.map((r) => `<li>${esc(r.label)}</li>`).join('')}</ul>`
      : c.unsourced?.length
        ? `<ul>${c.unsourced.map((u) => `<li>${esc(u.field)}: “${esc(String(u.text).slice(0, 120))}”</li>`).join('')}</ul>`
        : '';
    return `<div class="callout ${cls}">
      <h4>${esc(c.label)} <span class="chip ${chip}">${label}</span></h4>
      <p style="margin:0">${esc(c.message)}</p>${detail}</div>`;
  }).join('');
}

function renderDiff(tab, row) {
  const prev = findPrevious(tab, row);
  const rows = diffRow(tab, row, prev);
  const chipFor = { new: 'blue', same: 'grey', added: 'green', changed: 'gold', cleared: 'red' };

  $('diffOut').innerHTML = `
    <div class="diff-head"><span>Col</span><span>Column name</span><span>Value</span></div>
    ${rows.map((r) => `<div class="diff-row">
      <span class="diff-col">${esc(r.col)}</span>
      <span class="diff-key">${esc(r.key)}${r.required ? ' <span class="chip red" style="font-size:.6rem">req</span>' : ''}</span>
      <span class="diff-val${r.blank ? ' blank' : ''}">${r.blank ? '(blank cell)' : esc(r.value)}${
        prev && r.status !== 'same' && r.status !== 'new'
          ? ` <span class="chip ${chipFor[r.status]}" style="font-size:.6rem">${r.status}</span>` : ''}</span>
    </div>`).join('')}
    <p class="hint" style="margin-top:.6rem">${
      prev ? 'Compared against the last row you logged for this resident and cycle.'
           : 'No previous row logged for this resident and cycle in this browser — every cell is new.'}</p>`;
}

function refresh() {
  syncFromInputs();

  if (state.mode === 'wt') {
    const d = durationMinutes(state.timeIn, state.timeOut);
    if (d != null && !$('durationOverride').value) $('durationOverride').placeholder = `${d} (auto)`;
  }
  const dur = durationMinutes(state.timeIn, state.timeOut);
  $('durationNote').textContent = dur != null ? `Duration: ${dur} min` : '';

  const complete = IAT_ROWS.filter((r) => rubricRowState(state.rubric[r.id]).complete).length;
  $('rubricCount').textContent = `${complete} / ${RUBRIC_ROW_COUNT} rows complete`;

  for (const row of IAT_ROWS) {
    const tr = document.querySelector(`tr[data-row="${row.id}"]`);
    if (tr) tr.classList.toggle('row-incomplete', !rubricRowState(state.rubric[row.id]).complete);
  }

  renderReport();

  const { tab, row } = buildRowFor(state);
  const result = runAllChecks(state, row, tab);

  const claims = state.mode === 'pop'
    ? [
        { field: 'Reinforcement evidence', text: state.reinforcementEvidence },
        { field: 'Refinement evidence', text: state.refinementEvidence },
        { field: 'Growth evidence', text: state.growthEvidence },
      ].filter((c) => String(c.text || '').trim())
    : [
        { field: 'R+ evidence', text: state.rPlusEvidence },
        { field: 'R− evidence', text: state.rMinusEvidence },
      ].filter((c) => String(c.text || '').trim());

  const fabrication = claims.length
    ? { label: 'Evidence traceability', ...checkNoFabrication(state, claims) }
    : null;

  renderChecks(result, fabrication);
  renderDiff(tab, row);

  $('confirmWho').textContent = state.residentName || 'this resident';
  const ready = result.canSubmit && $('confirmRow').checked;
  $('submitRow').disabled = !ready;
  $('copyCall').disabled = !result.canSubmit;
  if (!result.canSubmit && $('confirmRow').checked) $('confirmRow').checked = false;
}

/* ---------------- actions ---------------- */

function downloadFile(name, content, type = 'text/html') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function docFilename() {
  const who = (state.residentName || 'Resident').replace(/\s+/g, '_');
  return state.mode === 'pop'
    ? `AnchorReport_${who}_POP${state.popCycle || 'X'}_${dateOf(state.timeIn) || todayISO()}.html`
    : `Walkthrough_${who}_WT${state.wtNumber || 'X'}_${dateOf(state.timeIn) || todayISO()}.html`;
}

async function onSubmit() {
  const { tab, row } = buildRowFor(state);
  const res = await WRITE_ADAPTER.write(tab, row);

  if (!res.ok) {
    $('submitOut').innerHTML = `<div class="callout stop"><h4>Not written</h4>
      <ul>${res.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    return;
  }

  recordSubmission(tab, row, { mode: state.mode, reportDocLink: state.reportDocLink || null });

  $('submitOut').innerHTML = `<div class="callout ok">
    <h4>Row confirmed and ready to write</h4>
    <p>This page is served as a static site, so it cannot call the MCP tool itself.
       Hand this call to your Claude session and it appends the row to the
       <strong>${esc(tab)}</strong> tab exactly as shown.</p>
    <textarea readonly rows="14" class="mono" style="font-size:.74rem">${esc(handoffText(tab, row))}</textarea>
    <div class="btn-row" style="margin-top:.5rem">
      <button type="button" class="btn ghost" id="copyCall2">Copy call</button>
      <button type="button" class="btn ghost" id="downloadCall">Download .json</button>
    </div>
  </div>`;

  $('copyCall2').addEventListener('click', () => copyCall(tab, row));
  $('downloadCall').addEventListener('click', () =>
    downloadFile(`log_observation_${(state.residentName || 'resident').replace(/\s+/g, '_')}.json`,
      handoffText(tab, row), 'application/json'));

  $('confirmRow').checked = false;
  refresh();
}

async function copyCall(tab, row) {
  const text = handoffText(tab, row);
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}

/* ---------------- init ---------------- */

function wire() {
  $('school').addEventListener('change', onSchoolChange);
  $('resident').addEventListener('change', onResidentChange);
  $('modePop').addEventListener('click', () => setMode('pop'));
  $('modeWt').addEventListener('click', () => setMode('wt'));

  $('stampIn').addEventListener('click', () => {
    $('timeIn').value = stampNow();
    if (state.mode === 'wt') applyWtSuggestion();
    refresh();
  });
  $('stampOut').addEventListener('click', () => { $('timeOut').value = stampNow(); refresh(); });

  for (const id of [...TEXT_FIELDS, 'notes', 'timeIn', 'timeOut', 'popCycle', 'wtNumber', 'wtTrendImport']) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener('input', refresh);
    el.addEventListener('change', refresh);
  }

  $('packetFile').addEventListener('change', (e) => handlePacketFile(e.target.files[0]));
  $('parsePacketText').addEventListener('click', () => {
    const t = $('packetText').value.trim();
    if (t) applyPacket(parsePacketText(t, 'pasted text'));
  });
  $('clearPacket').addEventListener('click', () => {
    $('packetFile').value = ''; $('packetText').value = '';
    applyPacket(null);
  });

  $('photoFile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) { state.studentWorkPhoto = null; refresh(); return; }
    const reader = new FileReader();
    reader.onload = () => { state.studentWorkPhoto = reader.result; refresh(); };
    reader.readAsDataURL(f);
  });

  $('refreshReport').addEventListener('click', refresh);
  $('printReport').addEventListener('click', () => window.print());
  $('downloadDoc').addEventListener('click', () => {
    renderReport();
    const title = state.mode === 'pop'
      ? `Anchor Assessment Report — ${state.residentName || 'Resident'} — POP ${state.popCycle || ''}`
      : `Walkthrough ${state.wtNumber || ''} — ${state.residentName || 'Resident'}`;
    const html = state.mode === 'pop'
      ? toDocHtml(lastReport.html, lastReport.metadata, title)
      : toWtDocHtml(lastReport.html, state, title);
    downloadFile(docFilename(), html);
  });

  $('confirmRow').addEventListener('change', refresh);
  $('submitRow').addEventListener('click', onSubmit);
  $('copyCall').addEventListener('click', () => {
    const { tab, row } = buildRowFor(state);
    copyCall(tab, row);
  });
}

populateStatic();
buildRubricTable();
wire();
setMode('pop');
refresh();
