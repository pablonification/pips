import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  findInvalidAnswer,
  findMissingRequiredQuestions,
  visibleQuestions,
} from '../../api/src/lib/form-answers';
import {
  fileName as apiFileName,
  PROFILE_FIELDS,
} from '../../api/src/lib/form-model';
import {
  birthDateOk,
  fieldValue,
  phoneOk as apiPhoneOk,
} from '../../api/src/lib/member-details';
import type { FormSection, MyDetails } from '../src/api/generated';
import {
  answersToSend,
  answerText,
  birthDateText,
  birthDateToSend,
  detailToSend,
  draftFromSaved,
  draftOf,
  FIELDS,
  fieldText,
  fileFits,
  fileName,
  filledCount,
  isAnswered,
  missingRequired,
  OTHER,
  phoneOk,
  rowState,
  SAVED,
  shownIds,
  sortRows,
  startingValues,
  tidyDate,
  tidyTime,
  timeToSend,
  untilText,
  valuesOfDraft,
  whenShort,
  type FillValues,
} from '../src/features/form/rules';
import {
  answersSchema,
  fieldKeys,
  toFields,
  toFill,
} from '../src/features/form/schema';

/** Daftar Makrab's questions, the prototype's sample: a condition, "Lainnya", every kind. */
const SECTIONS: FormSection[] = [
  {
    id: 's1',
    title: 'Kehadiran',
    questions: [
      {
        id: 'k1',
        label: 'Bisa ikut?',
        type: 'radio',
        options: ['Ya', 'Menyusul', 'Belum'],
      },
      {
        id: 'k2',
        label: 'Jam berapa?',
        type: 'time',
        dependsOn: { questionId: 'k1', value: 'Menyusul' },
      },
      {
        id: 'k3',
        label: 'Dari mana?',
        type: 'dropdown',
        options: ['Ganesha', 'Jatinangor'],
      },
    ],
  },
  {
    id: 's2',
    title: 'Selama acara',
    questions: [
      {
        id: 'k5',
        label: 'Kegiatan?',
        type: 'checkbox',
        options: ['Api unggun', 'Games'],
        other: true,
      },
      {
        id: 'k6',
        label: 'Semangat?',
        type: 'rating',
        scale: { min: 1, max: 5 },
      },
      { id: 'k7', label: 'Bukti', type: 'file' },
      { id: 'k8', label: 'Tanggal?', type: 'date' },
      { id: 'k9', label: 'Catatan', type: 'textarea', optional: true },
    ],
  },
];

const empty = (): FillValues => startingValues(SECTIONS);
const asAnswers = (v: FillValues) =>
  answersToSend(SECTIONS, v).map((a) => ({ ...a }));

test('a question shows as the API decides: a condition on a hidden question hides it too', () => {
  const v = empty();
  v.a.k1 = 'Ya';
  v.a.k2 = '19.30';
  assert.deepEqual(
    [...shownIds(SECTIONS, v.a)],
    ['k1', 'k3', 'k5', 'k6', 'k7', 'k8', 'k9'],
  );
  v.a.k1 = 'Menyusul';
  // The API reads stored answers ("19:30"); the screen's own "19.30" is what the member typed.
  const shownApi = visibleQuestions(SECTIONS, asAnswers(v)).map((q) => q.id);
  assert.deepEqual(shownApi, [...shownIds(SECTIONS, v.a)]);
  assert.ok(shownIds(SECTIONS, v.a).has('k2'));
  // A checkbox's condition counts when the value is among its choices.
  const cb: FormSection[] = [
    {
      id: 's',
      title: '',
      questions: [
        { id: 'a', label: 'A', type: 'checkbox', options: ['x', 'y'] },
        {
          id: 'b',
          label: 'B',
          type: 'text',
          dependsOn: { questionId: 'a', value: 'y' },
        },
      ],
    },
  ];
  assert.ok(shownIds(cb, { a: ['x', 'y'], b: '' }).has('b'));
  assert.ok(!shownIds(cb, { a: ['x'], b: '' }).has('b'));
});

test('what counts as answered: a time as 19.30, "Lainnya" only with its words, a checkbox with one choice', () => {
  const q = (id: string) =>
    SECTIONS.flatMap((s) => s.questions).find((x) => x.id === id)!;
  const v = empty();
  assert.equal(isAnswered(q('k1'), v), false);
  v.a.k2 = '19.3';
  assert.equal(isAnswered(q('k2'), v), false);
  v.a.k2 = '19.30';
  assert.equal(isAnswered(q('k2'), v), true);
  v.a.k2 = '24.00';
  assert.equal(isAnswered(q('k2'), v), false);
  v.a.k5 = [OTHER];
  assert.equal(isAnswered(q('k5'), v), false);
  v.o.k5 = '  ';
  assert.equal(isAnswered(q('k5'), v), false);
  v.o.k5 = 'Stargazing';
  assert.equal(isAnswered(q('k5'), v), true);
});

test('the required questions missing are the ones the API would name, in order', () => {
  const v = empty();
  v.a.k1 = 'Menyusul';
  v.a.k5 = [OTHER];
  const mine = missingRequired(SECTIONS, v);
  assert.deepEqual(mine, ['k2', 'k3', 'k5', 'k6', 'k7', 'k8']);
  const labels = findMissingRequiredQuestions(SECTIONS, asAnswers(v));
  const byId = new Map(
    SECTIONS.flatMap((s) => s.questions).map((q) => [q.id, q.label]),
  );
  assert.deepEqual(
    labels,
    mine.map((id) => byId.get(id)),
  );
});

test('a complete fill sends answers the API accepts: shown only, a time as 19:30, "Lainnya" with its words', () => {
  const v = empty();
  v.a.k1 = 'Menyusul';
  v.a.k2 = '19.30';
  v.a.k9 = ' Catatan ';
  v.a.k3 = 'Ganesha';
  v.a.k5 = ['Games', OTHER];
  v.o.k5 = ' Stargazing ';
  v.a.k6 = '5';
  v.a.k7 = 'https://media.pips.test/abc-bukti.jpg';
  v.a.k8 = '2026-10-20';
  const sent = asAnswers(v);
  assert.deepEqual(findMissingRequiredQuestions(SECTIONS, sent), []);
  assert.equal(
    findInvalidAnswer(SECTIONS, sent, {
      maxText: 5000,
      isStoredFile: () => true,
    }),
    null,
  );
  assert.deepEqual(
    sent.find((a) => a.questionId === 'k2'),
    { questionId: 'k2', answer: '19:30' },
  );
  assert.deepEqual(
    sent.find((a) => a.questionId === 'k9'),
    { questionId: 'k9', answer: 'Catatan' },
  );
  assert.deepEqual(
    sent.find((a) => a.questionId === 'k5'),
    {
      questionId: 'k5',
      answer: ['Games', OTHER],
      other: 'Stargazing',
    },
  );
  // An answer left behind by a changed choice is not sent.
  v.a.k1 = 'Ya';
  assert.equal(
    asAnswers(v).some((a) => a.questionId === 'k2'),
    false,
  );
});

test('Ubah jawaban starts from what was sent, the time back as 19.30; a draft survives the device round trip', () => {
  const v = startingValues(SECTIONS, {
    answers: [
      { questionId: 'k2', answer: '19:30' },
      { questionId: 'k5', answer: ['Games', OTHER], other: 'Stargazing' },
      { questionId: 'gone', answer: 'x' },
    ],
  });
  assert.equal(v.a.k2, '19.30');
  assert.deepEqual(v.a.k5, ['Games', OTHER]);
  assert.equal(v.o.k5, 'Stargazing');
  assert.equal('gone' in v.a, false);
  assert.deepEqual(v.a.k1, '');
  const back = startingValues(SECTIONS, { draft: valuesOfDraft(draftOf(v)) });
  assert.deepEqual(back, v);
  // A draft value of the wrong shape (a question changed kind) is dropped.
  const odd = startingValues(SECTIONS, {
    draft: { a: { k5: 'x', k1: ['y'] }, o: {} },
  });
  assert.deepEqual(odd.a.k5, []);
  assert.equal(odd.a.k1, '');
});

test('the schema marks exactly the missing questions, under their field keys', () => {
  const keys = fieldKeys(SECTIONS);
  const v = empty();
  v.a.k1 = 'Ya';
  const r = answersSchema(SECTIONS).safeParse(toFields(v, keys));
  assert.equal(r.success, false);
  const paths = r.error!.issues.map((i) => keys.id(String(i.path[1])));
  assert.deepEqual(paths, missingRequired(SECTIONS, v));
  assert.deepEqual(toFill(toFields(v, keys), keys), v);
  // A question id the builder made with a dot never becomes a nested field name.
  const dotted = fieldKeys([
    {
      id: 's',
      title: '',
      questions: [{ id: 'a.b', label: 'x', type: 'text' }],
    },
  ]);
  assert.equal(dotted.key('a.b'), 'q0');
});

test('how answers read on "Yang kamu kirim"', () => {
  const q = (id: string) =>
    SECTIONS.flatMap((s) => s.questions).find((x) => x.id === id)!;
  assert.equal(
    answerText(q('k6'), { questionId: 'k6', answer: '5' }),
    '5 dari 5',
  );
  assert.equal(
    answerText(q('k8'), { questionId: 'k8', answer: '2026-10-20' }),
    'Selasa, 20 Oktober',
  );
  assert.equal(
    answerText(q('k2'), { questionId: 'k2', answer: '19:30' }),
    '19.30',
  );
  assert.equal(
    answerText(q('k5'), {
      questionId: 'k5',
      answer: ['Games', OTHER],
      other: 'Stargazing',
    }),
    'Games, Lainnya: Stargazing',
  );
  assert.equal(
    answerText(q('k7'), {
      questionId: 'k7',
      answer: 'https://media.pips.test/abc123-bukti%20transfer.jpg',
    }),
    'bukti transfer.jpg',
  );
  assert.equal(answerText(q('k1'), undefined), '');
});

test('a file name reads as the API reads it', () => {
  for (const url of [
    'https://media.pips.test/abc-bukti.jpg',
    'https://media.pips.test/x/abc-foto%20diri.png?v=1',
    'https://media.pips.test/plain.pdf',
  ])
    assert.equal(fileName(url), apiFileName(url));
});

test('typing a time and a birth date puts the separators in', () => {
  assert.equal(tidyTime('1930'), '19.30');
  assert.equal(tidyTime('19.3'), '19.3');
  assert.equal(tidyTime('9'), '9');
  assert.equal(tidyTime('19:305'), '19.30');
  assert.equal(timeToSend('19.30'), '19:30');
  assert.equal(timeToSend('7.30'), null);
  assert.equal(tidyDate('14032007'), '14/03/2007');
  assert.equal(tidyDate('1403'), '14/03');
});

test('a phone number and a birth date are checked as the API checks them', () => {
  for (const v of [
    '0812-5550-0945',
    '+62 812 5550 0945',
    '0812',
    '0812-abc',
    '081255500945',
  ])
    assert.equal(phoneOk(v), apiPhoneOk(v), v);
  const today = '2026-10-08';
  for (const v of [
    '14/03/2007',
    '31/02/2007',
    '01/01/1950',
    '09/10/2026',
    '07/10/2026',
    '1/3/2007',
  ]) {
    const iso = birthDateToSend(v, today);
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    const apiOk = m ? birthDateOk(`${m[3]}-${m[2]}-${m[1]}`, today) : false;
    assert.equal(iso !== null, apiOk, v);
  }
  assert.equal(birthDateText('2007-03-14'), '14 Maret 2007');
});

test('a saved detail goes only when it fits, with the reason the screen gives', () => {
  const today = '2026-10-08';
  assert.deepEqual(detailToSend('whatsapp', '0812', today), {
    ok: false,
    reason: 'nomor',
  });
  assert.deepEqual(detailToSend('whatsapp', ' 0812-5550-0945 ', today), {
    ok: true,
    value: '0812-5550-0945',
  });
  assert.deepEqual(detailToSend('health', '  ', today), {
    ok: false,
    reason: 'isi',
  });
  assert.deepEqual(detailToSend('health', 'x'.repeat(1001), today), {
    ok: false,
    reason: 'panjang',
  });
  assert.deepEqual(detailToSend('birthDate', '14/03/2007', today), {
    ok: true,
    value: '2007-03-14',
  });
  assert.deepEqual(detailToSend('birthDate', '31/02/2007', today), {
    ok: false,
    reason: 'tanggal',
  });
  assert.deepEqual(detailToSend('photo', '', today), {
    ok: false,
    reason: 'file',
  });
  assert.deepEqual(
    detailToSend(
      'emergencyContact',
      { name: 'Ratna', relation: '', phone: '0813-5550-0911' },
      today,
    ),
    { ok: false, reason: 'kontak' },
  );
  assert.deepEqual(
    detailToSend(
      'emergencyContact',
      { name: ' Ratna ', relation: 'Ibu', phone: '0813-5550-0911' },
      today,
    ),
    {
      ok: true,
      value: { name: 'Ratna', relation: 'Ibu', phone: '0813-5550-0911' },
    },
  );
});

const DETAILS: MyDetails = {
  account: {
    fullName: 'Nadia Putri',
    nim: '13525945',
    major: 'Teknik Informatika',
    angkatan: '2025',
    campus: 'Ganesha',
    email: '13525945@std.stei.itb.ac.id',
  },
  saved: {
    whatsapp: '0812-5550-0945',
    line: null,
    instagram: null,
    address: null,
    hometown: 'Semarang',
    emergencyContact: {
      name: 'Ratna Dewi',
      relation: 'Ibu',
      phone: '0813-5550-0911',
    },
    health: null,
    birthDate: '2007-03-14',
    studentCardPhoto: 'https://media.pips.test/k1-ktm-nadia.jpg',
    photo: null,
  },
};

test('the profile fields are the API’s, in its order, and read as the API sends them', () => {
  assert.deepEqual(
    FIELDS.map((f) => f.key),
    [...PROFILE_FIELDS],
  );
  assert.equal(SAVED.length, 10);
  assert.equal(filledCount(DETAILS.saved), 5);
  assert.equal(
    fieldText('emergencyContact', DETAILS),
    'Ratna Dewi (ibu) · 0813-5550-0911',
  );
  assert.equal(
    fieldText('emergencyContact', DETAILS),
    fieldValue('emergencyContact', {} as never, DETAILS.saved as never),
  );
  assert.equal(fieldText('birthDate', DETAILS), '14 Maret 2007');
  assert.equal(fieldText('studentCardPhoto', DETAILS), 'ktm-nadia.jpg');
  assert.equal(fieldText('health', DETAILS), '');
  assert.equal(fieldText('nim', DETAILS), '13525945');
  assert.deepEqual(draftFromSaved('birthDate', DETAILS.saved), '14/03/2007');
  assert.deepEqual(draftFromSaved('emergencyContact', DETAILS.saved), {
    name: 'Ratna Dewi',
    relation: 'Ibu',
    phone: '0813-5550-0911',
  });
  assert.deepEqual(
    draftFromSaved('emergencyContact', {
      ...DETAILS.saved,
      emergencyContact: null,
    }),
    {
      name: '',
      relation: '',
      phone: '',
    },
  );
});

test('the list: open first, then not open, sent and closed, keeping the server’s order inside each', () => {
  const f = (
    id: string,
    status: 'open' | 'not_opened' | 'already_responded' | 'closed',
  ) => ({ id, status });
  const rows = sortRows([
    f('a', 'closed'),
    f('b', 'already_responded'),
    f('c', 'open'),
    f('d', 'not_opened'),
    f('e', 'open'),
  ]);
  assert.deepEqual(
    rows.map((r) => r.id),
    ['c', 'e', 'd', 'b', 'a'],
  );
  assert.deepEqual(rows.map(rowState), [
    'open',
    'open',
    'soon',
    'done',
    'closed',
  ]);
});

test('times read as the prototype says them, in WIB', () => {
  assert.equal(whenShort('2026-10-18T16:59:00Z'), 'Min, 18 Okt · 23.59');
  const now = Date.parse('2026-10-08T06:35:00Z');
  assert.equal(untilText('2026-10-12T03:00:00Z', now), '4 hari lagi');
  assert.equal(untilText('2026-10-09T12:00:00Z', now), 'besok');
  assert.equal(untilText('2026-10-08T08:40:00Z', now), '2 jam 5 menit lagi');
  assert.equal(untilText('2026-10-08T06:45:00Z', now), '10 menit lagi');
});

test('a file answer is a JPG, PNG or PDF of 5 MB at most; a photo a JPG or PNG', () => {
  assert.ok(
    fileFits({ name: 'bukti.PDF', size: 1000 }, ['jpg', 'jpeg', 'png', 'pdf']),
  );
  assert.ok(
    !fileFits({ name: 'bukti.docx', size: 1000 }, [
      'jpg',
      'jpeg',
      'png',
      'pdf',
    ]),
  );
  assert.ok(
    !fileFits({ name: 'bukti.jpg', size: 5 * 1024 * 1024 + 1 }, ['jpg']),
  );
});

test('a radio group with nothing chosen (react-hook-form gives null) counts as unanswered, and nothing breaks', () => {
  const keys = fieldKeys(SECTIONS);
  const fields = toFields(empty(), keys);
  (fields.a as Record<string, unknown>)[keys.key('k1')] = null;
  (fields.a as Record<string, unknown>)[keys.key('k5')] = false;
  const v = toFill(fields, keys);
  const q = SECTIONS[0].questions[0];
  assert.equal(isAnswered(q, v), false);
  assert.ok(missingRequired(SECTIONS, v).includes('k1'));
  assert.ok(missingRequired(SECTIONS, v).includes('k5'));
  assert.deepEqual(asAnswers(v), []);
});
