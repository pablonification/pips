/**
 * The server's check of a form response (POST and PUT /form/{formId}/response answer 400 when it finds anything).
 * Written with structural types, so the web app's tests can hold its own rules to these (apps/web/tests/form.test.ts).
 */
import {
  CHOICE_TYPES,
  OTHER_ANSWER,
  choicesOf,
  fileExtension,
  FILE_ANSWER_TYPES,
  scaleValues,
  type FormQuestion,
  type QuestionType,
} from './form-model';

interface Question {
  id: string;
  label: string;
  optional?: boolean;
  dependsOn?: { questionId: string; value: string };
}

interface Answer {
  questionId: string;
  answer: string | string[];
  other?: string;
}

const answered = (a: Answer | undefined) => {
  if (!a) return false;
  const values = Array.isArray(a.answer) ? a.answer : [a.answer];
  if (values.length === 0) return false;
  if (values.includes(OTHER_ANSWER) && !(a.other ?? '').trim()) return false;
  return values.some((v) => v.trim() !== '');
};

/**
 * The questions a member sees with these answers, in order. A question with "Tampilkan jika" shows only when its
 * source question shows and was answered with the value (one of a checkbox's choices counts).
 */
export function visibleQuestions<Q extends Question>(
  sections: Array<{ questions: Q[] }>,
  answers: Answer[],
): Q[] {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
  const shown = new Set<string>();
  const out: Q[] = [];
  for (const q of sections.flatMap((s) => s.questions)) {
    if (q.dependsOn) {
      const { questionId, value } = q.dependsOn;
      if (!shown.has(questionId)) continue;
      const a = answerMap.get(questionId);
      if (!(Array.isArray(a) ? a.includes(value) : a === value)) continue;
    }
    shown.add(q.id);
    out.push(q);
  }
  return out;
}

/** Labels of required questions shown but not answered. A question hidden by its condition is never required. */
export function findMissingRequiredQuestions(
  sections: Array<{ questions: Question[] }>,
  answers: Answer[],
): string[] {
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  return visibleQuestions(sections, answers)
    .filter((q) => !q.optional && !answered(byId.get(q.id)))
    .map((q) => q.label);
}

/** Only the answers to questions shown: an answer left behind by a changed choice is not kept. */
export function keepVisibleAnswers<A extends Answer>(
  sections: Array<{ questions: Question[] }>,
  answers: A[],
): A[] {
  const shown = new Set(visibleQuestions(sections, answers).map((q) => q.id));
  return answers.filter((a) => shown.has(a.questionId));
}

interface CheckOptions {
  /** The longest text answer or "Lainnya" line. */
  maxText: number;
  /** Whether an address is a file in the app's own storage (`lib/media-url.ts`). Without it, no file answer fits. */
  isStoredFile?: (url: string) => boolean;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function realDate(value: string) {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function fitsOne(
  q: Pick<FormQuestion, 'type' | 'options' | 'other' | 'scale'>,
  value: string,
  o: CheckOptions,
) {
  switch (q.type as QuestionType) {
    case 'text':
    case 'textarea':
      return value.length <= o.maxText;
    case 'rating':
      return scaleValues(q).includes(value);
    case 'date':
      return realDate(value);
    case 'time':
      return TIME.test(value);
    case 'file':
      return (
        !!o.isStoredFile?.(value) &&
        FILE_ANSWER_TYPES.includes(fileExtension(value))
      );
    default:
      return choicesOf(q as FormQuestion).includes(value);
  }
}

/**
 * Why a response doesn't fit its form, or null when it does: every answer is to a question of the form, once; a
 * choice is one of its options (a checkbox, a list of them, each once); "Lainnya" only where offered, with its words;
 * a scale's number within its range; a real date `YYYY-MM-DD`; a time `HH:MM`; a file in the app's storage, as JPG,
 * PNG or PDF; text at most `maxText` characters. Live Counting and the Jawaban tab count what is stored, so a made-up
 * option would show there.
 */
export function findInvalidAnswer(
  sections: Array<{
    questions: Array<
      Pick<FormQuestion, 'id' | 'type' | 'options' | 'other' | 'scale'>
    >;
  }>,
  answers: Answer[],
  maxText: number | CheckOptions,
): string | null {
  const o = typeof maxText === 'number' ? { maxText } : maxText;
  const questions = new Map(
    sections.flatMap((s) => s.questions).map((q) => [q.id, q]),
  );
  const seen = new Set<string>();
  for (const a of answers) {
    const { questionId, answer } = a;
    const question = questions.get(questionId);
    if (!question) return `Unknown question: ${questionId}`;
    if (seen.has(questionId)) return `Answered twice: ${questionId}`;
    seen.add(questionId);
    const values = Array.isArray(answer) ? answer : [answer];
    const fits =
      (question.type === 'checkbox'
        ? Array.isArray(answer) && new Set(answer).size === answer.length
        : typeof answer === 'string') &&
      values.every((v) => fitsOne(question, v, o));
    if (!fits) return `Answer does not fit question: ${questionId}`;
    const choseOther = values.includes(OTHER_ANSWER);
    if (a.other !== undefined) {
      if (!choseOther || !CHOICE_TYPES.includes(question.type))
        return `Lainnya without choosing it: ${questionId}`;
      if (a.other.length > o.maxText)
        return `Answer does not fit question: ${questionId}`;
    }
    if (choseOther && !(a.other ?? '').trim())
      return `Lainnya needs its words: ${questionId}`;
  }
  return null;
}
