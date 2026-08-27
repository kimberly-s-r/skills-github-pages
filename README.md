# Islander Residency — Observation Log

A web UI for logging Islander Residency observations in two modes — **POP Cycle** and
**Walkthrough** — sharing one shell and producing different reports. Static site,
deployable as-is to GitHub Pages.

Data is written to the **IR26 Observations** spreadsheet
([`1pSXwXoP-nRYKqN-6e_kAE9VCpSKTRe-ywraCLsk1fIA`](https://docs.google.com/spreadsheets/d/1pSXwXoP-nRYKqN-6e_kAE9VCpSKTRe-ywraCLsk1fIA/edit))
via the `log_observation` MCP tool, tab `POP Cycles` or `Walkthroughs`.

---

## How the write actually happens

This is a static site. A browser cannot call an MCP tool, and it must not hold Google
credentials. So the page does everything it can do safely and verifiably:

1. builds a row that is **guaranteed schema-valid** against the `log_observation` schema,
2. shows the **exact row** with a diff against the last row logged for that resident and cycle,
3. requires an **explicit confirmation**, then
4. emits the exact `log_observation` call — copy it or download it as `.json` — for your
   Claude session to execute.

`WRITE_ADAPTER` in `assets/js/submit.js` is the single seam. Point it at an
authenticated endpoint and nothing else in the app changes.

## Keeping the schema in sync

`assets/js/data/schema.js` is the single source of truth for row construction and is
transcribed from the `log_observation` tool schema (2026-08-27). **Do not hand-edit
column names to fix a mismatch.** If the sheet changes, re-read the tool schema and
regenerate the file. `verifySchema()` blocks submission when a row carries a key the tab
does not accept, or leaves a required column empty — so drift surfaces as a blocked
submission rather than a silently mangled row.

---

## Steps

### Step 1 — Shell (both modes)
School → Resident (filtered by school) → host teacher and TEA ID auto-fill read-only.
Mode toggle switches everything below. POP Cycle # is 1–4; Walkthrough # is 1–8 and is
auto-suggested from today's date against the Appendix E windows. Time In / Time Out
stamp ISO 8601 in `America/Chicago`, with manual override. Rough notes are the only
evidence source, plus any uploaded packet.

### Step 2 — POP Cycle
Upload the Appendix G post-conference packet (`.pdf`, `.txt`, `.md`, `.json`) or paste
its text. Produces the **Anchor Assessment Report** in exactly the specified section
order, with the opening sentences verbatim:

1. Header · 2. Pre-Conference Summary · 3. Growth Summary (with a WT5–WT8 trend table
when POP Cycle > 1) · 4. Reinforcement · 5. Refinement · 6. Rubric Alignment Table ·
7. Required Domain Comments.

The report is a **single unbroken column** read top to bottom, and carries those seven
sections and nothing else. It is deliberately *not* laid out in columns: a column break
reorders what the reader encounters and destroys the specified 2→3→4→5 flow. A
fully-populated report with a walkthrough trend table runs to two pages — legibility and
the specified order take priority over fitting one page, and the verifier reports the
page count rather than asserting it.

### Step 3 — Walkthrough
Notes only, plus an optional student-work photo (the photo stays in your browser and is
embedded in the export; it is never uploaded by this site). One page, modelled on
Appendix E's Site Coordinator Feedback block. The resident's reflection prompts are
printed **blank** — the tool never writes the resident's reflection for them.

### Step 4 — Guardrails
- Submission is **blocked** unless every rubric row has a rating, evidence, or the
  explicit `No evidence available in this observation` marker.
- The exact row is shown with a diff and an explicit confirm step before any write.
- Which source supported each rubric row (notes vs. packet) is stored as **hidden
  metadata** on the exported Doc — an HTML comment plus a `display:none` block — and
  never appears on the printed page.
- A traceability check flags narrative claims whose wording appears in neither the
  rough notes nor the packet.

---

## Source fidelity — read this before "fixing" the rubric

Appendix G prints **13 dimension slots**. The UI preserves every one exactly as printed
and never invents a title:

| Printed as | Note |
|---|---|
| `1.1`–`1.4` | Number and title both printed. |
| `2.1`, `2.2` | Number printed, **no title**. Preserved as printed. |
| Domain 2, 3rd and 4th slots | **Neither number nor title** printed. Identified by position. Some copies print the third as `2.3`. |
| `2.5 Monitor and Adjust` | Number and title both printed. |
| `3.1` | Number and title printed. |
| `3.2 Managing Student Behavior` | **Printed twice.** Merged into one row; both evidence lines kept when they differ. |
| Domain 3, 3rd distinct slot | **Neither number nor title** printed. Identified by position. |

**13 printed slots → 12 rubric rows** once the duplicate 3.2 printing is merged. The
programme's own designation for an untitled dimension (e.g. "2.3 Communication") is shown
only as a muted reference annotation, clearly separated from the printed text.

Other known source gaps, carried over and not silently fixed: the "Improvement Needed -1"
column is blank on 6 of 13 dimensions, and no "IR Evidence" row is printed for 2.1, 2.2,
the two untitled Domain 2 slots, 3.1, or Domain 3's third slot.

### Packet ratings are never guessed
The fillable packet records IR Self and Host Teacher ratings as tick marks whose position
in extracted text is detached from the dimension they belong to. They **cannot** be
attributed reliably, so the parser returns them as null and asks for manual entry.
Guessing would put a fabricated score on a TEA-reported rubric.

---

## Roster

Seeded from the *IR26 File Distributer ccisd-resident* sheet (read 2026-08-27) into
`assets/js/data/roster.js`. **TEA IDs are not carried in that sheet** — only Michelle
Izarraras's is known (from her Appendix G packet). Everyone else shows
"not on file — enter manually" rather than a fabricated number.

Known discrepancies are surfaced in the UI, not silently resolved:
- Mia Slusher and her host both report King HS; the roster says Cunningham.
- "Angelica Hecka" on the roster answers pulse checks as "Angelica Delgado".
- Zoe Garcia was reassigned after a host-teacher certification issue.
- No resident on this roster is placed at Baker MS, though it remains a valid campus.

---

## Brand

Islander Blue `#0067C5` · Islander Green `#007F3E` · Residency Black `#16181C` ·
Red `#A82D27` · Gold `#AE8439`. Fraunces for headers, Montserrat for body.
Five-band bar footer. Wave watermark bottom-right — **one per surface**, sitting in a
reserved gutter so it can never fall behind text. Both rules are checked by the
verification script rather than by eye.

## Layout

```
index.html                     app shell
assets/css/ir.css              brand system + one-page print rules
assets/img/wave.svg            watermark
assets/js/
  data/schema.js               log_observation columns — single source of truth
  data/iat.js                  13 printed IAT slots -> 12 rubric rows
  data/roster.js               residents, campuses, host teachers, TEA IDs
  data/windows.js              Appendix E walkthrough windows + auto-suggest
  time.js                      America/Chicago ISO 8601 stamping
  packet.js                    Appendix G parser (no-fabrication contract)
  guardrails.js                Step 4 blocking checks
  report-pop.js                Anchor Assessment Report + Doc export
  report-wt.js                 Walkthrough report + Doc export
  submit.js                    row build, diff, history, write adapter
  app.js                       wiring
```

## Running locally

```sh
npx serve -l 8099 .
```

Then open <http://localhost:8099/>. No build step and no dependencies — the app is
ES modules served as static files.

## Verification

The constraints above are enforced by a script rather than by eye:

```sh
npm i -D playwright && npx playwright install chromium
npx serve -l 8099 .            # in another shell
node tools/verify.mjs
```

30 checks cover the schema and IAT invariants (13 printed slots → 12 rubric rows, 3.2
merged, no invented titles, unknown columns rejected), the brand rules (one watermark per
surface, no text behind a watermark, five-band bars), the guardrails (submission blocked
until every rubric row is accounted for, confirm step required), the verbatim report
openers, and the report's structure — sections in the specified order, header fields in
the specified order, no eighth section, and a single unbroken column. Page counts are
reported for information. Exits non-zero on any failure.
