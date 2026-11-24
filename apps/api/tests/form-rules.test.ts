// The form builder's rules with no database: answers and conditions, the definition, publishing, breaking edits,
// short names, access, saved details, the summary and the export.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  findInvalidAnswer,
  findMissingRequiredQuestions,
  keepVisibleAnswers,
  visibleQuestions,
} from '../src/lib/form-answers';
import {
  OTHER_ANSWER,
  fileName,
  storedFileCheck,
  type FormSection,
} from '../src/lib/form-model';
import {
  definitionProblem,
  dropLostAnswers,
  findBreakingChanges,
  formAccess,
  keepsAnswers,
  manageStatus,
  numberedSlug,
  publishProblems,
  slugFromTitle,
  slugProblem,
  tidySlug,
} from '../src/lib/form-rules';
import {
  exportTable,
  safeCell,
  summarize,
  toCsv,
} from '../src/lib/form-summary';
import { toXlsx } from '../src/lib/form-xlsx';
import {
  EMPTY_DETAILS,
  birthDateOk,
  detailsProblems,
  fieldValue,
  missingFields,
  phoneOk,
  profileSnapshot,
  tidyChange,
} from '../src/lib/member-details';

const STORE = 'https://media.example.com';
const stored = storedFileCheck((url) => url.startsWith(`${STORE}/`));

/** The prototype's Daftar Makrab, cut down: every kind of question, a condition and "Lainnya". */
const makrab: FormSection[] = [
  {
    id: 's1',
    title: 'Kehadiran',
    questions: [
      {
        id: 'k1',
        label: 'Bisa ikut dua hari penuh?',
        type: 'radio',
        options: ['Ya, dua hari penuh', 'Menyusul Sabtu malam', 'Belum pasti'],
      },
      {
        id: 'k2',
        label: 'Kira-kira sampai jam berapa?',
        type: 'time',
        dependsOn: { questionId: 'k1', value: 'Menyusul Sabtu malam' },
      },
      {
        id: 'k3',
        label: 'Berangkat dari mana?',
        type: 'dropdown',
        options: ['Ganesha', 'Jatinangor', 'Langsung ke lokasi'],
      },
    ],
  },
  {
    id: 's2',
    title: 'Selama acara',
    questions: [
      { id: 'k4', label: 'Nama panggilan', type: 'text' },
      {
        id: 'k5',
        label: 'Mau ikut kegiatan apa saja?',
        type: 'checkbox',
        options: ['Api unggun', 'Games angkatan'],
        other: true,
      },
      {
        id: 'k6',
        label: 'Seberapa semangat?',
        type: 'rating',
        scale: {
          min: 1,
          max: 5,
          minLabel: 'Biasa aja',
          maxLabel: 'Nggak sabar',
        },
      },
      { id: 'k7', label: 'Bukti transfer', type: 'file' },
      { id: 'k8', label: 'Ambil gelang tanggal berapa?', type: 'date' },
      {
        id: 'k9',
        label: 'Ada yang perlu panitia tahu?',
        type: 'textarea',
        optional: true,
      },
    ],
  },
];

const complete = [
  { questionId: 'k1', answer: 'Ya, dua hari penuh' },
  { questionId: 'k3', answer: 'Ganesha' },
  { questionId: 'k4', answer: 'Nad' },
  { questionId: 'k5', answer: ['Api unggun', OTHER_ANSWER], other: 'Karaoke' },
  { questionId: 'k6', answer: '5' },
  { questionId: 'k7', answer: `${STORE}/abc123-bukti.pdf` },
  { questionId: 'k8', answer: '2026-10-20' },
];
const check = (answers: typeof complete) =>
  findInvalidAnswer(makrab, answers, { maxText: 100, isStoredFile: stored });

test('every kind of answer that fits is taken', () => {
  assert.equal(check(complete), null);
  assert.deepEqual(findMissingRequiredQuestions(makrab, complete), []);
});

test('answers that do not fit their question are refused', () => {
  const bad: Array<[string, unknown]> = [
    ['k1', 'Mungkin'],
    ['k1', ['Ya, dua hari penuh']],
    ['k3', OTHER_ANSWER], // a dropdown offers no "Lainnya"
    ['k5', ['Api unggun', 'Api unggun']],
    ['k5', 'Api unggun'],
    ['k6', '6'],
    ['k6', '0'],
    ['k7', 'https://evil.example.com/x.pdf'],
    ['k7', `${STORE}/abc-x.exe`],
    ['k8', '2026-02-30'],
    ['k8', '20-10-2026'],
    ['k2', '24:00'],
    ['k2', '19.30'],
    ['k4', 'x'.repeat(101)],
    ['zz', 'unknown'],
  ];
  for (const [questionId, answer] of bad) {
    const answers = [
      ...complete.filter((a) => a.questionId !== questionId),
      { questionId, answer },
    ] as typeof complete;
    assert.notEqual(
      check(answers),
      null,
      `${questionId} ${JSON.stringify(answer)}`,
    );
  }
  assert.match(
    check([...complete, { questionId: 'k1', answer: 'Belum pasti' }])!,
    /twice/,
  );
});

test('"Lainnya" needs its words, and only where it was chosen', () => {
  const withK5 = (a: (typeof complete)[number]) => [
    ...complete.filter((x) => x.questionId !== 'k5'),
    a,
  ];
  assert.match(
    check(withK5({ questionId: 'k5', answer: [OTHER_ANSWER], other: ' ' }))!,
    /Lainnya/,
  );
  assert.match(
    check(withK5({ questionId: 'k5', answer: ['Api unggun'], other: 'x' }))!,
    /Lainnya/,
  );
  assert.equal(
    check(
      withK5({ questionId: 'k5', answer: [OTHER_ANSWER], other: 'Main musik' }),
    ),
    null,
  );
});

test('a conditional question shows, and is required, only when its source has the value', () => {
  const ids = (answers: typeof complete) =>
    visibleQuestions(makrab, answers).map((q) => q.id);
  assert.equal(ids(complete).includes('k2'), false);
  const later = [
    ...complete.filter((a) => a.questionId !== 'k1'),
    { questionId: 'k1', answer: 'Menyusul Sabtu malam' },
  ];
  assert.equal(ids(later).includes('k2'), true);
  assert.deepEqual(findMissingRequiredQuestions(makrab, later), [
    'Kira-kira sampai jam berapa?',
  ]);
  // An answer left behind by a changed choice is not kept.
  const stale = [...complete, { questionId: 'k2', answer: '21:00' }];
  assert.equal(
    keepVisibleAnswers(makrab, stale).some((a) => a.questionId === 'k2'),
    false,
  );
});

test('a condition on a hidden question hides its follower too', () => {
  const chain: FormSection[] = [
    {
      id: 's',
      title: '',
      questions: [
        { id: 'a', label: 'A', type: 'radio', options: ['x', 'y'] },
        {
          id: 'b',
          label: 'B',
          type: 'radio',
          options: ['p', 'q'],
          dependsOn: { questionId: 'a', value: 'x' },
        },
        {
          id: 'c',
          label: 'C',
          type: 'text',
          dependsOn: { questionId: 'b', value: 'p' },
        },
      ],
    },
  ];
  // b was answered while a said x, then a changed: c must not show.
  const answers = [
    { questionId: 'a', answer: 'y' },
    { questionId: 'b', answer: 'p' },
  ];
  assert.deepEqual(
    visibleQuestions(chain, answers).map((q) => q.id),
    ['a'],
  );
  assert.deepEqual(findMissingRequiredQuestions(chain, answers), []);
});

test('required answers: blank text, an empty list and an unanswered choice are missing', () => {
  const missing = findMissingRequiredQuestions(makrab, [
    { questionId: 'k1', answer: 'Belum pasti' },
    { questionId: 'k4', answer: '  ' },
    { questionId: 'k5', answer: [] },
  ]);
  assert.deepEqual(missing, [
    'Berangkat dari mana?',
    'Nama panggilan',
    'Mau ikut kegiatan apa saja?',
    'Seberapa semangat?',
    'Bukti transfer',
    'Ambil gelang tanggal berapa?',
  ]);
});

test('a definition: kinds, options, scales and conditions are checked on every save', () => {
  assert.equal(definitionProblem(makrab), null);
  const one = (q: object) =>
    [
      {
        id: 's',
        title: '',
        questions: [
          { id: 'x', label: 'X', type: 'radio', options: ['a', 'b'] },
          q,
        ],
      },
    ] as FormSection[];
  const cases: Array<[object, RegExp]> = [
    [{ id: 'x', label: 'dup', type: 'text' }, /twice/],
    [{ id: 'y', label: 'Y', type: 'text', options: ['a'] }, /Options/],
    [
      { id: 'y', label: 'Y', type: 'dropdown', options: ['a'], other: true },
      /Lainnya/,
    ],
    [
      { id: 'y', label: 'Y', type: 'radio', options: [OTHER_ANSWER] },
      /reserved/,
    ],
    [{ id: 'y', label: 'Y', type: 'radio', options: ['a', 'a'] }, /twice/],
    [
      { id: 'y', label: 'Y', type: 'rating', scale: { min: 2, max: 5 } },
      /range/,
    ],
    [
      { id: 'y', label: 'Y', type: 'rating', scale: { min: 1, max: 11 } },
      /range/,
    ],
    [{ id: 'y', label: 'Y', type: 'text', scale: { min: 1, max: 5 } }, /Scale/],
    [
      {
        id: 'y',
        label: 'Y',
        type: 'text',
        dependsOn: { questionId: 'x', value: 'c' },
      },
      /options/,
    ],
    [
      {
        id: 'y',
        label: 'Y',
        type: 'text',
        dependsOn: { questionId: 'z', value: 'a' },
      },
      /earlier/,
    ],
    [{ id: 'y', label: 'Y', type: 'sketch' }, /kind/],
  ];
  for (const [q, re] of cases)
    assert.match(definitionProblem(one(q)) ?? '', re, JSON.stringify(q));
  // A condition on a later question is refused: it must come first.
  const later: FormSection[] = [
    {
      id: 's',
      title: '',
      questions: [
        {
          id: 'y',
          label: 'Y',
          type: 'text',
          dependsOn: { questionId: 'x', value: 'a' },
        },
        { id: 'x', label: 'X', type: 'radio', options: ['a', 'b'] },
      ],
    },
  ];
  assert.match(definitionProblem(later)!, /earlier/);
  // Still typing: an empty label and a single option may be saved.
  assert.equal(
    definitionProblem(
      one({ id: 'y', label: '', type: 'radio', options: ['Opsi 1'] }),
    ),
    null,
  );
  assert.match(definitionProblem([])!, /section/);
});

test('publishing needs a title, written questions, two options, an angkatan, and a sensible closing time', () => {
  const now = new Date('2026-10-08T06:35:00Z');
  const ready = {
    title: 'Daftar Makrab',
    sections: makrab,
    eligibleAngkatan: [2025],
    opensAt: null,
    closesAt: '2026-10-18T16:59:00Z',
  };
  assert.deepEqual(publishProblems(ready, now), []);
  assert.deepEqual(
    publishProblems(
      {
        title: ' ',
        sections: [
          {
            id: 's',
            title: '',
            questions: [
              { id: 'q', label: '', type: 'radio', options: ['Opsi 1', ' '] },
            ],
          },
        ],
        eligibleAngkatan: [],
        opensAt: '2026-10-20T00:00:00Z',
        closesAt: '2026-10-19T00:00:00Z',
      },
      now,
    ),
    [
      'no_title',
      'unwritten_question',
      'one_option',
      'no_angkatan',
      'closes_before_opening',
    ],
  );
  assert.deepEqual(
    publishProblems(
      { ...ready, sections: [{ id: 's', title: '', questions: [] }] },
      now,
    ),
    ['no_questions'],
  );
  assert.deepEqual(
    publishProblems({ ...ready, closesAt: '2026-10-01T00:00:00Z' }, now),
    ['already_closed'],
  );
});

test('breaking edits: a question removed, or a kind that cannot read the old answers', () => {
  const after: FormSection[] = structuredClone(makrab);
  after[0].questions[2].type = 'radio'; // dropdown → radio keeps answers
  after[1].questions[0].type = 'textarea'; // text → paragraph keeps answers
  after[1].questions[2].type = 'text'; // scale → text loses them
  after[1].questions[1].label = 'Kegiatan?'; // wording: nothing lost
  after[1].questions[1].options = ['Api unggun']; // an option removed: old answers kept
  after[1].questions.splice(4, 1); // the date question removed
  assert.deepEqual(findBreakingChanges(makrab, after), [
    { questionId: 'k6', label: 'Seberapa semangat?', change: 'type' },
    {
      questionId: 'k8',
      label: 'Ambil gelang tanggal berapa?',
      change: 'removed',
    },
  ]);
  assert.deepEqual(findBreakingChanges(makrab, structuredClone(makrab)), []);
  assert.deepEqual(
    dropLostAnswers(complete, findBreakingChanges(makrab, after)).map(
      (a) => a.questionId,
    ),
    ['k1', 'k3', 'k4', 'k5', 'k7'],
  );
});

test('kinds that keep answers, as the prototype lists them', () => {
  assert.equal(keepsAnswers('text', 'textarea'), true);
  assert.equal(keepsAnswers('textarea', 'text'), true);
  assert.equal(keepsAnswers('radio', 'dropdown'), true);
  assert.equal(keepsAnswers('dropdown', 'radio'), true);
  assert.equal(keepsAnswers('radio', 'checkbox'), true);
  assert.equal(keepsAnswers('dropdown', 'checkbox'), true);
  assert.equal(keepsAnswers('checkbox', 'radio'), false);
  assert.equal(keepsAnswers('text', 'radio'), false);
  assert.equal(keepsAnswers('date', 'time'), false);
});

test('short names follow the one rule shared with short links: letters, digits and hyphens, 3 to 50', () => {
  assert.equal(tidySlug(' Makrab 2026  Seru '), 'Makrab-2026-Seru');
  assert.equal(slugProblem('ab'), 'too_short');
  assert.equal(slugProblem('a'.repeat(50)), null);
  assert.equal(slugProblem('a'.repeat(51)), 'too_long');
  assert.equal(slugProblem('makrab!'), 'characters');
  assert.equal(slugProblem('makrab_2026'), 'characters');
  // The field says what is wrong first: a character it can't have, before the length.
  assert.equal(slugProblem('a!'), 'characters');
  assert.equal(slugProblem('-makrab'), 'hyphens');
  assert.equal(slugProblem('makrab-'), 'hyphens');
  assert.equal(slugProblem('mak--rab'), 'hyphens');
  assert.equal(slugProblem('makrab-2026'), null);
  assert.equal(slugProblem('BayarKasHMIF'), null);
  assert.equal(
    slugFromTitle('Daftar panitia Wisuda Oktober'),
    'daftar-panitia-wisuda-oktober',
  );
  assert.equal(
    slugFromTitle('Évaluasi: tengah periode!'),
    'evaluasi-tengah-periode',
  );
  assert.equal(slugFromTitle(''), 'form-baru');
  assert.equal(slugFromTitle('Ab'), 'form-baru');
  const long = slugFromTitle('Survei '.repeat(10));
  assert.equal(slugProblem(long), null);
  assert.equal(numberedSlug('makrab', 1), 'makrab');
  assert.equal(numberedSlug('makrab', 2), 'makrab-2');
  const cut = numberedSlug(`${'a'.repeat(48)}-b`, 12);
  assert.equal(cut.length <= 50 && slugProblem(cut) === null, true, cut);
});

test('access: owner and Edit edit, Lihat jawaban sees, admin edits every form and is told whose it is', () => {
  assert.deepEqual(formAccess('owner', false), {
    role: 'owner',
    canView: true,
    canEdit: true,
    asAdmin: false,
  });
  assert.deepEqual(formAccess('edit', false), {
    role: 'edit',
    canView: true,
    canEdit: true,
    asAdmin: false,
  });
  assert.deepEqual(formAccess('view', false), {
    role: 'view',
    canView: true,
    canEdit: false,
    asAdmin: false,
  });
  assert.deepEqual(formAccess(null, false), {
    role: null,
    canView: false,
    canEdit: false,
    asAdmin: false,
  });
  assert.deepEqual(formAccess(null, true), {
    role: null,
    canView: true,
    canEdit: true,
    asAdmin: true,
  });
  assert.deepEqual(formAccess('view', true), {
    role: 'view',
    canView: true,
    canEdit: true,
    asAdmin: true,
  });
  assert.equal(formAccess('owner', true).asAdmin, false);
});

test('a form’s state in Kelola: draft, scheduled, open, closed', () => {
  const now = new Date('2026-10-08T06:35:00Z');
  const f = { publishedAt: now, opensAt: now, closesAt: null, isActive: true };
  assert.equal(manageStatus({ ...f, publishedAt: null }, now), 'draft');
  assert.equal(
    manageStatus({ ...f, opensAt: new Date('2026-10-09T00:00:00Z') }, now),
    'scheduled',
  );
  assert.equal(manageStatus(f, now), 'open');
  assert.equal(manageStatus({ ...f, closesAt: now }, now), 'closed');
  assert.equal(manageStatus({ ...f, isActive: false }, now), 'closed');
});

const nadia = {
  fullName: 'Nadia Putri',
  nim: '13525945',
  major: 'IF' as const,
  angkatan: 2025,
  region: 'Ganesha' as const,
  email: '13525945@std.stei.itb.ac.id',
};

test('saved details: phone, date and photo rules, as the prototype says them', () => {
  assert.equal(phoneOk('0812-5550-0945'), true);
  assert.equal(phoneOk('+62 812 5550 0945'), true);
  assert.equal(phoneOk('0812555'), false);
  assert.equal(phoneOk('0812-5550-09ab'), false);
  assert.equal(birthDateOk('2007-03-14', '2026-10-08'), true);
  assert.equal(birthDateOk('2007-02-30', '2026-10-08'), false);
  assert.equal(birthDateOk('2027-01-01', '2026-10-08'), false);
  assert.equal(birthDateOk('1950-01-01', '2026-10-08'), false);
  const problems = detailsProblems(
    {
      whatsapp: '0812',
      line: ' ',
      birthDate: '2007-13-01',
      photo: `${STORE}/x-foto.pdf`,
      studentCardPhoto: 'https://elsewhere.example.com/x-ktm.jpg',
      emergencyContact: { name: 'Ratna', relation: 'Ibu', phone: '08' },
      health: null,
    },
    { today: '2026-10-08', isStoredFile: stored },
  );
  assert.deepEqual(problems, {
    whatsapp: 'phone',
    line: 'empty',
    birthDate: 'date',
    photo: 'file',
    studentCardPhoto: 'file',
    emergencyContact: 'phone',
  });
  assert.deepEqual(
    detailsProblems(
      { photo: `${STORE}/x-foto.png`, address: 'Kos Cisitu' },
      { today: '2026-10-08', isStoredFile: stored },
    ),
    {},
  );
  assert.deepEqual(tidyChange({ line: '  nadia.id ', health: null }), {
    line: 'nadia.id',
    health: null,
  });
});

test('the requested fields: account facts in words, saved details as given, what is missing', () => {
  const saved = {
    ...EMPTY_DETAILS,
    whatsapp: '0812-5550-0945',
    emergencyContact: {
      name: 'Ratna Dewi',
      relation: 'Ibu' as const,
      phone: '0813-5550-0911',
    },
  };
  assert.equal(fieldValue('major', nadia, saved), 'Teknik Informatika');
  assert.equal(fieldValue('angkatan', nadia, saved), '2025');
  assert.equal(fieldValue('campus', nadia, saved), 'Ganesha');
  assert.equal(
    fieldValue('emergencyContact', nadia, saved),
    'Ratna Dewi (ibu) · 0813-5550-0911',
  );
  assert.deepEqual(
    missingFields(
      ['fullName', 'nim', 'whatsapp', 'emergencyContact', 'health'],
      nadia,
      saved,
    ),
    ['health'],
  );
  assert.deepEqual(
    profileSnapshot(['nim', 'whatsapp', 'health'], nadia, saved),
    {
      nim: '13525945',
      whatsapp: '0812-5550-0945',
    },
  );
});

const responses = [
  {
    submittedAt: new Date('2026-10-06T02:00:00Z'),
    updatedAt: null,
    profile: { fullName: 'Nadia Putri', nim: '13525945' },
    answers: complete,
  },
  {
    submittedAt: new Date('2026-10-07T02:00:00Z'),
    updatedAt: new Date('2026-10-07T05:00:00Z'),
    profile: { fullName: 'Bima Santoso', nim: '13525971' },
    answers: [
      { questionId: 'k1', answer: 'Menyusul Sabtu malam' },
      { questionId: 'k2', answer: '21:00' },
      { questionId: 'k3', answer: 'Jatinangor' },
      { questionId: 'k4', answer: '=HYPERLINK("x")' },
      { questionId: 'k5', answer: ['Games angkatan'] },
      { questionId: 'k6', answer: '4' },
      { questionId: 'k7', answer: `${STORE}/def456-transfer-bima.jpg` },
      { questionId: 'k8', answer: '2026-10-20' },
    ],
  },
];

test('the summary counts every option in order, scales with their mean, texts newest first', () => {
  const s = summarize(makrab, responses);
  assert.equal(s.total, 2);
  const by = (id: string) => s.questions.find((q) => q.questionId === id)!;
  assert.deepEqual(by('k1').counts, [
    { value: 'Ya, dua hari penuh', count: 1 },
    { value: 'Menyusul Sabtu malam', count: 1 },
    { value: 'Belum pasti', count: 0 },
  ]);
  assert.deepEqual(by('k5').counts, [
    { value: 'Api unggun', count: 1 },
    { value: 'Games angkatan', count: 1 },
    { value: OTHER_ANSWER, count: 1 },
  ]);
  assert.deepEqual(by('k5').texts, ['Karaoke']);
  assert.deepEqual(
    by('k6').counts?.map((c) => c.count),
    [0, 0, 0, 1, 1],
  );
  assert.equal(by('k6').average, 4.5);
  assert.deepEqual(by('k4').texts, ['=HYPERLINK("x")', 'Nad']);
  assert.deepEqual(by('k7').files, [
    { url: `${STORE}/def456-transfer-bima.jpg`, name: 'transfer-bima.jpg' },
    { url: `${STORE}/abc123-bukti.pdf`, name: 'bukti.pdf' },
  ]);
  assert.deepEqual(by('k8').counts, [{ value: '2026-10-20', count: 2 }]);
  assert.equal(by('k2').answered, 1);
  assert.equal(by('k9').answered, 0);
  assert.equal(
    fileName(`${STORE}/abc123-bukti-transfer.pdf`),
    'bukti-transfer.pdf',
  );
});

test('an answer to an option since removed still counts, under its own words', () => {
  const fewer = structuredClone(makrab);
  fewer[0].questions[0].options = ['Ya, dua hari penuh', 'Belum pasti'];
  const k1 = summarize(fewer, responses).questions[0];
  assert.deepEqual(k1.counts, [
    { value: 'Ya, dua hari penuh', count: 1 },
    { value: 'Belum pasti', count: 0 },
    { value: 'Menyusul Sabtu malam', count: 1 },
  ]);
});

test('the export: one row per response, oldest first, requested fields then questions', async () => {
  const t = exportTable(
    { sections: makrab, requestedFields: ['fullName', 'nim'] },
    [...responses].reverse(),
  );
  assert.deepEqual(t.header.slice(0, 6), [
    'Waktu kirim',
    'Diubah',
    'Nama',
    'NIM',
    'Bisa ikut dua hari penuh?',
    'Kira-kira sampai jam berapa?',
  ]);
  assert.equal(t.header.length, 4 + 9);
  assert.deepEqual(t.rows[0].slice(2, 6), [
    'Nadia Putri',
    '13525945',
    'Ya, dua hari penuh',
    null,
  ]);
  assert.equal(t.rows[0][1], null);
  assert.deepEqual(t.rows[0][8], 'Api unggun, Lainnya: Karaoke');
  assert.equal(t.rows[0][9], 5);
  assert.deepEqual(t.rows[1][5], '21:00');
  // A field an older response carries stays as a column after the maker unticks it.
  const unticked = exportTable(
    { sections: makrab, requestedFields: [] },
    responses,
  );
  assert.deepEqual(unticked.header.slice(2, 4), ['Nama', 'NIM']);

  const csv = toCsv(t);
  assert.equal(csv.startsWith('\uFEFFWaktu kirim,Diubah,Nama,NIM'), true);
  assert.match(csv, /2026-10-06 09\.00/);
  // A cell a spreadsheet would run as a formula is written as text.
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.equal(safeCell('-1'), "'-1");
  assert.equal(safeCell('Nad'), 'Nad');

  const xlsx = await toXlsx(t);
  assert.equal(xlsx.subarray(0, 2).toString(), 'PK');
});
