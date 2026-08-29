/*
 * Islander Assessment Tool (IAT) dimensions — Domains 1–3.
 *
 * SOURCE FIDELITY IS THE POINT OF THIS FILE.
 *
 * Appendix G (POP Cycle Post-Conference Packet) prints 13 dimension slots. Several are
 * printed WITHOUT a title, and one (3.2 Managing Student Behavior) is printed TWICE.
 * We preserve every slot exactly as printed and NEVER synthesise a missing title.
 *
 *   printedNumber  — the number as it appears in the packet, or null if none is printed
 *   printedTitle   — the title as it appears in the packet, or null if none is printed
 *   programDesignation
 *                  — what the residency programme calls this dimension in conversation.
 *                    Shown only as a muted reference annotation, clearly separated from
 *                    the printed text. It is NOT a substitute for a missing printed title
 *                    and is never written into the report as if it were the source.
 *   mergeGroup     — slots sharing a mergeGroup are one rubric row (3.2 printed twice).
 *   sourceNotes    — known gaps carried over from the source PDF. Do not silently fix.
 *
 * 13 printed slots collapse to 12 rubric rows once the duplicate 3.2 printing is merged.
 */

export const RATINGS = [
  { value: 1, label: 'Improvement Needed', short: 'Improvement Needed (1)' },
  { value: 2, label: 'Developing',         short: 'Developing (2)' },
  { value: 3, label: 'Proficient',         short: 'Proficient (3)' },
  { value: 4, label: 'Accomplished',       short: 'Accomplished (4)' },
];

export const RATING_BY_LABEL = Object.fromEntries(RATINGS.map((r) => [r.label, r]));

export const NO_EVIDENCE = 'No evidence available in this observation';

export const DOMAINS = [
  { id: 1, name: 'Planning',             sheetColumn: 'Domain 1 Score (Planning)' },
  { id: 2, name: 'Instruction',          sheetColumn: 'Domain 2 Score (Instruction)' },
  { id: 3, name: 'Learning Environment', sheetColumn: 'Domain 3 Score (Learning Env.)' },
];

/** All 13 slots exactly as Appendix G prints them, in packet order. */
export const IAT_SLOTS = [
  // ---- Domain 1: Planning — all four printed with number AND title ----
  {
    slot: 'd1s1', domain: 1, printedNumber: '1.1', printedTitle: 'Standards & Alignment',
    programDesignation: '1.1 Standards & Alignment', mergeGroup: '1.1',
    descriptor: 'The teacher designs clear, well-organized, sequential lessons that reflect best practice, align with the standards and are appropriate for diverse learners.',
    hasEvidenceRowInSource: true, sourceNotes: [],
  },
  {
    slot: 'd1s2', domain: 1, printedNumber: '1.2', printedTitle: 'Data & Assessment',
    programDesignation: '1.2 Data & Assessment', mergeGroup: '1.2',
    descriptor: 'The teacher uses formal and informal methods to measure student progress, then manages and analyzes student data to inform instruction.',
    hasEvidenceRowInSource: true, sourceNotes: [],
  },
  {
    slot: 'd1s3', domain: 1, printedNumber: '1.3', printedTitle: 'Knowledge of Students',
    programDesignation: '1.3 Knowledge of Students', mergeGroup: '1.3',
    descriptor: 'The teacher ensures high levels of learning, social-emotional development & achievement for all students.',
    hasEvidenceRowInSource: true, sourceNotes: [],
  },
  {
    slot: 'd1s4', domain: 1, printedNumber: '1.4', printedTitle: 'Activities',
    programDesignation: '1.4 Activities', mergeGroup: '1.4',
    descriptor: 'The teacher plans engaging, flexible lessons that encourage higher order thinking, persistence and achievement.',
    hasEvidenceRowInSource: true, sourceNotes: [],
  },

  // ---- Domain 2: Instruction — titles are missing throughout the packet ----
  {
    slot: 'd2s1', domain: 2, printedNumber: '2.1', printedTitle: null,
    programDesignation: '2.1', mergeGroup: '2.1',
    descriptor: 'Sets academic expectations that challenge students; persists with the lesson until there is evidence of mastery; addresses student mistakes; provides opportunities for students to take initiative in their own learning.',
    hasEvidenceRowInSource: false,
    sourceNotes: [
      'Number is printed, title is not. Preserved as printed — no title invented.',
      'No "IR Evidence" row is printed for this dimension in the source packet.',
    ],
  },
  {
    slot: 'd2s2', domain: 2, printedNumber: '2.2', printedTitle: null,
    programDesignation: '2.2', mergeGroup: '2.2',
    descriptor: 'Conveys accurate content knowledge; integrates learning objectives with other disciplines; anticipates student misunderstandings; provides opportunities for different types of thinking; draws on students’ background knowledge.',
    hasEvidenceRowInSource: false,
    sourceNotes: [
      'Number is printed, title is not. Preserved as printed — no title invented.',
      'No "IR Evidence" row is printed for this dimension in the source packet.',
    ],
  },
  {
    slot: 'd2s3', domain: 2, printedNumber: null, printedTitle: null,
    programDesignation: '2.3 Communication', mergeGroup: '2.3',
    positionLabel: 'Domain 2 — third dimension as printed', shortPosition: 'Domain 2, 3rd slot',
    descriptor: 'Establishes classroom practices for effective communication; recognises and responds to student misunderstandings; provides clear explanations; asks remember/understand/apply level questions; uses probing questions.',
    hasEvidenceRowInSource: false,
    sourceNotes: [
      'Neither number nor title is printed in this copy of the packet. Identified by position only.',
      'Some copies print this slot as "2.3". Preserved as printed — no number or title invented.',
      'No "IR Evidence" row is printed for this dimension in the source packet.',
    ],
  },
  {
    slot: 'd2s4', domain: 2, printedNumber: null, printedTitle: null,
    programDesignation: '2.4 Differentiation', mergeGroup: '2.4',
    positionLabel: 'Domain 2 — fourth dimension as printed', shortPosition: 'Domain 2, 4th slot',
    descriptor: 'Adapts lessons to address individual student needs; monitors the quality of student participation and performance; provides differentiated instructional methods and content; recognises confusion or disengagement and responds.',
    hasEvidenceRowInSource: false,
    sourceNotes: [
      'Neither number nor title is printed in this copy of the packet. Identified by position only.',
      'No "IR Evidence" row is printed for this dimension in the source packet.',
    ],
  },
  {
    slot: 'd2s5', domain: 2, printedNumber: '2.5', printedTitle: 'Monitor and Adjust',
    programDesignation: '2.5 Monitor and Adjust', mergeGroup: '2.5',
    descriptor: 'The teacher formally and informally collects, analyzes, and uses student progress data and makes needed lesson adjustments.',
    hasEvidenceRowInSource: true, sourceNotes: [],
  },

  // ---- Domain 3: Learning Environment — 3.2 is printed twice ----
  {
    slot: 'd3s1', domain: 3, printedNumber: '3.1',
    printedTitle: 'Classroom Environment, Routines, and Procedures',
    programDesignation: '3.1 Classroom Environment, Routines, and Procedures', mergeGroup: '3.1',
    descriptor: 'The teacher organizes a safe, accessible and efficient classroom.',
    hasEvidenceRowInSource: false,
    sourceNotes: ['No "IR Evidence" row is printed for this dimension in the source packet.'],
  },
  {
    slot: 'd3s2a', domain: 3, printedNumber: '3.2', printedTitle: 'Managing Student Behavior',
    programDesignation: '3.2 Managing Student Behavior', mergeGroup: '3.2',
    printingIndex: 1,
    descriptor: 'The teacher establishes, communicates and maintains clear expectations for student behavior.',
    hasEvidenceRowInSource: true,
    sourceNotes: ['First of two printings of 3.2 in the source packet. Merged into a single rubric row.'],
  },
  {
    slot: 'd3s2b', domain: 3, printedNumber: '3.2', printedTitle: 'Managing Student Behavior',
    programDesignation: '3.2 Managing Student Behavior', mergeGroup: '3.2',
    printingIndex: 2,
    descriptor: 'The teacher establishes, communicates and maintains clear expectations for student behavior.',
    hasEvidenceRowInSource: true,
    sourceNotes: ['Second of two printings of 3.2 in the source packet. Merged into a single rubric row; both evidence lines are kept when they differ.'],
  },
  {
    slot: 'd3s3', domain: 3, printedNumber: null, printedTitle: null,
    programDesignation: '3.3 Classroom Culture', mergeGroup: '3.3',
    positionLabel: 'Domain 3 — third distinct dimension as printed', shortPosition: 'Domain 3, 3rd slot',
    descriptor: 'Engages all students in relevant, meaningful learning; students work respectfully individually and in groups.',
    hasEvidenceRowInSource: false,
    sourceNotes: [
      'Neither number nor title is printed in this copy of the packet. Identified by position only.',
      'No "IR Evidence" row is printed for this dimension in the source packet.',
    ],
  },
];

/**
 * The 12 rubric rows the report renders: 13 printed slots with the duplicate 3.2
 * printing merged. Each row keeps every slot it came from so both evidence lines
 * from the two 3.2 printings survive when they differ.
 */
export const IAT_ROWS = (() => {
  const byGroup = new Map();
  for (const slot of IAT_SLOTS) {
    if (!byGroup.has(slot.mergeGroup)) {
      byGroup.set(slot.mergeGroup, {
        id: slot.mergeGroup,
        domain: slot.domain,
        printedNumber: slot.printedNumber,
        printedTitle: slot.printedTitle,
        programDesignation: slot.programDesignation,
        positionLabel: slot.positionLabel || null,
        shortPosition: slot.shortPosition || null,
        descriptor: slot.descriptor,
        slots: [],
        sourceNotes: [],
      });
    }
    const row = byGroup.get(slot.mergeGroup);
    row.slots.push(slot.slot);
    for (const n of slot.sourceNotes) if (!row.sourceNotes.includes(n)) row.sourceNotes.push(n);
  }
  return [...byGroup.values()];
})();

export const PRINTED_SLOT_COUNT = IAT_SLOTS.length;   // 13
export const RUBRIC_ROW_COUNT   = IAT_ROWS.length;    // 12

/**
 * How a dimension is labelled on screen and in the report. Uses only what the packet
 * actually prints; a slot with no printed number or title falls back to its position.
 */
export function printedLabel(row) {
  const parts = [];
  if (row.printedNumber) parts.push(row.printedNumber);
  if (row.printedTitle) parts.push(row.printedTitle);
  if (parts.length) return parts.join(' ');
  return `[no number or title printed] — ${row.positionLabel}`;
}

/**
 * Compact single-line form for the printed rubric table. Still says plainly that the
 * source prints no number or title — it just does so in one line instead of three.
 */
export function printedLabelCompact(row) {
  const parts = [];
  if (row.printedNumber) parts.push(row.printedNumber);
  if (row.printedTitle) parts.push(row.printedTitle);
  if (parts.length) return parts.join(' ');
  return `[not printed] · ${row.shortPosition || row.positionLabel}`;
}

export function rowsForDomain(domainId) {
  return IAT_ROWS.filter((r) => r.domain === domainId);
}
