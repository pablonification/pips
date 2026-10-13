// P2-A: Magang SPARTA's rules (src/lib/form/sparta.ts): steps, the strict check against the draft one, priorities,
// and the view from the server's window. The harness's writes (e2e/support/writes.ts) answer as the API's schemas do,
// so the requests are also checked against them.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { InternshipDepartment } from '../src/api/generated';
import { buildDb, SPARTA_WINDOW } from '../e2e/fixtures/api';
import type { MockRequest } from '../e2e/support/mock';
import * as writes from '../e2e/support/writes';
import {
  allDivisions,
  checkboxValues,
  draftOk,
  EMPTY_SPARTA,
  firstIncompleteStep,
  fromSubmission,
  moveChoice,
  spartaView,
  stepMissing,
  strictOk,
  toggleChoice,
  toRequest,
  type SpartaDraft,
} from '../src/lib/form/sparta';

const departments: InternshipDepartment[] = [
  {
    id: 'd1',
    name: 'Satu',
    order: 1,
    divisions: ['a', 'b', 'c'].map((id, i) => ({
      id,
      departmentId: 'd1',
      name: id.toUpperCase(),
      quotaMin: null,
      quotaIdeal: null,
      quotaMax: null,
      questionsRaw: null,
      description: null,
      order: i,
      questions: [
        { id: `${id}1`, label: 'Kenapa?', type: 'textarea', required: true },
        { id: `${id}2`, label: 'Portofolio', type: 'file', required: false },
      ],
    })),
  },
  {
    id: 'd2',
    name: 'Dua',
    order: 2,
    divisions: ['d', 'e'].map((id, i) => ({
      id,
      departmentId: 'd2',
      name: id.toUpperCase(),
      quotaMin: null,
      quotaIdeal: null,
      quotaMax: null,
      questionsRaw: null,
      description: null,
      order: i,
      questions: [
        {
          id: `${id}1`,
          label: 'Bidang',
          type: 'checkbox',
          options: ['X', 'Y'],
          required: true,
        },
      ],
    })),
  },
];
const divisions = allDivisions(departments);

const full: SpartaDraft = {
  kelas: 'K-01',
  idLine: 'nadia.p',
  pengalamanOrganisasi: '',
  kesibukan: [],
  choices: ['b', 'a', 'd', 'c'],
  answers: {
    a: { a1: 'Suka' },
    b: { b1: 'Ya' },
    c: { c1: 'Mau' },
    d: { d1: 'X, Y' },
  },
};

test('Info umum: Kelas and ID LINE required; an activity added needs all three parts', () => {
  assert.deepEqual(
    stepMissing('umum', EMPTY_SPARTA, divisions).map(
      (m) => 'field' in m && m.field,
    ),
    ['kelas', 'idLine'],
  );
  assert.deepEqual(
    stepMissing('umum', { ...full, kelas: '  ' }, divisions).length,
    1,
  );
  const half = {
    ...full,
    kesibukan: [{ jabatan: 'Staf', organisasi: '', periode: '2025' }],
  };
  assert.deepEqual(stepMissing('umum', half, divisions), [
    { step: 'umum', field: 'kesibukan', index: 0, part: 'organisasi' },
  ]);
  assert.deepEqual(stepMissing('umum', full, divisions), []);
  assert.deepEqual(
    stepMissing('penjelasan', EMPTY_SPARTA, divisions),
    [],
    'nothing to fill',
  );
});

test('Pilih divisi: exactly four, each once', () => {
  assert.equal(
    stepMissing('pilih', { ...full, choices: ['a', 'b', 'c'] }, divisions)
      .length,
    1,
  );
  assert.equal(
    stepMissing('pilih', { ...full, choices: ['a', 'a', 'b', 'c'] }, divisions)
      .length,
    1,
  );
  assert.equal(stepMissing('pilih', full, divisions).length, 0);
});

test('Pertanyaan divisi: required answers of the chosen divisions only', () => {
  const m = stepMissing(
    'pertanyaan',
    { ...full, answers: { ...full.answers, a: {} } },
    divisions,
  );
  assert.deepEqual(m, [
    { step: 'pertanyaan', divisionId: 'a', questionId: 'a1' },
  ]);
  // e isn't chosen: its required question doesn't count; optional files never do.
  assert.deepEqual(stepMissing('pertanyaan', full, divisions), []);
  assert.equal(firstIncompleteStep(full, divisions), -1);
  assert.equal(firstIncompleteStep({ ...full, idLine: '' }, divisions), 0);
  assert.equal(firstIncompleteStep({ ...full, choices: ['a'] }, divisions), 2);
});

test('the request: priorities 1–4 in order, answers in question order, only complete activities, trimmed', () => {
  const req = toRequest(
    {
      ...full,
      kelas: ' K-01 ',
      pengalamanOrganisasi: '  ',
      kesibukan: [
        { jabatan: 'Staf', organisasi: 'HMIF', periode: '2025/2026' },
        { jabatan: 'Ketua', organisasi: '', periode: '' },
      ],
      answers: {
        ...full.answers,
        a: { a2: 'https://r2/file.pdf', a1: 'Suka' },
        e: { e1: 'X' },
      },
    },
    divisions,
  );
  assert.equal(req.kelas, 'K-01');
  assert.equal('pengalamanOrganisasi' in req, false);
  assert.deepEqual(req.kesibukan, [
    { jabatan: 'Staf', organisasi: 'HMIF', periode: '2025/2026' },
  ]);
  assert.deepEqual(
    req.choices.map((c) => [c.divisionId, c.priorityOrder]),
    [
      ['b', 1],
      ['a', 2],
      ['d', 3],
      ['c', 4],
    ],
  );
  assert.deepEqual(req.choices[1].answers, [
    { questionId: 'a1', answer: 'Suka' },
    { questionId: 'a2', answer: 'https://r2/file.pdf' },
  ]);
  assert.equal(
    req.choices.some((c) => c.divisionId === 'e'),
    false,
    'unchosen answers stay on the device',
  );
});

test('a draft on every step passes the draft check; only a complete one passes the strict check', () => {
  const steps: SpartaDraft[] = [
    EMPTY_SPARTA,
    { ...EMPTY_SPARTA, kelas: 'K-01' },
    { ...EMPTY_SPARTA, kelas: 'K-01', idLine: 'n', choices: ['a', 'b'] },
    full,
  ];
  for (const d of steps) assert.equal(draftOk(toRequest(d, divisions)), true);
  assert.deepEqual(
    steps.map((d) => strictOk(toRequest(d, divisions))),
    [false, false, false, true],
  );
  assert.equal(strictOk(toRequest({ ...full, idLine: ' ' }, divisions)), false);
});

test('the harness (as the API) takes partial drafts, refuses a partial send, then locks', () => {
  const db = buildDb('anggota');
  db.spartaWindow = {
    opensAt: '2026-10-01T00:00:00.000Z',
    closesAt: '2026-10-31T16:59:00.000Z',
  };
  const call = (h: typeof writes.saveSpartaDraft, body: unknown) =>
    h({
      db,
      params: {},
      query: new URLSearchParams(),
      body,
    } as unknown as MockRequest);
  const status = (r: unknown) => (r as { status?: number })?.status ?? 200;
  assert.equal(
    status(
      call(
        writes.saveSpartaDraft,
        toRequest({ ...EMPTY_SPARTA, choices: ['a'] }, divisions),
      ),
    ),
    200,
  );
  assert.equal(
    status(
      call(writes.submitSparta, toRequest({ ...full, kelas: '' }, divisions)),
    ),
    400,
  );
  assert.equal(
    status(call(writes.submitSparta, toRequest(full, divisions))),
    200,
  );
  assert.equal(
    status(call(writes.saveSpartaDraft, toRequest(full, divisions))),
    409,
  );
  // Outside the window: 403, as the server since P0-D.
  db.spartaWindow = { ...SPARTA_WINDOW };
  assert.equal(
    status(call(writes.saveSpartaDraft, toRequest(full, divisions))),
    403,
  );
});

test('ticking adds last, unticking removes, a fifth isn’t added', () => {
  assert.deepEqual(toggleChoice([], 'a'), ['a']);
  assert.deepEqual(toggleChoice(['a', 'b'], 'c'), ['a', 'b', 'c']);
  assert.deepEqual(toggleChoice(['a', 'b', 'c'], 'b'), ['a', 'c']);
  assert.deepEqual(toggleChoice(['a', 'b', 'c', 'd'], 'e'), [
    'a',
    'b',
    'c',
    'd',
  ]);
});

test('moving a priority up or down one place; nothing at the ends', () => {
  const c = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveChoice(c, 2, -1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(moveChoice(c, 0, 1), ['b', 'a', 'c', 'd']);
  assert.equal(moveChoice(c, 0, -1), c);
  assert.equal(moveChoice(c, 3, 1), c);
});

test('from the saved submission: choices by priority, answers by question', () => {
  const sub = buildDb('anggota').internshipSubmissions.find(
    (s) => s.nim === '13525045',
  )!;
  const d = fromSubmission(sub);
  assert.equal(d.kelas, sub.kelas);
  assert.deepEqual(d.choices, ['div-akademik', 'div-welfare', 'div-cnc']);
  assert.deepEqual(fromSubmission(null), EMPTY_SPARTA);
});

test('the view from the server: not eligible first, then closed, not open, open', () => {
  const w = { opensAt: null, closesAt: null };
  assert.equal(
    spartaView({ ...w, status: 'open', eligible: false }),
    'not-eligible',
  );
  assert.equal(
    spartaView({ ...w, status: 'closed', eligible: true }),
    'closed',
  );
  assert.equal(
    spartaView({ ...w, status: 'not_opened', eligible: true }),
    'not-open',
  );
  assert.equal(spartaView({ ...w, status: 'open', eligible: true }), 'open');
});

test('checkbox answers are one string, as today’s screen stores them', () => {
  assert.deepEqual(checkboxValues('X, Y'), ['X', 'Y']);
  assert.deepEqual(checkboxValues(''), []);
  assert.deepEqual(checkboxValues(undefined), []);
});
