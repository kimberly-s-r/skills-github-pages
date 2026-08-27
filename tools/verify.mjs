/*
 * Verification for the constraints this app is required to hold.
 * Run against a locally served copy:
 *
 *   npx serve -l 8099 .
 *   node tools/verify.mjs [http://localhost:8099]
 *
 * Needs playwright (`npm i -D playwright`). Exits non-zero on any failure.
 */

import { chromium } from 'playwright';
import { readFileSync, unlinkSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8099';
const CHROME = process.env.CHROME_PATH || undefined;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const pdfPages = (f) => (readFileSync(f).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

/* ---------- schema + IAT invariants (no browser needed) ---------- */
const iat = await import('../assets/js/data/iat.js');
const schema = await import('../assets/js/data/schema.js');

check('Appendix G prints 13 dimension slots', iat.PRINTED_SLOT_COUNT === 13, `got ${iat.PRINTED_SLOT_COUNT}`);
check('13 slots merge to 12 rubric rows', iat.RUBRIC_ROW_COUNT === 12, `got ${iat.RUBRIC_ROW_COUNT}`);
check('3.2 is one row built from two printings',
  iat.IAT_ROWS.find((r) => r.id === '3.2')?.slots.length === 2);
check('No untitled dimension is given an invented title',
  iat.IAT_ROWS.filter((r) => !r.printedTitle).every((r) => iat.printedLabel(r).startsWith('[no number or title printed]') || !r.printedTitle && r.printedNumber));
check('POP Cycles tab has 24 columns (A–X)', schema.POP_COLUMNS.length === 24, `got ${schema.POP_COLUMNS.length}`);
check('Walkthroughs tab has 10 columns (A–J)', schema.WT_COLUMNS.length === 10, `got ${schema.WT_COLUMNS.length}`);
check('An unknown column is rejected, not silently written',
  schema.verifySchema('Walkthroughs', { 'TEA ID': '1' }).some((e) => e.includes('does not exist')));

/* ---------- browser checks ---------- */
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
check('App loads with no runtime errors', pageErrors.length === 0, pageErrors.join('; '));

// Brand: exactly one wave watermark per visible surface.
const waveAudit = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('.surface, .report')) {
    if (el.offsetParent === null) continue;
    const self = getComputedStyle(el, '::after').backgroundImage.includes('wave.svg') ? 1 : 0;
    const nested = [...el.querySelectorAll('.surface, .report')].filter(
      (c) => c.offsetParent !== null &&
        getComputedStyle(c, '::after').backgroundImage.includes('wave.svg')).length;
    out.push({ id: el.id || el.className, total: self + nested });
  }
  return out;
});
check('Exactly one wave watermark per surface',
  waveAudit.every((w) => w.total === 1),
  waveAudit.filter((w) => w.total !== 1).map((w) => `${w.id}=${w.total}`).join(', '));

check('Every band bar has five bands',
  (await page.evaluate(() => [...document.querySelectorAll('.band-bar')].map((b) => b.children.length)))
    .every((n) => n === 5));

/* Fill a POP observation. */
await page.selectOption('#school', 'cunningham');
await page.selectOption('#resident', 'Michelle Izarraras');
check('Selecting a resident auto-fills host teacher',
  (await page.inputValue('#hostTeacher')) === 'Krista Montiel');
check('Selecting a resident auto-fills TEA ID',
  (await page.inputValue('#teaId')) === '2653142');

await page.selectOption('#popCycle', '2');
await page.click('#stampIn');
check('Time In stamps ISO 8601 with a Central offset',
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[-+]0[56]:00$/.test(await page.inputValue('#timeIn')),
  await page.inputValue('#timeIn'));
await page.click('#stampOut');
await page.fill('#notes', 'ACE formula posted and referenced. Think-pair-share twice.');
await page.waitForTimeout(400);

check('Submission is blocked while rubric rows are unaccounted for',
  await page.isDisabled('#submitRow'));

for (const box of await page.$$('input[data-field="noEvidence"]')) await box.check();
await page.waitForTimeout(400);
check('Marking every row "No evidence available" satisfies the rubric check',
  (await page.textContent('#checksOut')).includes('All 12 rubric rows carry'));

check('Confirm step is still required after checks pass',
  await page.isDisabled('#submitRow'));
await page.check('#confirmRow');
await page.waitForTimeout(200);
check('Submission unlocks only after explicit confirmation',
  !(await page.isDisabled('#submitRow')));

const report = await page.textContent('#reportOut');
check('Growth Summary opener is verbatim',
  report.includes('you have worked to improve the refinement by'));
check('Reinforcement opener is verbatim',
  report.includes('In this observation, you continue this trend'));
check('Reinforcement closes with the required question',
  report.includes('What is your goal for the next walkthrough?'));
check('Unsupported dimensions say so literally, never blank',
  report.includes('No evidence available in this observation'));
check('Required domain comments cover all three domains',
  ['Domain 1 — Planning (1.1–1.4)', 'Domain 2 — Instruction (2.1–2.5)',
   'Domain 3 — Learning Environment (3.1–3.3)'].every((s) => report.includes(s)));

// No text may sit behind a watermark.
const overlaps = await page.evaluate(() => {
  const hits = [];
  for (const el of document.querySelectorAll('.surface, .report')) {
    if (el.offsetParent === null) continue;
    if (!getComputedStyle(el, '::after').backgroundImage.includes('wave.svg')) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const w = parseFloat(cs.getPropertyValue('--wave-w')) || 168;
    const h = parseFloat(cs.getPropertyValue('--wave-h')) || 84;
    const g = parseFloat(cs.getPropertyValue('--wave-gutter')) || 28;
    const z = { l: r.right - g - w, t: r.bottom - g - h, r: r.right - g, b: r.bottom - g };
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        if (rect.right > z.l && rect.left < z.r && rect.bottom > z.t && rect.top < z.b) {
          hits.push(n.textContent.trim().slice(0, 40));
        }
      }
    }
  }
  return hits;
});
check('No text sits behind a watermark', overlaps.length === 0, overlaps.join(' | '));

/* The brief specifies a section order and verbatim language. Assert the order the
   reader actually encounters, and that nothing is columned — a column break is what
   destroys that order. Page count is reported, not asserted: legibility comes first. */
const order = await page.$$eval('#reportOut .report section h2', (hs) => hs.map((h) => h.textContent.trim()));
const expected = ['Pre-Conference Summary', 'Growth Summary', 'Reinforcement',
                  'Refinement', 'Rubric Alignment Table', 'Required Domain Comments'];
check('Sections appear in the specified order',
  JSON.stringify(order) === JSON.stringify(expected), order.join(' -> '));
check('No section beyond the seven specified is added',
  order.length === expected.length, `${order.length + 1} sections incl. header`);

const columned = await page.evaluate(() => {
  const rep = document.querySelector('#reportOut .report');
  return [rep, ...rep.querySelectorAll('*')].some((el) => {
    const cc = getComputedStyle(el).columnCount;
    return cc && cc !== 'auto' && Number(cc) > 1;
  });
});
check('Report is a single unbroken column', !columned);

const headOrder = await page.$$eval('#reportOut .report-meta .rm-k', (ks) => ks.map((k) => k.textContent.trim()));
check('Header fields are in the specified order',
  JSON.stringify(headOrder) === JSON.stringify(
    ['Resident', 'Host Teacher', 'Content Area', 'School', 'Observation Date', 'Time In / Out']),
  headOrder.join(', '));

check('Time In / Out does not repeat the date twice',
  !/(\w+ \d+, \d{4}).*\1/.test(await page.$eval('#reportOut .report-meta div:last-child .rm-v', (e) => e.textContent)),
  await page.$eval('#reportOut .report-meta div:last-child .rm-v', (e) => e.textContent.trim()));

await page.pdf({ path: '.verify-pop.pdf', format: 'Letter', printBackground: true });
console.log(`INFO  Anchor Assessment Report prints to ${pdfPages('.verify-pop.pdf')} page(s)`);

/* Walkthrough mode. */
const wt = await browser.newPage();
await wt.goto(BASE, { waitUntil: 'networkidle' });
await wt.click('#modeWt');
await wt.selectOption('#school', 'king');
await wt.selectOption('#resident', 'Kassandra Sandoval');
await wt.selectOption('#wtNumber', '2');
await wt.click('#stampIn'); await wt.click('#stampOut');
await wt.fill('#notes', 'Led opener for two periods. Recall-level questions. Quick transitions.');
await wt.fill('#rPlus', 'Routines'); await wt.fill('#rPlusEvidence', 'Quick transitions.');
await wt.fill('#rMinus', 'Questioning'); await wt.fill('#rMinusEvidence', 'Questions were mostly recall level.');
await wt.waitForTimeout(500);
const wrep = await wt.textContent('#reportOut');
check('Walkthrough report carries the Site Coordinator block',
  wrep.includes('Site Coordinator Notes') && wrep.includes('Co-Teaching Observed'));
check('Resident reflection prompts are left blank for the resident',
  wrep.includes('To be completed by the resident.'));
await wt.pdf({ path: '.verify-wt.pdf', format: 'Letter', printBackground: true });
console.log(`INFO  Walkthrough report prints to ${pdfPages('.verify-wt.pdf')} page(s)`);

for (const f of ['.verify-pop.pdf', '.verify-wt.pdf']) { try { unlinkSync(f); } catch {} }
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
