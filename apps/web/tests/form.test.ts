// P2-A: the Form rules (src/lib/form/), checked against the server's own completeness check and the prototype.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { findMissingRequiredQuestions } from '../../api/src/lib/form-answers';
import { pixelForm } from '../e2e/fixtures/api';
import type { FormQuestion, FormSection } from '../src/api/generated';
import { form as copy } from '../src/copy/form';
import { decodeDraft, encodeDraft } from '../src/lib/form/draft-store';
import {
  clockWhen,
  deadlineWhen,
  longWhen,
  remaining,
  shortWhen,
} from '../src/lib/form/format';
import {
  openingStep,
  POLL_EVERY_MS,
  POLL_FOR_MS,
  POLL_JITTER_MS,
} from '../src/lib/form/poll';
import {
  answersToSend,
  answerText,
  checkRows,
  DRAFT_DAYS,
  DRAFT_HOURS,
  draftKey,
  firstIncompleteSection,
  isAnswered,
  isEligible,
  isOtherFollowUp,
  isRequired,
  isVisible,
  ratingParts,
  sectionMissing,
  startingAnswers,
  statusShown,
  type Answers,
} from '../src/lib/form/rules';

const sections = pixelForm.sections as FormSection[];
const all = sections.flatMap((s) => s.questions);
const q = (id: string) => all.find((x) => x.id === id)!;
const sectionOf = (id: string) =>
  sections.find((s) => s.questions.some((x) => x.id === id))!;
const words = {
  lainnya: copy.periksa.lainnya,
  dariLima: copy.periksa.dariLima,
  kosong: copy.periksa.kosong,
};

/** Every answer the PIXEL form needs, as the prototype's check fills it (garis-check.mjs). */
const complete: Answers = {
  q1: 'Nadia Putri',
  q2: '13525045',
  q3: 'PIXEL',
  q4: 'IF',
  q5: 'IF K2',
  q6: ['Other'],
  q22: 'Main musik',
  q8: 'Welcoming party',
  q9: ['Ada teman yang ikut'],
  q12: 'Sabtu sore',
  q16: 'Tertarik',
  q18: 'Nonton Bareng PIPS',
  q29: '5',
};

test('visible: no dependsOn, or the answer equals (radio) or includes (checkbox) its value', () => {
  assert.equal(isVisible(q('q1'), {}), true);
  assert.equal(isVisible(q('q22'), {}), false);
  assert.equal(isVisible(q('q22'), { q6: ['Main game'] }), false);
  assert.equal(isVisible(q('q22'), { q6: ['Main game', 'Other'] }), true);
  assert.equal(isVisible(q('q17'), { q16: 'Tertarik' }), false);
  assert.equal(isVisible(q('q17'), { q16: 'Tidak tertarik' }), true);
  assert.equal(isVisible(q('q19'), { q18: 'Others' }), true);
});

test('required: visible and not optional; answered: a non-blank string or a non-empty list', () => {
  assert.equal(isRequired(q('q30'), {}), false, 'q30 is optional');
  assert.equal(isRequired(q('q22'), {}), false, 'hidden follow-up');
  assert.equal(isRequired(q('q22'), { q6: ['Other'] }), true);
  assert.equal(isAnswered(q('q1'), { q1: '   ' }), false);
  assert.equal(isAnswered(q('q1'), { q1: ' x ' }), true);
  assert.equal(isAnswered(q('q6'), { q6: [] }), false);
  assert.equal(isAnswered(q('q6'), { q6: ['Olahraga'] }), true);
  assert.equal(isAnswered(q('q6'), {}), false);
});

test('the section check agrees with the server’s findMissingRequiredQuestions on the same answers', () => {
  const cases: Answers[] = [
    {},
    complete,
    { ...complete, q1: '  ' },
    { ...complete, q6: [] },
    { ...complete, q22: '' },
    { ...complete, q6: ['Main game'], q22: '' },
    { ...complete, q16: 'Tidak tertarik' },
    { ...complete, q16: 'Tidak tertarik', q17: 'Sibuk' },
    { ...complete, q18: 'Others' },
    { ...complete, q29: '' },
    { ...complete, q30: '' },
  ];
  for (const answers of cases) {
    const mine = sections
      .flatMap((s) => sectionMissing(s, answers))
      .map((x) => x.label);
    const server = findMissingRequiredQuestions(
      sections,
      answersToSend(sections, answers),
    );
    assert.deepEqual(mine, server, JSON.stringify(answers));
  }
  assert.deepEqual(
    findMissingRequiredQuestions(sections, answersToSend(sections, complete)),
    [],
  );
});

test('first incomplete section, and -1 when every section is complete', () => {
  assert.equal(firstIncompleteSection(sections, {}), 0);
  assert.equal(firstIncompleteSection(sections, complete), -1);
  assert.equal(firstIncompleteSection(sections, { ...complete, q12: '' }), 2);
  assert.deepEqual(
    sectionMissing(sections[0], { q1: 'Nadia', q2: '1' }).map((x) => x.id),
    ['q3', 'q4', 'q5'],
  );
});

test('answers sent: visible and answered only, in the form’s order', () => {
  const sent = answersToSend(sections, {
    ...complete,
    q6: ['Main game'], // Other unticked: its follow-up is hidden again
    q22: 'Main musik',
    q17: 'left over', // hidden: q16 is Tertarik
    q30: '',
    stray: 'not in the form',
  });
  const ids = sent.map((a) => a.questionId);
  assert.equal(ids.includes('q22'), false);
  assert.equal(ids.includes('q17'), false);
  assert.equal(ids.includes('q30'), false);
  assert.equal(ids.includes('stray'), false);
  assert.deepEqual(ids, [
    'q1',
    'q2',
    'q3',
    'q4',
    'q5',
    'q6',
    'q8',
    'q9',
    'q12',
    'q16',
    'q18',
    'q29',
  ]);
  assert.deepEqual(sent.find((a) => a.questionId === 'q6')!.answer, [
    'Main game',
  ]);
});

test('the check page: "Lainnya: …" for Other, "N dari 5", lists joined, empty when unanswered; no follow-up rows', () => {
  const text = (id: string, a: Answers) =>
    answerText(q(id), sectionOf(id), a, words);
  assert.equal(text('q6', complete), 'Lainnya: Main musik');
  assert.equal(
    text('q6', { q6: ['Main game', 'Other'], q22: 'Catur' }),
    'Main game, Lainnya: Catur',
  );
  assert.equal(text('q6', { q6: ['Other'] }), 'Lainnya: –');
  assert.equal(
    text('q18', { q18: 'Others', q19: 'Hackathon' }),
    'Lainnya: Hackathon',
  );
  assert.equal(text('q29', complete), '5 dari 5');
  assert.equal(text('q30', complete), '');
  assert.equal(text('q16', complete), 'Tertarik');
  const rows = checkRows(sectionOf('q6'), complete).map((x) => x.id);
  assert.deepEqual(rows, ['q6', 'q8'], 'q22 is shown inside q6');
  assert.equal(isOtherFollowUp(q('q22')), true);
  assert.equal(
    isOtherFollowUp(q('q17')),
    false,
    '"Tidak tertarik" is not an Other',
  );
  // q17 is listed when its condition holds.
  assert.ok(
    checkRows(sectionOf('q17'), { q16: 'Tidak tertarik' }).some(
      (x) => x.id === 'q17',
    ),
  );
});

test('prefill: the account’s name and NIM; a draft wins, also an emptied answer', () => {
  const me = { fullName: 'Nadia Putri', nim: '13525045' };
  assert.deepEqual(startingAnswers(sections, null, me), {
    q1: 'Nadia Putri',
    q2: '13525045',
  });
  assert.deepEqual(
    startingAnswers(sections, { q1: 'Nadia P.', q3: 'PIXEL' }, me),
    {
      q1: 'Nadia P.',
      q3: 'PIXEL',
      q2: '13525045',
    },
  );
  assert.deepEqual(startingAnswers(sections, { q1: '' }, me), {
    q1: '',
    q2: '13525045',
  });
  // Only questions marked prefill are filled.
  const plain: FormSection[] = [
    {
      id: 's',
      title: 'S',
      questions: [{ id: 'a', label: 'Nama', type: 'text' }],
    },
  ];
  assert.deepEqual(startingAnswers(plain, null, me), {});
});

test('the rating scale: the real label’s bracket moves under it; otherwise the prototype’s scale', () => {
  assert.deepEqual(
    ratingParts(
      'Secara keseluruhan, gimana penilaian kamu soal Welcoming Party 2025? (1 = sangat kurang, 5 = sangat baik)',
      copy.isi.skala,
    ),
    {
      label:
        'Secara keseluruhan, gimana penilaian kamu soal Welcoming Party 2025?',
      hint: '1 = sangat kurang, 5 = sangat baik',
    },
  );
  assert.deepEqual(ratingParts('Seberapa puas kamu?', copy.isi.skala), {
    label: 'Seberapa puas kamu?',
    hint: '1 = sangat kurang, 5 = sangat baik',
  });
});

test('status shown from the server’s status', () => {
  assert.equal(statusShown('open'), 'open');
  assert.equal(statusShown('not_opened'), 'soon');
  assert.equal(statusShown('already_responded'), 'done');
  assert.equal(statusShown('closed'), 'closed');
});

test('eligible by angkatan, as the server checks before anything else', () => {
  assert.equal(isEligible(pixelForm, { angkatan: 2025 }), true);
  assert.equal(isEligible(pixelForm, { angkatan: 2024 }), false);
});

test('times in WIB: card, form page, SPARTA deadline, clock', () => {
  const opens = '2026-09-12T06:00:00.000Z'; // Sabtu 13.00 WIB
  assert.equal(shortWhen(opens), 'Sab 12 Sep, 13.00');
  assert.equal(longWhen(opens), 'Sabtu, 12 September 2026, 13.00 WIB');
  assert.equal(
    deadlineWhen('2026-08-23T16:59:00.000Z'),
    'Min, 23 Agu 2026 pukul 23.59',
  );
  assert.equal(clockWhen('2026-10-08T00:45:00.000Z'), '07.45');
  // Just before midnight WIB is still the same day; just after is the next.
  assert.equal(shortWhen('2026-10-08T16:59:00.000Z'), 'Kam 8 Okt, 23.59');
  assert.equal(shortWhen('2026-10-08T17:00:00.000Z'), 'Jum 9 Okt, 00.00');
  assert.equal(
    pixelForm.opensAt,
    opens,
    'the fixture opens as the prototype says',
  );
});

test('the countdown: two units at most, never negative', () => {
  assert.equal(
    remaining(2 * 86400_000 + 3 * 3600_000 + 5 * 60_000),
    '2 hari 3 jam',
  );
  assert.equal(remaining(86400_000), '1 hari');
  assert.equal(remaining(3 * 3600_000 + 5 * 60_000 + 9_000), '3 jam 5 menit');
  assert.equal(remaining(4 * 60_000 + 9_000), '4 menit 9 detik');
  assert.equal(remaining(9_400), '9 detik');
  assert.equal(remaining(-5000), '0 detik');
});

test('the opening poll: waits for zero, then asks every 3–4 s, stops when sections arrive, gives up after 2 minutes', () => {
  const opensAt = 1_000_000;
  const base = { opensAt, hasSections: false, random: 0 };
  assert.deepEqual(
    openingStep({ ...base, pollingSince: null, now: opensAt - 1 }),
    { kind: 'wait', at: opensAt },
  );
  assert.deepEqual(openingStep({ ...base, pollingSince: null, now: opensAt }), {
    kind: 'poll',
    delay: POLL_EVERY_MS,
  });
  const jittered = openingStep({
    ...base,
    random: 0.999,
    pollingSince: opensAt,
    now: opensAt + 3000,
  });
  assert.equal(jittered.kind, 'poll');
  assert.ok(
    jittered.kind === 'poll' &&
      jittered.delay < POLL_EVERY_MS + POLL_JITTER_MS &&
      jittered.delay >= POLL_EVERY_MS,
  );
  // The device's clock may be early: once polling started, it keeps polling.
  assert.equal(
    openingStep({ ...base, pollingSince: opensAt, now: opensAt - 5000 }).kind,
    'poll',
  );
  assert.deepEqual(
    openingStep({
      ...base,
      hasSections: true,
      pollingSince: opensAt,
      now: opensAt + 9000,
    }),
    { kind: 'open' },
  );
  assert.equal(
    openingStep({
      ...base,
      pollingSince: opensAt,
      now: opensAt + POLL_FOR_MS - 1,
    }).kind,
    'poll',
  );
  assert.deepEqual(
    openingStep({ ...base, pollingSince: opensAt, now: opensAt + POLL_FOR_MS }),
    { kind: 'give-up' },
  );
  // How many requests at most: one at zero, then one every 3 s at the fastest, within 2 minutes.
  let since: number | null = null;
  let now = opensAt;
  let polls = 0;
  for (;;) {
    const s = openingStep({ ...base, pollingSince: since, now });
    if (s.kind !== 'poll') break;
    since ??= now;
    polls++;
    now += s.delay;
  }
  assert.equal(polls, POLL_FOR_MS / POLL_EVERY_MS);
});

test('drafts: today’s key, 14 days, and today’s bungkus format (so its drafts restore)', () => {
  assert.equal(DRAFT_DAYS, 14);
  assert.equal(DRAFT_HOURS, 24 * 14, 'today’s kadaluarsa: 24 * 14');
  assert.equal(draftKey('pixel', 'u1'), 'hmif-form-pixel-u1');
  const now = Date.parse('2026-10-08T06:35:00Z');
  // Written by bungkus 1.3.7 (its `simpan`): strings locked, lists as they are, a timestamp.
  const fromToday = {
    q1: '🔒==QayRXdQBjMlEWakFmT',
    q6: ['Main game'],
    _timestamp: now - 86400_000,
  };
  assert.deepEqual(decodeDraft(fromToday, now, DRAFT_HOURS), {
    q1: 'Nadia Putri',
    q6: ['Main game'],
  });
  const encoded = encodeDraft({ q1: 'Nadia Putri', q6: ['Main game'] }, now);
  assert.deepEqual(encoded, {
    q1: '🔒==QayRXdQBjMlEWakFmT',
    q6: ['Main game'],
    _timestamp: now,
  });
  const odd = { q8: 'Lainnya: “musik” & é', q2: '13525045' };
  assert.deepEqual(decodeDraft(encodeDraft(odd, now), now, DRAFT_HOURS), odd);
});

test('drafts expire after 14 days, as bungkus did; nothing stored is no draft', () => {
  const now = Date.parse('2026-10-08T06:35:00Z');
  const at = (days: number) =>
    encodeDraft({ q1: 'Nadia' }, now - days * 86400_000);
  assert.deepEqual(decodeDraft(at(13.9), now, DRAFT_HOURS), { q1: 'Nadia' });
  assert.deepEqual(decodeDraft(at(14), now, DRAFT_HOURS), { q1: 'Nadia' });
  assert.equal(decodeDraft(at(14.01), now, DRAFT_HOURS), null);
  assert.equal(decodeDraft(undefined, now, DRAFT_HOURS), null);
  assert.equal(decodeDraft({ _timestamp: now }, now, DRAFT_HOURS), null);
  assert.equal(
    decodeDraft({ q1: 'x' }, now, DRAFT_HOURS),
    null,
    'no timestamp',
  );
});

test('the generated client has every field the screens use', () => {
  const sample: FormQuestion = {
    id: 'q',
    label: 'L',
    type: 'text',
    prefill: 'nim',
  };
  assert.equal(sample.prefill, 'nim');
  assert.equal(pixelForm.closesAt, null);
  assert.equal(q('q1').prefill, 'fullName');
  assert.equal(q('q2').prefill, 'nim');
});
