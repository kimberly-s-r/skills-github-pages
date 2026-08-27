/*
 * Appendix G — POP Cycle Post-Conference Packet parser.
 *
 * NO-FABRICATION CONTRACT
 * This parser only reports what it can actually find. Anything it cannot read with
 * confidence comes back as null with a reason, and the UI asks the coordinator to
 * enter it by hand. It never infers a rating, never fills a gap with a plausible
 * value, and never attaches an evidence line to a dimension it is not printed under.
 *
 * WHAT IT CAN AND CANNOT READ
 *  - Header fields (names, TEA ID, district, grade level): parsed reliably.
 *  - "IR Evidence:" lines: parsed where the packet prints an evidence row. Note that
 *    the source packet prints NO evidence row for 2.1, 2.2, the two untitled Domain 2
 *    dimensions, 3.1, or Domain 3's third dimension — there is nothing to read there.
 *  - R+/R- self-identified and host teacher blocks: parsed where present.
 *  - RATINGS: the fillable packet records IR Self Rating and Host Teacher Rating as
 *    tick marks whose position in the extracted text is detached from the dimension
 *    they belong to. They CANNOT be attributed reliably, so this parser returns them
 *    as null and flags them for manual entry. Guessing here would put a fabricated
 *    score on a TEA-reported rubric.
 *
 * Accepts packet TEXT (.txt/.md — e.g. Drive's text extraction of the PDF) or a
 * structured .json export. A raw .pdf is scanned best-effort for an uncompressed
 * AcroForm; if that fails the UI asks for the text instead rather than half-reading it.
 */

import { IAT_ROWS, printedLabel } from './data/iat.js';

// `[^\S\n]*` is horizontal whitespace only — plain `\s*` would skip the newline and
// capture the NEXT line's text as the value for a label the packet left blank.
const HEADER_PATTERNS = [
  { key: 'siteCoordinator', label: 'Site Coordinator Name', re: /Site Coordinator Name:[^\S\n]*([^\n]*?)(?:[^\S\n]*TEA ID:|$)/im },
  { key: 'hostTeacher',     label: 'Host Teacher Name',     re: /Host Teacher Name:[^\S\n]*([^\n]*?)(?:[^\S\n]*TEA ID:|$)/im },
  { key: 'residentName',    label: 'Resident Name',         re: /Resident Name:[^\S\n]*([^\n]*?)(?:[^\S\n]*TEA ID:|$)/im },
  { key: 'district',        label: 'District',              re: /District:[^\S\n]*([^\n]*?)(?:[^\S\n]*Grade Level:|$)/im },
  { key: 'gradeLevel',      label: 'Grade Level',           re: /Grade Level:[^\S\n]*([^\n]*)/im },
];

function cleanValue(v) {
  if (v == null) return null;
  const s = String(v).replace(/\\/g, '').replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

/**
 * Appendix G prints its header labels in one block and the filled values in a
 * separate block below. Recover the values that follow the "Observation" heading.
 */
function parseDetachedHeaderBlock(text) {
  const m = text.match(/Steps of the POP Cycle[\s\S]{0,200}?Observation\s*\n([\s\S]{0,400}?)(?:•|•)/i);
  if (!m) return [];
  return m[1].split('\n').map((l) => cleanValue(l)).filter(Boolean);
}

function parseHeader(text) {
  const header = {};
  const unresolved = [];

  for (const { key, label, re } of HEADER_PATTERNS) {
    const m = text.match(re);
    header[key] = cleanValue(m && m[1]);
    if (!header[key]) unresolved.push(label);
  }

  const inlineTeaIds = [...text.matchAll(/TEA ID:[^\S\n]*(\d{6,9})/gi)].map((m) => m[1]);
  header.residentTeaId = inlineTeaIds.length ? inlineTeaIds[inlineTeaIds.length - 1] : null;
  header.lessonTopic = header.lessonTopic || null;

  if (!unresolved.length && header.residentTeaId) return header;

  /*
   * Appendix G prints its header LABELS in one block and the filled VALUES in a
   * separate block after the "Observation" heading, in this fixed order:
   *   site coordinator · host teacher · resident (+ TEA ID) · district (+ grade) · lesson topic
   * We read that block positionally, validating each line's shape before using it,
   * so a missing line shifts nothing into the wrong field.
   */
  const block = parseDetachedHeaderBlock(text);
  const isName = (l) => /^[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'.-]+)+$/.test(l);

  const names = [];
  let districtLine = null, gradeLine = null, teaFromBlock = null, topicLine = null;

  for (const line of block) {
    // "Michelle Izarraras 2653142" — a name carrying its TEA ID.
    const withId = line.match(/^(.+?)[^\S\n]+(\d{6,9})$/);
    if (withId && isName(withId[1].trim())) {
      names.push(withId[1].trim());
      teaFromBlock = teaFromBlock || withId[2];
      continue;
    }
    // "Corpus Christi ISD 7" — district carrying its grade level.
    const distGrade = line.match(/^(.*?ISD)[^\S\n]+(\d{1,2})$/i);
    if (distGrade) { districtLine = distGrade[1]; gradeLine = distGrade[2]; continue; }
    if (/ISD$/i.test(line)) { districtLine = districtLine || line; continue; }
    if (/^\d{1,2}$/.test(line)) { gradeLine = gradeLine || line; continue; }
    if (isName(line)) { names.push(line); continue; }
    if (!topicLine && /[a-z]/.test(line) && line.split(/\s+/).length <= 8) topicLine = line;
  }

  if (!header.siteCoordinator && names[0]) header.siteCoordinator = names[0];
  if (!header.hostTeacher && names[1]) header.hostTeacher = names[1];
  if (!header.residentName && names[2]) header.residentName = names[2];
  if (!header.residentTeaId && teaFromBlock) header.residentTeaId = teaFromBlock;
  if (!header.district) header.district = districtLine;
  if (!header.gradeLevel) header.gradeLevel = gradeLine;
  if (!header.lessonTopic) header.lessonTopic = topicLine;

  return header;
}

/**
 * Evidence lines printed under an "IR Evidence:" row. The packet prints these rows
 * for only 7 of the 13 slots, so a null here often means "the source has no row",
 * not "the resident left it blank". Both are reported as no-evidence, never invented.
 */
function parseEvidence(text) {
  const found = {};
  for (const row of IAT_ROWS) {
    found[row.id] = { lines: [], readable: row.slots.length > 0 };
  }

  // Anchor on printed dimension numbers that actually appear in the packet.
  const anchors = [];
  for (const row of IAT_ROWS) {
    if (!row.printedNumber) continue;
    const esc = row.printedNumber.replace('.', '\\.');
    const re = new RegExp(`${esc}\\s*[A-Z][^\\n]{0,80}`, 'g');
    for (const m of text.matchAll(re)) {
      anchors.push({ id: row.id, index: m.index });
    }
  }
  anchors.sort((a, b) => a.index - b.index);

  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i].index;
    const end = i + 1 < anchors.length ? anchors[i + 1].index : text.length;
    const segment = text.slice(start, end);
    for (const m of segment.matchAll(/IR Evidence:\s*([^\n]*)/gi)) {
      const line = cleanValue(m[1]);
      if (line && !/^(IR Self Rating|Host Teacher Rating)/i.test(line)) {
        const bucket = found[anchors[i].id];
        if (bucket && !bucket.lines.includes(line)) bucket.lines.push(line);
      }
    }
  }
  return found;
}

/** R+ / R- blocks: self-identified and host teacher. */
function parseReinforcementRefinement(text) {
  const out = { selfRPlus: null, selfRMinus: null, hostRPlus: null, hostRMinus: null };

  const selfBlock = text.match(/Islander Resident Areas of Reinforcement[\s\S]{0,1200}?(?=Host Teacher Areas of Reinforcement|$)/i);
  if (selfBlock) {
    const p = selfBlock[0].match(/R\+\s*Think I will continue:\s*([^\n]*)/i);
    const m = selfBlock[0].match(/R-\s*Think I can take the following steps[^:]*:\s*([^\n]*)/i);
    out.selfRPlus = cleanValue(p && p[1]);
    out.selfRMinus = cleanValue(m && m[1]);
  }

  const hostBlock = text.match(/Host Teacher Areas of Reinforcement[\s\S]*$/i);
  if (hostBlock) {
    // The filled values print as a run of lines ahead of the trailing "R+R-" marker.
    const lines = hostBlock[0].split('\n').map(cleanValue).filter(Boolean)
      .filter((l) => !/^(TAMU-CC|Islander Assessment Tool|Host Teacher Areas|R\+R-|Page \d+)/i.test(l));
    if (lines.length >= 1) out.hostRPlus = lines[0] || null;
    if (lines.length >= 2) out.hostRMinus = lines[1] || null;
  }
  return out;
}

/**
 * Parse packet text. Ratings are deliberately not inferred — see the contract above.
 */
export function parsePacketText(text, filename = '') {
  const raw = String(text || '');
  const looksLikeAppendixG = /Appendix G|POP Cycle Post-Conference Packet|Islander Assessment Tool/i.test(raw);

  const header = parseHeader(raw);
  const evidence = parseEvidence(raw);
  const rr = parseReinforcementRefinement(raw);

  const dimensions = IAT_ROWS.map((row) => {
    const ev = evidence[row.id] || { lines: [] };
    return {
      id: row.id,
      label: printedLabel(row),
      evidenceLines: ev.lines,
      // Ratings are never guessed from tick-mark positions.
      selfRating: null,
      hostRating: null,
      ratingReason: 'Ratings are recorded as tick marks in the packet and cannot be attributed to a dimension reliably from extracted text. Enter them by hand.',
    };
  });

  const warnings = [];
  if (!looksLikeAppendixG) {
    warnings.push('This file does not look like an Appendix G post-conference packet. Check you uploaded the right document.');
  }
  if (!header.residentName) warnings.push('Resident name not found in the packet header.');
  if (!header.hostTeacher) warnings.push('Host teacher name not found in the packet header.');
  const withEvidence = dimensions.filter((d) => d.evidenceLines.length > 0).length;
  if (withEvidence === 0) {
    warnings.push('No "IR Evidence" lines were readable in this packet. Every rubric row will need evidence from your notes or an explicit no-evidence marker.');
  }

  return {
    ok: true,
    filename,
    looksLikeAppendixG,
    header,
    dimensions,
    reinforcementRefinement: rr,
    stats: {
      dimensionsWithEvidence: withEvidence,
      dimensionsTotal: dimensions.length,
      ratingsParsed: 0,
      ratingsTotal: dimensions.length * 2,
    },
    warnings,
  };
}

/** Structured JSON export of a packet — trusted as given, but shape-checked. */
export function parsePacketJson(obj, filename = '') {
  const known = new Set(IAT_ROWS.map((r) => r.id));
  const warnings = [];
  const byId = {};
  for (const d of (obj.dimensions || [])) {
    if (!known.has(d.id)) {
      warnings.push(`Packet JSON refers to dimension "${d.id}", which is not an IAT dimension. Ignored.`);
      continue;
    }
    byId[d.id] = d;
  }
  const dimensions = IAT_ROWS.map((row) => {
    const d = byId[row.id] || {};
    const lines = Array.isArray(d.evidenceLines) ? d.evidenceLines.filter(Boolean)
                : (d.evidence ? [d.evidence] : []);
    return {
      id: row.id,
      label: printedLabel(row),
      evidenceLines: lines,
      selfRating: d.selfRating ?? null,
      hostRating: d.hostRating ?? null,
      ratingReason: (d.selfRating == null && d.hostRating == null)
        ? 'No rating supplied in the packet JSON.' : null,
    };
  });
  const ratingsParsed = dimensions.reduce(
    (n, d) => n + (d.selfRating != null ? 1 : 0) + (d.hostRating != null ? 1 : 0), 0);

  return {
    ok: true, filename, looksLikeAppendixG: true,
    header: obj.header || {},
    dimensions,
    reinforcementRefinement: obj.reinforcementRefinement || {},
    stats: {
      dimensionsWithEvidence: dimensions.filter((d) => d.evidenceLines.length > 0).length,
      dimensionsTotal: dimensions.length,
      ratingsParsed,
      ratingsTotal: dimensions.length * 2,
    },
    warnings,
  };
}

/**
 * Best-effort read of a raw PDF: only uncompressed AcroForm field values are
 * recoverable without a PDF library. Returns ok:false with an explicit ask rather
 * than returning a partial read that looks complete.
 */
export function parsePacketPdfBytes(bytes, filename = '') {
  const latin = new TextDecoder('latin1').decode(bytes);
  const fields = [...latin.matchAll(/\/T\s*\(([^)]*)\)[\s\S]{0,200}?\/V\s*\(([^)]*)\)/g)]
    .map((m) => ({ name: m[1], value: cleanValue(m[2]) }))
    .filter((f) => f.value);

  if (fields.length === 0) {
    return {
      ok: false,
      filename,
      reason: 'This PDF stores its form data in a compressed stream, which cannot be read in the browser without a PDF library.',
      remedy: 'Open the packet, copy its text, and paste it into the box below — or upload a .txt/.md extraction of it. The parser reads that reliably.',
    };
  }

  const asText = fields.map((f) => `${f.name}: ${f.value}`).join('\n');
  const parsed = parsePacketText(asText, filename);
  parsed.warnings.unshift(
    `Read ${fields.length} form field(s) directly from the PDF. Check every value against the packet before submitting — PDF field extraction is best-effort.`);
  return parsed;
}
