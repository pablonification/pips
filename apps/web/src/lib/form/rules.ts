/**
 * Form (PIXEL) rules (P2-A), from the prototype's `garis/state.js` (`qVisible`, `qAnswered`, `sectionMissing`) and
 * `garis/screens-more.js` (`answerText`, `reviewPage`), on the API's shapes. They match the server's
 * `findMissingRequiredQuestions` (apps/api/src/controllers/form.controller.ts), so what the screen calls complete is
 * what the server accepts.
 */
import type {
  FormQuestion,
  FormSection,
  FormStatus,
  UserWithRoles,
} from '~/api/generated';

export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

/** Shown when it has no `dependsOn`, or the answer it depends on is (or, for a checkbox, includes) its value. */
export function isVisible(q: FormQuestion, answers: Answers): boolean {
  if (!q.dependsOn) return true;
  const v = answers[q.dependsOn.questionId];
  return Array.isArray(v)
    ? v.includes(q.dependsOn.value)
    : v === q.dependsOn.value;
}

/** Required: visible and not optional. */
export function isRequired(q: FormQuestion, answers: Answers): boolean {
  return !q.optional && isVisible(q, answers);
}

/** Answered: a non-blank string or a non-empty list. */
export function isAnswered(q: FormQuestion, answers: Answers): boolean {
  const v = answers[q.id];
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === 'string' && v.trim() !== '';
}

/** The section's required questions still unanswered, in order (the prototype's `sectionMissing`). */
export function sectionMissing(
  section: FormSection,
  answers: Answers,
): FormQuestion[] {
  return section.questions.filter(
    (q) => isRequired(q, answers) && !isAnswered(q, answers),
  );
}

/** The first section with a missing answer, or -1 when every section is complete. */
export function firstIncompleteSection(
  sections: FormSection[],
  answers: Answers,
): number {
  return sections.findIndex((s) => sectionMissing(s, answers).length > 0);
}

/**
 * What Kirim sends: the visible questions' non-blank answers, in the form's order. A follow-up hidden again (its
 * "Other" unticked) is left out, as is anything not in the form.
 */
export function answersToSend(
  sections: FormSection[],
  answers: Answers,
): { questionId: string; answer: AnswerValue }[] {
  return sections.flatMap((s) =>
    s.questions
      .filter((q) => isVisible(q, answers) && isAnswered(q, answers))
      .map((q) => ({ questionId: q.id, answer: answers[q.id] })),
  );
}

/** The "Other"/"Others" follow-ups: a question that appears when its parent's "Other" option is chosen. */
export function isOtherFollowUp(q: FormQuestion): boolean {
  return !!q.dependsOn && /^others?$/i.test(q.dependsOn.value.trim());
}

function followUpOf(q: FormQuestion, section: FormSection) {
  return section.questions.find(
    (x) => isOtherFollowUp(x) && x.dependsOn!.questionId === q.id,
  );
}

export interface CheckWords {
  lainnya: string; // 'Lainnya: {isi}'
  dariLima: string; // '{n} dari 5'
  kosong: string; // '–', a follow-up left blank
}

/**
 * An answer as the member gave it, for the check page (the prototype's `answerText`): "Other" shows its follow-up
 * ("Lainnya: Main musik"), a rating "4 dari 5", a list joined with commas. Empty when not answered (the page then
 * says "Tidak diisi").
 */
export function answerText(
  q: FormQuestion,
  section: FormSection,
  answers: Answers,
  words: CheckWords,
): string {
  const v = answers[q.id];
  const follow = followUpOf(q, section);
  const show = (o: string) => {
    if (!follow || o !== follow.dependsOn!.value) return o;
    const said = answers[follow.id];
    const text = typeof said === 'string' && said.trim() ? said : words.kosong;
    return words.lainnya.replace('{isi}', text);
  };
  if (Array.isArray(v)) return v.length ? v.map(show).join(', ') : '';
  if (typeof v !== 'string' || !v.trim()) return '';
  if (q.type === 'rating') return words.dariLima.replace('{n}', v);
  return show(v);
}

/** The questions the check page lists for a section: visible ones, without the "Other" follow-ups (shown inline). */
export function checkRows(
  section: FormSection,
  answers: Answers,
): FormQuestion[] {
  return section.questions.filter(
    (q) => isVisible(q, answers) && !isOtherFollowUp(q),
  );
}

/**
 * The answers to start with: a saved draft wins; a question the draft doesn't hold that asks for prefill
 * (`fullName`, `nim`) starts with the account's value (SPEC story 84).
 */
export function startingAnswers(
  sections: FormSection[],
  draft: Answers | null,
  me: Pick<UserWithRoles, 'fullName' | 'nim'>,
): Answers {
  const out: Answers = { ...(draft ?? {}) };
  for (const q of sections.flatMap((s) => s.questions)) {
    if (!q.prefill || q.id in out) continue;
    const value = q.prefill === 'fullName' ? me.fullName : me.nim;
    if (value) out[q.id] = value;
  }
  return out;
}

/**
 * A rating question's scale. The real PIXEL label carries it in brackets ("… 2025? (1 = sangat kurang, 5 = sangat
 * baik)"); the prototype shows it under the question. The API has no field for it (OPEN-QUESTIONS A3), so the
 * bracket moves under the label, and without one the prototype's scale is shown.
 */
export function ratingParts(
  label: string,
  fallbackHint: string,
): { label: string; hint: string } {
  const m = /^(.*?)\s*\((1\s*=[^)]*)\)\s*$/.exec(label);
  return m ? { label: m[1], hint: m[2] } : { label, hint: fallbackHint };
}

/** How a status shows on a card (the prototype's `statusTag`, plus Ditutup). */
export type StatusShown = 'open' | 'soon' | 'done' | 'closed';

export function statusShown(status: FormStatus): StatusShown {
  if (status === 'already_responded') return 'done';
  if (status === 'not_opened') return 'soon';
  if (status === 'closed') return 'closed';
  return 'open';
}

/** Days a form draft stays on the device (garis/state.js `DRAFT_DAYS`; bungkus `kadaluarsa` in hours). */
export const DRAFT_DAYS = 14;
export const DRAFT_HOURS = DRAFT_DAYS * 24;

/** The device store's key for a member's draft of a form, as today's app names it (so old drafts restore). */
export const draftKey = (formId: string, userId: string) =>
  `hmif-form-${formId}-${userId}`;

/** Whether a member may fill the form at all: their angkatan is in it (early-access NIMs are the server's call). */
export function isEligible(
  form: { eligibleAngkatan: number[] },
  me: Pick<UserWithRoles, 'angkatan'>,
): boolean {
  return form.eligibleAngkatan.includes(me.angkatan);
}
