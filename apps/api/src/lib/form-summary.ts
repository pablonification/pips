/**
 * The Jawaban tab's numbers and the export's table, from a form and its responses. No database, so the web app's
 * pretend API answers with the same code.
 */
import { visibleQuestions } from './form-answers';
import {
  CHOICE_TYPES,
  OTHER_ANSWER,
  PROFILE_FIELDS,
  PROFILE_FIELD_LABELS,
  fileName,
  questionsOf,
  scaleValues,
  type FormAnswer,
  type FormQuestion,
  type FormSection,
  type ProfileField,
  type QuestionType,
} from './form-model';

export interface SummaryResponse {
  answers: FormAnswer[];
  submittedAt: Date | string;
}

export interface ValueCount {
  value: string;
  count: number;
}

export interface QuestionSummary {
  questionId: string;
  label: string;
  type: QuestionType;
  /** How many responses answered it. */
  answered: number;
  /**
   * Choices, scales, dates and times: each value with how many chose it. Choices and scales list every option in
   * order (with 0); dates and times list the values given, earliest first. "Lainnya" is counted as `OTHER_ANSWER`.
   */
  counts?: ValueCount[];
  /** A scale's mean, to one decimal; null with no answers. */
  average?: number | null;
  /** Text answers and "Lainnya" lines, newest first, at most `TEXT_LIMIT`. */
  texts?: string[];
  /** File answers, newest first, at most `TEXT_LIMIT`. */
  files?: Array<{ url: string; name: string }>;
}

/** The most text answers or files the summary lists per question; the responses one by one show the rest. */
export const TEXT_LIMIT = 100;

const values = (a: FormAnswer | undefined) =>
  a === undefined ? [] : Array.isArray(a.answer) ? a.answer : [a.answer];

/** What a question's answer looked like in a response, read the way the question is now (radio↔checkbox). */
function chosen(a: FormAnswer | undefined) {
  return values(a).filter((v) => v.trim() !== '');
}

export function summarize(
  sections: FormSection[],
  responses: SummaryResponse[],
): { total: number; questions: QuestionSummary[] } {
  const newestFirst = [...responses].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
  const questions = questionsOf(sections).map((q) => {
    const answersTo = newestFirst
      .map((r) => r.answers.find((a) => a.questionId === q.id))
      .filter((a): a is FormAnswer => !!a && chosen(a).length > 0);
    const s: QuestionSummary = {
      questionId: q.id,
      label: q.label,
      type: q.type,
      answered: answersTo.length,
    };
    if (CHOICE_TYPES.includes(q.type) || q.type === 'rating') {
      const order =
        q.type === 'rating'
          ? scaleValues(q)
          : [...(q.options ?? []), ...(q.other ? [OTHER_ANSWER] : [])];
      const counts = new Map(order.map((v) => [v, 0]));
      const others: string[] = [];
      for (const a of answersTo) {
        for (const v of chosen(a)) {
          // An answer whose option was since removed still counts, under its own words.
          counts.set(v, (counts.get(v) ?? 0) + 1);
          if (v === OTHER_ANSWER && a.other?.trim())
            others.push(a.other.trim());
        }
      }
      s.counts = [...counts].map(([value, count]) => ({ value, count }));
      if (q.other) s.texts = others.slice(0, TEXT_LIMIT);
      if (q.type === 'rating') {
        const nums = answersTo.flatMap(chosen).map(Number);
        s.average = nums.length
          ? Math.round((nums.reduce((x, y) => x + y, 0) / nums.length) * 10) /
            10
          : null;
      }
    } else if (q.type === 'date' || q.type === 'time') {
      const counts = new Map<string, number>();
      for (const a of answersTo)
        for (const v of chosen(a)) counts.set(v, (counts.get(v) ?? 0) + 1);
      s.counts = [...counts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([value, count]) => ({ value, count }));
    } else if (q.type === 'file') {
      s.files = answersTo
        .slice(0, TEXT_LIMIT)
        .map((a) => ({ url: chosen(a)[0], name: fileName(chosen(a)[0]) }));
    } else {
      s.texts = answersTo.slice(0, TEXT_LIMIT).map((a) => chosen(a).join(', '));
    }
    return s;
  });
  return { total: responses.length, questions };
}

export interface ExportResponse extends SummaryResponse {
  profile: Partial<Record<ProfileField, string>>;
  updatedAt: Date | string | null;
}

export type ExportCell = string | number | Date | null;

/** A response's answer to one question as one cell: choices joined with ", ", "Lainnya: …", a scale as a number. */
export function answerCell(
  q: FormQuestion,
  a: FormAnswer | undefined,
): ExportCell {
  const vs = chosen(a);
  if (vs.length === 0) return null;
  if (q.type === 'rating') return Number(vs[0]);
  return vs
    .map((v) => (v === OTHER_ANSWER ? `Lainnya: ${a?.other?.trim() ?? ''}` : v))
    .join(', ');
}

/**
 * The export as a table: one row per response, oldest first; columns "Waktu kirim", "Diubah", then each profile field
 * the form requests (and any an older response carries), then each question in the form's order. A question hidden by
 * its condition in a response is empty there.
 */
export function exportTable(
  form: { sections: FormSection[]; requestedFields: readonly ProfileField[] },
  responses: ExportResponse[],
): { header: string[]; rows: ExportCell[][] } {
  const carried = new Set<ProfileField>(form.requestedFields);
  for (const r of responses)
    for (const k of Object.keys(r.profile) as ProfileField[]) carried.add(k);
  const fields = PROFILE_FIELDS.filter((f) => carried.has(f));
  const qs = questionsOf(form.sections);
  const header = [
    'Waktu kirim',
    'Diubah',
    ...fields.map((f) => PROFILE_FIELD_LABELS[f]),
    ...qs.map((q, i) => q.label.trim() || `Pertanyaan ${i + 1}`),
  ];
  const rows = [...responses]
    .sort(
      (a, b) =>
        new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
    )
    .map((r) => {
      const shown = new Set(
        visibleQuestions(form.sections, r.answers).map((q) => q.id),
      );
      return [
        new Date(r.submittedAt),
        r.updatedAt ? new Date(r.updatedAt) : null,
        ...fields.map((f) => r.profile[f] ?? null),
        ...qs.map((q) =>
          shown.has(q.id)
            ? answerCell(
                q,
                r.answers.find((a) => a.questionId === q.id),
              )
            : null,
        ),
      ];
    });
  return { header, rows };
}

/** The time a cell shows, in WIB: `2026-10-08 13.35`. */
export function wibStamp(d: Date) {
  const t = new Date(d.getTime() + 7 * 3600_000).toISOString();
  return `${t.slice(0, 10)} ${t.slice(11, 13)}.${t.slice(14, 16)}`;
}

/**
 * A text cell a spreadsheet would read as a formula (`=`, `+`, `-`, `@`, a tab or a return first) gets a `'` in front,
 * so opening the CSV never runs what a member typed.
 */
export function safeCell(v: string) {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** The table as CSV (RFC 4180, CRLF), with a byte-order mark so Excel reads it as UTF-8. Times in WIB. */
export function toCsv(table: { header: string[]; rows: ExportCell[][] }) {
  const cell = (v: ExportCell) => {
    const s =
      v === null
        ? ''
        : v instanceof Date
          ? wibStamp(v)
          : typeof v === 'number'
            ? String(v)
            : safeCell(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    '\uFEFF' +
    [table.header.map(cell), ...table.rows.map((r) => r.map(cell))]
      .map((r) => r.join(','))
      .join('\r\n') +
    '\r\n'
  );
}
