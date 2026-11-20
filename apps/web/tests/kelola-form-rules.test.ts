import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  keepsAnswers as apiKeeps,
  publishProblems,
  slugProblem as apiSlugProblem,
  tidySlug as apiTidy,
  definitionProblem,
} from '../../api/src/lib/form-rules';
import { QUESTION_TYPES } from '../../api/src/lib/form-model';
import type {
  FormSection,
  ManageForm,
  ManageFormListItem,
} from '../src/api/generated';
import {
  angkatanChoices,
  answerWords,
  asksFirst,
  audienceLabel,
  canSave,
  duplicateQuestion,
  earlierChoices,
  fixRules,
  inFieldOrder,
  keepsAnswers,
  moveItem,
  newQuestion,
  nudgeFor,
  percentOf,
  previewDetail,
  publishChecks,
  repeatedOptions,
  rowCaption,
  sharedAs,
  slugProblem,
  splitForms,
  tidySlug,
  toItems,
  toSections,
  withKind,
  type QuestionItem,
} from '../src/features/kelola-form/rules';

const NOW = Date.parse('2026-10-08T13:35:00+07:00');
const ANGKATAN = [
  { year: 2022, name: 'Byte' },
  { year: 2023, name: null },
  { year: 2024, name: null },
  { year: 2025, name: 'PIXEL' },
];

const sections: FormSection[] = [
  {
    id: 's1',
    title: 'Peran',
    questions: [
      {
        id: 'p1',
        type: 'radio',
        label: 'Mau bantu di divisi apa?',
        options: ['Acara', 'Dokumentasi'],
      },
      {
        id: 'p2',
        type: 'radio',
        label: 'Bawa kamera sendiri?',
        options: ['Ya', 'Tidak'],
        dependsOn: { questionId: 'p1', value: 'Dokumentasi' },
      },
    ],
  },
  {
    id: 's2',
    title: 'Tentang kamu',
    description: 'Sedikit saja.',
    questions: [
      {
        id: 'p5',
        type: 'rating',
        label: 'Seberapa padat?',
        scale: { min: 1, max: 5, minLabel: 'Longgar', maxLabel: 'Padat' },
      },
      {
        id: 'p6',
        type: 'textarea',
        label: 'Pengalaman',
        optional: true,
        description: 'Kalau ada.',
      },
      {
        id: 'p7',
        type: 'checkbox',
        label: 'Hari',
        options: ['Jumat', 'Sabtu'],
        other: true,
      },
    ],
  },
];

test('the list and the API shape go back and forth unchanged, and the server accepts what is saved', () => {
  const items = toItems(sections);
  assert.deepEqual(
    items.map((x) => x.id),
    ['s1', 'p1', 'p2', 's2', 'p5', 'p6', 'p7'],
  );
  assert.deepEqual(toSections(items), sections);
  assert.equal(definitionProblem(toSections(items)), null);
});

test('a kind change keeps options to come back to, but only a choice sends them; a dropdown loses "Lainnya"', () => {
  const items = toItems(sections);
  const checkbox = items.find((x) => x.id === 'p7') as QuestionItem;
  const asText = withKind(checkbox, 'text');
  assert.equal(asText.options.length, 2);
  const [saved] = toSections([items[0]!, asText]);
  assert.equal(saved!.questions[0]!.options, undefined);
  assert.equal(saved!.questions[0]!.other, undefined);
  const asDropdown = withKind(checkbox, 'dropdown');
  assert.equal(asDropdown.other, false);
  const fromText = withKind({ ...asText, options: [] }, 'radio');
  assert.deepEqual(fromText.options, [{ value: 'Opsi 1' }]);
  assert.equal(definitionProblem(toSections([items[0]!, asDropdown])), null);
});

test('kinds that keep answers match the API in every pair', () => {
  for (const a of QUESTION_TYPES)
    for (const b of QUESTION_TYPES)
      assert.equal(keepsAnswers(a, b), apiKeeps(a, b), `${a} → ${b}`);
});

test('the builder asks first only on a form with answers, for a removal or a kind that loses them', () => {
  assert.equal(asksFirst(0, { kind: 'del', questionId: 'x' }), false);
  assert.equal(asksFirst(87, { kind: 'del', questionId: 'x' }), true);
  assert.equal(
    asksFirst(87, { kind: 'type', questionId: 'x', to: 'textarea' }, 'text'),
    false,
  );
  assert.equal(
    asksFirst(87, { kind: 'type', questionId: 'x', to: 'checkbox' }, 'radio'),
    false,
  );
  assert.equal(
    asksFirst(87, { kind: 'type', questionId: 'x', to: 'rating' }, 'radio'),
    true,
  );
  assert.equal(
    asksFirst(87, { kind: 'type', questionId: 'x', to: 'radio' }, 'checkbox'),
    true,
  );
});

test('"Tampilkan jika" offers only earlier choice questions and lets go of a rule a move or an edit broke', () => {
  const items = toItems(sections);
  assert.deepEqual(
    earlierChoices(items, 'p7').map((q) => q.id),
    ['p1', 'p2'],
  );
  assert.deepEqual(earlierChoices(items, 'p1'), []);
  // Moved above its deciding question.
  const moved = moveItem(items, 2, 1);
  const a = fixRules(moved);
  assert.equal(a.dropped, 1);
  assert.equal(
    (a.items.find((x) => x.id === 'p2') as QuestionItem).dependsOn,
    null,
  );
  // Its deciding option renamed away.
  const renamed = items.map((x) =>
    x.id === 'p1'
      ? {
          ...(x as QuestionItem),
          options: [{ value: 'Acara' }, { value: 'Dekorasi' }],
        }
      : x,
  );
  assert.equal(fixRules(renamed).dropped, 1);
  // The deciding question turned into text.
  const typed = items.map((x) =>
    x.id === 'p1' ? withKind(x as QuestionItem, 'text') : x,
  );
  assert.equal(fixRules(typed).dropped, 1);
  assert.equal(fixRules(items).dropped, 0);
});

test('nothing moves above the first section title', () => {
  assert.deepEqual(moveItem(['s', 'a', 'b'], 2, 0), ['s', 'b', 'a']);
  assert.deepEqual(moveItem(['s', 'a', 'b'], 1, 5), ['s', 'b', 'a']);
});

test('an option written twice is marked and holds the save, as the server would refuse it', () => {
  const q = {
    options: [{ value: 'Ya' }, { value: '' }, { value: 'Ya' }, { value: '' }],
  };
  assert.deepEqual(repeatedOptions(q), [2]);
  const items = toItems(sections);
  const twice = items.map((x) =>
    x.id === 'p1'
      ? { ...(x as QuestionItem), options: [{ value: 'A' }, { value: 'A' }] }
      : x,
  );
  assert.equal(canSave(items), true);
  assert.equal(canSave(twice), false);
  assert.match(definitionProblem(toSections(twice)) ?? '', /Option used twice/);
  // Empty options are fine while writing.
  const blank = items.map((x) =>
    x.id === 'p7'
      ? { ...(x as QuestionItem), options: [{ value: '' }, { value: '' }] }
      : x,
  );
  assert.equal(canSave(blank), true);
  assert.equal(definitionProblem(toSections(blank)), null);
});

test('a new question is Pilihan ganda with "Opsi 1"; a copy has its own id and no shared parts', () => {
  const q = newQuestion();
  assert.equal(q.type, 'radio');
  assert.deepEqual(q.options, [{ value: 'Opsi 1' }]);
  assert.equal(q.required, true);
  const c = duplicateQuestion(q);
  assert.notEqual(c.id, q.id);
  c.options[0]!.value = 'Berubah';
  assert.equal(q.options[0]!.value, 'Opsi 1');
});

test('the nudge finds what the profile already has', () => {
  assert.equal(nudgeFor('Nomor WhatsApp'), 'whatsapp');
  assert.equal(nudgeFor('No. HP aktif'), 'whatsapp');
  assert.equal(nudgeFor('Punya alergi?'), 'health');
  assert.equal(nudgeFor('Nama lengkap'), 'fullName');
  assert.equal(nudgeFor('ID LINE kamu'), 'line');
  assert.equal(nudgeFor('Kota asal'), 'hometown');
  assert.equal(nudgeFor('Upload KTM'), 'studentCardPhoto');
  assert.equal(nudgeFor('Mau bantu di divisi apa?'), null);
  assert.equal(nudgeFor('Nama panggilan untuk name tag'), 'fullName');
});

test('requested fields keep the list order whatever order they were ticked in', () => {
  assert.deepEqual(inFieldOrder(['health', 'nim', 'fullName', 'whatsapp']), [
    'fullName',
    'nim',
    'whatsapp',
    'health',
  ]);
});

test('the short name: tidied while typing, and refused for what the server refuses', () => {
  for (const v of ['Makrab 2026', 'a_b C', 'ÄB  c'])
    assert.equal(
      tidySlug(v),
      apiTidy(v).replace(/^-+|-+$/g, (m) => m),
      v,
    );
  for (const v of [
    'ab',
    'a'.repeat(41),
    'makrab_2026',
    'makrab--2026',
    '-makrab',
    'makrab-',
    'makrab-2026',
    'abc',
  ])
    assert.equal(slugProblem(v), apiSlugProblem(v), v);
});

test('Terbitkan lists what stops it in the server order, and the nudge as a note', () => {
  const form = {
    title: '',
    eligibleAngkatan: [] as number[],
    opensAt: null,
    closesAt: null,
  };
  const items = toItems([
    {
      id: 's',
      title: '',
      questions: [{ id: 'q', type: 'radio', label: '', options: ['Opsi 1'] }],
    },
  ]);
  const checks = publishChecks(form, items, ANGKATAN, NOW);
  assert.deepEqual(
    checks.map((c) => c.ok),
    [false, false, false, false],
  );
  assert.deepEqual(
    publishProblems({ ...form, sections: toSections(items) }, NOW),
    ['no_title', 'unwritten_question', 'one_option', 'no_angkatan'],
  );
  const ready = publishChecks(
    {
      title: 'Daftar panitia',
      eligibleAngkatan: [2025],
      opensAt: null,
      closesAt: '2026-10-18T23:59:00+07:00',
    },
    toItems(sections).concat(),
    ANGKATAN,
    NOW,
  );
  assert.ok(ready.every((c) => c.ok));
  assert.equal(ready[1]!.text, '5 pertanyaan, 4 wajib');
  assert.equal(ready[2]!.text, 'Untuk angkatan 2025 · PIXEL');
  const late = publishChecks(
    {
      title: 'x',
      eligibleAngkatan: [2025],
      opensAt: '2026-10-20T09:00:00+07:00',
      closesAt: '2026-10-18T23:59:00+07:00',
    },
    toItems(sections),
    ANGKATAN,
    NOW,
  );
  assert.equal(
    late.find((c) => !c.ok)?.text,
    'Tanggal tutup harus setelah tanggal buka',
  );
  const nudged = publishChecks(
    { title: 'x', eligibleAngkatan: [2025], opensAt: null, closesAt: null },
    toItems([
      {
        id: 's',
        title: '',
        questions: [{ id: 'q', type: 'text', label: 'Nomor WhatsApp' }],
      },
    ]),
    ANGKATAN,
    NOW,
  );
  assert.equal(nudged.at(-1)?.note, true);
  assert.ok(nudged.every((c) => c.ok));
});

test('the list: mine and shared by access, "Bisa edit" for whoever may edit, captions by state', () => {
  const f = (
    role: ManageFormListItem['access']['role'],
    canEdit = role !== 'view',
  ) =>
    ({
      access: { role, canEdit, canView: true, asAdmin: role === null },
    }) as Pick<ManageFormListItem, 'access'>;
  const { mine, shared } = splitForms([
    f('owner'),
    f('edit'),
    f('view'),
    f(null),
  ]);
  assert.equal(mine.length, 1);
  assert.equal(shared.length, 2);
  assert.equal(sharedAs(f('view')), 'view');
  assert.equal(sharedAs(f('view', true)), 'edit');
  const base = {
    eligibleAngkatan: [2025],
    opensAt: '2026-10-05T10:00:00+07:00',
    closesAt: '2026-10-18T23:59:00+07:00',
    questionCount: 9,
  };
  assert.equal(
    rowCaption({ ...base, status: 'open' }, ANGKATAN),
    'Angkatan 2025 · PIXEL · tutup Min, 18 Okt · 23.59',
  );
  assert.equal(
    rowCaption(
      { ...base, status: 'scheduled', opensAt: '2026-10-12T10:00:00+07:00' },
      ANGKATAN,
    ),
    'Angkatan 2025 · PIXEL · buka Sen, 12 Okt · 10.00',
  );
  assert.equal(
    rowCaption(
      { ...base, status: 'closed', closesAt: '2026-10-04T23:59:00+07:00' },
      ANGKATAN,
    ),
    'Angkatan 2025 · PIXEL · ditutup Min, 4 Okt',
  );
  assert.equal(
    rowCaption({ ...base, status: 'draft', eligibleAngkatan: [] }, ANGKATAN),
    '9 pertanyaan',
  );
  assert.equal(
    rowCaption({ ...base, status: 'open', closesAt: null }, ANGKATAN),
    'Angkatan 2025 · PIXEL · tanpa batas waktu',
  );
});

test('angkatan: the three newest and any already chosen; names as the prototype says them', () => {
  assert.deepEqual(angkatanChoices(ANGKATAN, []), [2023, 2024, 2025]);
  assert.deepEqual(angkatanChoices(ANGKATAN, [2022]), [2022, 2023, 2024, 2025]);
  assert.equal(
    audienceLabel([2025, 2023], ANGKATAN),
    'Angkatan 2023, 2025 · PIXEL',
  );
  assert.equal(audienceLabel([2025], ANGKATAN, true), 'angkatan 2025 · PIXEL');
  assert.equal(audienceLabel([], ANGKATAN), 'Belum ada angkatan');
});

test('answers as words: dates, times, scales, "Lainnya", lists; bars as whole percent', () => {
  assert.equal(
    answerWords('date', '2026-10-20', undefined),
    'Selasa, 20 Oktober 2026',
  );
  assert.equal(answerWords('time', '19:30', undefined), '19.30');
  assert.equal(answerWords('rating', '4', undefined, 5), '4 dari 5');
  assert.equal(
    answerWords('checkbox', ['Api unggun', '__other'], 'Karaoke'),
    'Api unggun, Lainnya: Karaoke',
  );
  assert.equal(percentOf(29, 87), 33);
  assert.equal(percentOf(0, 0), 0);
});

test('Pratinjau opens the form as a member would, open now with every question, whatever its state', () => {
  const draft = {
    id: 'wisuda',
    slug: 'daftar-panitia',
    slugCustom: false,
    title: '  ',
    description: 'Bantu arak-arakan.',
    sections,
    requestedFields: ['fullName', 'nim', 'whatsapp'],
    eligibleAngkatan: [],
    opensAt: null,
    closesAt: '2026-10-18T23:59:00+07:00',
    isActive: false,
    allowEdit: true,
    thanks: 'Terima kasih!',
    status: 'draft',
    publishedAt: null,
    owner: {
      id: 'u1',
      fullName: 'Raka Pratama',
      nim: '13524987',
      picture: null,
    },
    access: 'owner',
    responseCount: 0,
    audience: 0,
    createdAt: '2026-10-07T21:00:00+07:00',
    updatedAt: '2026-10-08T10:00:00+07:00',
  } as unknown as ManageForm;
  const d = previewDetail(draft);
  assert.equal(d.status, 'open');
  assert.equal(d.sections, sections);
  assert.equal(d.title, 'Form tanpa judul');
  assert.equal(d.opensAt, draft.createdAt);
  assert.equal(d.closesAt, draft.closesAt);
  assert.deepEqual(d.requestedFields, draft.requestedFields);
  // Only the maker's name, as a member sees it; and no Ubah jawaban.
  assert.deepEqual(d.owner, { fullName: 'Raka Pratama' });
  assert.equal(d.canChange, false);
  assert.equal(previewDetail({ ...draft, owner: null }).owner, null);
});
