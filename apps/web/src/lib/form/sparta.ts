/**
 * Magang SPARTA rules (P2-A), for the member side the owner asked to build on 2026-10-13 (OPEN-QUESTIONS D4). The
 * server's own rules are in apps/api/src/lib/sparta-window.ts (the window, eligibility) and
 * apps/api/src/types/internship.types.ts (the draft schema on `PUT`, the strict one on `submit`): a draft may be partial
 * on every step; sending needs Kelas, ID Line and exactly four divisions in priority order, and the screen also asks for
 * every required division question, as today's screen does.
 */
import type {
  DraftInternshipSubmission,
  InternshipDepartment,
  InternshipDivision,
  InternshipKesibukan,
  InternshipSubmission,
  InternshipWindow,
} from '~/api/generated';

export const SPARTA_CHOICES = 4;

/** The four steps, in order (today's screen's names). */
export const SPARTA_STEPS = [
  'umum',
  'penjelasan',
  'pilih',
  'pertanyaan',
] as const;
export type SpartaStep = (typeof SPARTA_STEPS)[number];

/** Checkbox answers are stored as one string, joined as today's screen joins them. */
export const CHECKBOX_SEPARATOR = ', ';

/** What the member is filling, as the screen keeps it. */
export interface SpartaDraft {
  kelas: string;
  idLine: string;
  pengalamanOrganisasi: string;
  kesibukan: InternshipKesibukan[];
  /** Division ids, highest priority first. */
  choices: string[];
  /** Per division, per question id. */
  answers: Record<string, Record<string, string>>;
}

export const EMPTY_SPARTA: SpartaDraft = {
  kelas: '',
  idLine: '',
  pengalamanOrganisasi: '',
  kesibukan: [],
  choices: [],
  answers: {},
};

export function allDivisions(
  departments: InternshipDepartment[],
): InternshipDivision[] {
  return departments.flatMap((d) => d.divisions ?? []);
}

/** The screen's draft from what the server has saved (or nothing). */
export function fromSubmission(
  sub: InternshipSubmission | null | undefined,
): SpartaDraft {
  if (!sub) return structuredClone(EMPTY_SPARTA);
  const choices = (sub.choices ?? [])
    .slice()
    .sort((a, b) => a.priorityOrder - b.priorityOrder);
  return {
    kelas: sub.kelas,
    idLine: sub.idLine,
    pengalamanOrganisasi: sub.pengalamanOrganisasi ?? '',
    kesibukan: sub.kesibukan.map((k) => ({ ...k })),
    choices: choices.map((c) => c.divisionId),
    answers: Object.fromEntries(
      choices.map((c) => [
        c.divisionId,
        Object.fromEntries(c.answers.map((a) => [a.questionId, a.answer])),
      ]),
    ),
  };
}

const blank = (s: string | undefined) => !s || s.trim() === '';
const kesibukanComplete = (k: InternshipKesibukan) =>
  !blank(k.jabatan) && !blank(k.organisasi) && !blank(k.periode);

/**
 * What `PUT` (a draft) and `submit` receive: priorities 1–4 in order, each chosen division's non-blank answers in its
 * questions' order, and only the activities filled in completely (a half-typed one waits on the device screen).
 */
export function toRequest(
  draft: SpartaDraft,
  divisions: InternshipDivision[],
): DraftInternshipSubmission {
  const byId = new Map(divisions.map((d) => [d.id, d]));
  return {
    kelas: draft.kelas.trim(),
    idLine: draft.idLine.trim(),
    ...(blank(draft.pengalamanOrganisasi)
      ? {}
      : { pengalamanOrganisasi: draft.pengalamanOrganisasi.trim() }),
    kesibukan: draft.kesibukan.filter(kesibukanComplete).map((k) => ({
      jabatan: k.jabatan.trim(),
      organisasi: k.organisasi.trim(),
      periode: k.periode.trim(),
    })),
    choices: draft.choices.slice(0, SPARTA_CHOICES).map((divisionId, i) => ({
      divisionId,
      priorityOrder: i + 1,
      answers: (byId.get(divisionId)?.questions ?? [])
        .filter((q) => !blank(draft.answers[divisionId]?.[q.id]))
        .map((q) => ({
          questionId: q.id,
          answer: draft.answers[divisionId][q.id],
        })),
    })),
  };
}

/** A missing answer: a field of Info Umum, the choice count, or a division's question. */
export type SpartaMissing =
  | { step: 'umum'; field: 'kelas' | 'idLine' }
  | {
      step: 'umum';
      field: 'kesibukan';
      index: number;
      part: keyof InternshipKesibukan;
    }
  | { step: 'pilih'; field: 'choices' }
  | { step: 'pertanyaan'; divisionId: string; questionId: string };

/** What Lanjut finds missing on a step. */
export function stepMissing(
  step: SpartaStep,
  draft: SpartaDraft,
  divisions: InternshipDivision[],
): SpartaMissing[] {
  const out: SpartaMissing[] = [];
  if (step === 'umum') {
    if (blank(draft.kelas)) out.push({ step, field: 'kelas' });
    if (blank(draft.idLine)) out.push({ step, field: 'idLine' });
    // An activity added must be filled in: all three parts, or remove it.
    draft.kesibukan.forEach((k, index) => {
      for (const part of ['jabatan', 'organisasi', 'periode'] as const)
        if (blank(k[part])) out.push({ step, field: 'kesibukan', index, part });
    });
  }
  if (step === 'pilih') {
    const unique = new Set(draft.choices).size === draft.choices.length;
    if (draft.choices.length !== SPARTA_CHOICES || !unique)
      out.push({ step, field: 'choices' });
  }
  if (step === 'pertanyaan') {
    const byId = new Map(divisions.map((d) => [d.id, d]));
    for (const divisionId of draft.choices) {
      for (const q of byId.get(divisionId)?.questions ?? [])
        if (q.required && blank(draft.answers[divisionId]?.[q.id]))
          out.push({ step, divisionId, questionId: q.id });
    }
  }
  return out;
}

/** The first step with something missing, or -1 when it can be sent. */
export function firstIncompleteStep(
  draft: SpartaDraft,
  divisions: InternshipDivision[],
): number {
  return SPARTA_STEPS.findIndex(
    (s) => stepMissing(s, draft, divisions).length > 0,
  );
}

/**
 * Whether `submit` would take this request: the server's strict schema (Kelas and ID Line, exactly four choices,
 * unique divisions, priorities 1–4). Division questions are the screen's check, not the server's.
 */
export function strictOk(req: DraftInternshipSubmission): boolean {
  const divisions = req.choices.map((c) => c.divisionId);
  const priorities = req.choices.map((c) => c.priorityOrder);
  return (
    req.kelas.length > 0 &&
    req.idLine.length > 0 &&
    req.choices.length === SPARTA_CHOICES &&
    new Set(divisions).size === divisions.length &&
    new Set(priorities).size === priorities.length &&
    priorities.every((p) => p >= 1 && p <= SPARTA_CHOICES)
  );
}

/** Whether the server's draft schema would take it (at most four, each division and priority once). */
export function draftOk(req: DraftInternshipSubmission): boolean {
  const divisions = req.choices.map((c) => c.divisionId);
  const priorities = req.choices.map((c) => c.priorityOrder);
  return (
    req.choices.length <= SPARTA_CHOICES &&
    new Set(divisions).size === divisions.length &&
    new Set(priorities).size === priorities.length &&
    priorities.every((p) => p >= 1 && p <= SPARTA_CHOICES)
  );
}

/** Ticking a division adds it last; unticking removes it. A fifth isn't added. */
export function toggleChoice(choices: string[], id: string): string[] {
  if (choices.includes(id)) return choices.filter((c) => c !== id);
  if (choices.length >= SPARTA_CHOICES) return choices;
  return [...choices, id];
}

/** Moves a choice up (-1) or down (+1) one place in priority; at either end, nothing changes. */
export function moveChoice(
  choices: string[],
  index: number,
  delta: -1 | 1,
): string[] {
  const to = index + delta;
  if (index < 0 || index >= choices.length || to < 0 || to >= choices.length)
    return choices;
  const out = choices.slice();
  [out[index], out[to]] = [out[to], out[index]];
  return out;
}

/** What the screen shows: who can't take part, closed, not open yet, or open. Eligibility comes from the server. */
export type SpartaView = 'not-eligible' | 'closed' | 'not-open' | 'open';

export function spartaView(window: InternshipWindow): SpartaView {
  if (!window.eligible) return 'not-eligible';
  if (window.status === 'closed') return 'closed';
  if (window.status === 'not_opened') return 'not-open';
  return 'open';
}

/** A checkbox answer's options, from the stored string. */
export function checkboxValues(answer: string | undefined): string[] {
  return answer ? answer.split(CHECKBOX_SEPARATOR).filter(Boolean) : [];
}
