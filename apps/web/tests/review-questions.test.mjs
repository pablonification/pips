// The questions extractor (e2e/scripts/lib/review/questions.mjs) on sample Markdown: items from "Open questions",
// "Open questions (defaults built)", "Deviations", "Needs Dev 1", "New copy", "New strings", "Choices to check" and
// "… for the owner" sections, at any heading level or as a bold lead-in (paragraph or list item), with tables;
// OPEN-QUESTIONS.md's tables with their decisions; PLAN.md's logged decisions; duplicates merged, sources kept.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQuestions,
  decisionOf,
  extractItems,
  kindOf,
  logDecisions,
  parseOpenQuestions,
  whoDecides,
} from '../e2e/scripts/lib/review/questions.mjs';

const REPORT = `# P9-Z report

## Done
- Not a question.

## Deviations from the prototype or SPEC
- **Titles are \`h1\`,** not the prototype's \`h2\`.
- The tab bar is the prototype's height
  (about 80 px), not SPEC's.
  - a nested detail
- **New copy, not in the prototype:**
  - the skip link "Langsung ke isi halaman";
  - the document titles.

**Open questions' defaults** (OPEN-QUESTIONS D8; for the owner in F1):
1. **Data SPARTA Magang has no design:** today's features.
2. Rekap Form has a Semua link.

Some paragraph that ends the list.

**New copy** (src/copy/kelola.ts):
- Forms: "Memuat form…"

#### Choices to check
| Choice | Default |
| --- | --- |
| Cap on rooms | 3 |

### Seen while testing, for the owner
- The toast overlaps the field.

## Needs Dev 1
1. Apply migration 0028.

## New strings (for the owner's review)
- "Sedang dibuka"

## Open questions (defaults built)
- Kelola on phones. **Decided by Dev 1 2026-10-13: keep the prototype.**

\`\`\`
## Deviations
- inside a code fence, not an item
\`\`\`
`;

test('section titles name their kind', () => {
  assert.equal(kindOf('Deviations added in round 2'), 'deviation');
  assert.equal(kindOf('New copy (no prototype wording)'), 'new-copy');
  assert.equal(kindOf('New strings'), 'new-copy');
  assert.equal(kindOf('Needs Dev 1 (round 2)'), 'needs-dev1');
  assert.equal(kindOf('Choices to check'), 'choice');
  assert.equal(kindOf('Open questions for the owner'), 'open-question');
  assert.equal(kindOf('Seen while testing, for the owner'), 'for-owner');
  assert.equal(kindOf('Still open'), 'open-question');
  assert.equal(kindOf('Done'), null);
});

test('every item, at any heading level or after a bold lead-in, and nothing else', () => {
  const items = extractItems(REPORT, 'reports/P9-Z.md');
  const by = (k) => items.filter((i) => i.kind === k).map((i) => i.text);
  assert.deepEqual(by('deviation'), [
    "Titles are h1, not the prototype's h2.",
    "The tab bar is the prototype's height (about 80 px), not SPEC's.; a nested detail",
  ]);
  assert.deepEqual(by('new-copy'), [
    'the skip link "Langsung ke isi halaman";',
    'the document titles.',
    'Forms: "Memuat form…"',
    '"Sedang dibuka"',
  ]);
  assert.deepEqual(by('open-question'), [
    "Data SPARTA Magang has no design: today's features.",
    'Rekap Form has a Semua link.',
    'Kelola on phones. Decided by Dev 1 2026-10-13: keep the prototype.',
  ]);
  assert.deepEqual(by('choice'), ['Cap on rooms · 3']);
  assert.deepEqual(by('for-owner'), ['The toast overlaps the field.']);
  assert.deepEqual(by('needs-dev1'), ['Apply migration 0028.']);
  assert.ok(!items.some((i) => /Not a question|code fence/.test(i.text)));
  assert.equal(items.find((i) => i.text.startsWith('Forms'))?.source.line, 22);
});

const OQ = `# Open questions

## Design

| # | Question | Default being built | From |
| --- | --- | --- | --- |
| D1 | Kelola on phones? | The prototype | P0-C |
| D2 | First run has no design. | **Decided 2026-10-13: build it** ("just make it good") | P1-C |

## Found in today's code, not changed

| # | Finding | From |
| --- | --- | --- |
| C3 | **Curhat privacy hole, in production too.** | P2-C |

## For HMIF

- Who runs HMIF's Dokploy?
- HMIF Welfare: Curhat's privacy wording and crisis contacts.
`;

test('OPEN-QUESTIONS: ids, defaults, decisions, findings and the HMIF list', () => {
  const q = parseOpenQuestions(OQ);
  assert.deepEqual(
    q.map((x) => x.id),
    ['D1', 'D2', 'C3', null, null],
  );
  assert.equal(q[0].built, 'The prototype');
  assert.equal(q[0].decided, null);
  assert.deepEqual(q[1].decided, {
    by: 'the owner',
    date: '2026-10-13',
    what: 'build it ("just make it good")',
  });
  assert.equal(q[2].kind, 'found');
  assert.equal(whoDecides(q[3]), 'HMIF');
  assert.equal(whoDecides(q[4]), 'HMIF Welfare');
  assert.equal(
    decisionOf('Decided by Dev 1 2026-10-13 (review of P2-C, M2): fix it.').by,
    'Dev 1',
  );
});

const PLAN = `# Plan

## Log

- 2026-10-12: the owner chose to host the monorepo on their own account first.
- 2026-10-13 15:30: P1-A's fix round passed. Decision (P1-A review m8): Beranda's mark blinks four times.
  It keeps the prototype's rule.
- 2026-10-13 16:00: CI ran.
`;

test('the log’s decisions, with their dates and continuation lines', () => {
  const d = logDecisions(PLAN);
  assert.equal(d.length, 2);
  assert.equal(d[1].date, '2026-10-13');
  assert.match(d[1].text, /It keeps the prototype's rule\.$/);
});

test('duplicates merge with every source kept; groups by who decides; security tagged', () => {
  const same = '## Needs Dev 1\n- Apply migration 0028.\n';
  const q = buildQuestions({
    openQuestions: OQ,
    plan: PLAN,
    files: [
      { path: 'reports/A.md', text: same },
      { path: 'reports/B.md', text: same.replace('0028.', '0028') },
    ],
    findings: [
      {
        id: 'F1-9',
        title: 'A bug',
        detail: 'Seen.',
        owner: 'P1-A',
        flows: ['beranda'],
      },
    ],
  });
  const all = q.groups.flatMap((g) => g.items);
  const mig = all.filter((i) => i.question.startsWith('Apply migration'));
  assert.equal(mig.length, 1);
  assert.deepEqual(
    mig[0].sources.map((s) => s.file),
    ['reports/A.md', 'reports/B.md'],
  );
  assert.deepEqual(
    q.groups.map((g) => g.who),
    ['the owner', 'HMIF', 'HMIF Welfare', 'Dev 1'],
  );
  assert.deepEqual(all.find((i) => i.id === 'C3').tags, ['security']);
  assert.equal(all.find((i) => i.id === 'D2').status, 'decided');
  assert.equal(all.find((i) => i.id === 'F1-9').who, 'Dev 1');
  assert.equal(q.total, all.length);
});
