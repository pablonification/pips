/**
 * The rules of the form builder, with no database: what a form's definition may hold, what it needs before it is
 * published, which edits lose answers, its short name, and who may do what with it (docs/adr/0023-*).
 */
import {
  CHOICE_TYPES,
  DEFAULT_SCALE,
  FORM_LIMITS,
  OTHER_ANSWER,
  OTHER_TYPES,
  QUESTION_TYPES,
  questionsOf,
  type CollaboratorRole,
  type FormAnswer,
  type FormQuestion,
  type FormSection,
  type QuestionType,
} from './form-model';

const has = (s: string | undefined) => !!s && s.trim() !== '';

/**
 * Why a definition can't be saved, or null. Checked on every save, draft or not: ids unique; a kind the app knows;
 * options only on choice questions and never named like "Lainnya"'s answer; a scale from 0 or 1 to between 2 and 10;
 * "Tampilkan jika" only on an earlier choice question, with one of its options; the sizes in `FORM_LIMITS`.
 * Empty labels and a choice with one option may be saved (the maker is still typing); `publishProblems` refuses them.
 */
export function definitionProblem(sections: FormSection[]): string | null {
  if (sections.length === 0) return 'A form needs at least one section';
  if (sections.length > FORM_LIMITS.sections) return 'Too many sections';
  const qs = questionsOf(sections);
  if (qs.length > FORM_LIMITS.questions) return 'Too many questions';
  const ids = new Set<string>();
  for (const s of sections) {
    if (ids.has(s.id)) return `Id used twice: ${s.id}`;
    ids.add(s.id);
    if (s.title.length > FORM_LIMITS.title) return `Section title too long`;
    if ((s.description ?? '').length > FORM_LIMITS.description)
      return `Section description too long`;
  }
  const before = new Map<string, FormQuestion>();
  for (const q of qs) {
    if (ids.has(q.id)) return `Id used twice: ${q.id}`;
    ids.add(q.id);
    if (!QUESTION_TYPES.includes(q.type)) return `Unknown kind: ${q.id}`;
    if (q.label.length > FORM_LIMITS.label) return `Label too long: ${q.id}`;
    if ((q.description ?? '').length > FORM_LIMITS.description)
      return `Description too long: ${q.id}`;
    const choice = CHOICE_TYPES.includes(q.type);
    if (!choice && q.options !== undefined)
      return `Options on a question that has none: ${q.id}`;
    if (q.other && !OTHER_TYPES.includes(q.type))
      return `Lainnya is only for Pilihan ganda and Kotak centang: ${q.id}`;
    if (choice) {
      const options = q.options ?? [];
      if (options.length > FORM_LIMITS.options)
        return `Too many options: ${q.id}`;
      if (options.some((o) => o.length > FORM_LIMITS.option))
        return `Option too long: ${q.id}`;
      if (options.includes(OTHER_ANSWER))
        return `Option name reserved: ${q.id}`;
      const named = options.filter(has);
      if (new Set(named).size !== named.length)
        return `Option used twice: ${q.id}`;
    }
    if (q.scale !== undefined) {
      if (q.type !== 'rating')
        return `Scale on a question that has none: ${q.id}`;
      const { min, max, minLabel, maxLabel } = q.scale;
      if (
        ![0, 1].includes(min) ||
        !Number.isInteger(max) ||
        max < 2 ||
        max > 10
      )
        return `Scale out of range: ${q.id}`;
      if ((minLabel ?? '').length > FORM_LIMITS.option)
        return `Scale label too long: ${q.id}`;
      if ((maxLabel ?? '').length > FORM_LIMITS.option)
        return `Scale label too long: ${q.id}`;
    }
    if (q.dependsOn) {
      const src = before.get(q.dependsOn.questionId);
      if (!src || !CHOICE_TYPES.includes(src.type))
        return `Tampilkan jika needs an earlier choice question: ${q.id}`;
      if (!(src.options ?? []).includes(q.dependsOn.value))
        return `Tampilkan jika needs one of its options: ${q.id}`;
    }
    before.set(q.id, q);
  }
  return null;
}

export type PublishProblem =
  | 'no_title'
  | 'no_questions'
  | 'unwritten_question'
  | 'one_option'
  | 'no_angkatan'
  | 'closes_before_opening'
  | 'already_closed';

/**
 * What still stops a form from being published, in the order the Terbitkan dialog lists them: a title, at least one
 * question with every question written, two options on every choice question, at least one angkatan, and a closing
 * time after the opening (and after now).
 */
export function publishProblems(
  form: {
    title: string;
    sections: FormSection[];
    eligibleAngkatan: readonly number[];
    opensAt: Date | string | null;
    closesAt: Date | string | null;
  },
  now: Date | number = Date.now(),
): PublishProblem[] {
  const out: PublishProblem[] = [];
  const qs = questionsOf(form.sections);
  if (!has(form.title)) out.push('no_title');
  if (qs.length === 0) out.push('no_questions');
  else if (qs.some((q) => !has(q.label))) out.push('unwritten_question');
  if (
    qs.some(
      (q) =>
        CHOICE_TYPES.includes(q.type) &&
        (q.options ?? []).filter(has).length < 2,
    )
  )
    out.push('one_option');
  if (form.eligibleAngkatan.length === 0) out.push('no_angkatan');
  if (form.closesAt !== null) {
    const closes = new Date(form.closesAt).getTime();
    const opens =
      form.opensAt === null
        ? new Date(now).getTime()
        : new Date(form.opensAt).getTime();
    if (closes <= new Date(now).getTime()) out.push('already_closed');
    else if (closes <= opens) out.push('closes_before_opening');
  }
  return out;
}

/** Kind changes that keep the old answers readable (the prototype's TYPE_KEEPS). Any other change loses them. */
const KEEPS: Partial<Record<QuestionType, readonly QuestionType[]>> = {
  text: ['textarea'],
  textarea: ['text'],
  radio: ['dropdown', 'checkbox'],
  dropdown: ['radio', 'checkbox'],
};

export function keepsAnswers(from: QuestionType, to: QuestionType) {
  return from === to || (KEEPS[from] ?? []).includes(to);
}

export interface BreakingChange {
  questionId: string;
  label: string;
  change: 'removed' | 'type';
}

/**
 * The edits that lose answers already sent: a question removed, or its kind changed to one that can't read the old
 * answers. Wording, options and order lose nothing. Only matters on a form with answers; the builder asks first, and
 * the API refuses until it is told the maker agreed.
 */
export function findBreakingChanges(
  before: FormSection[],
  after: FormSection[],
): BreakingChange[] {
  const next = new Map(questionsOf(after).map((q) => [q.id, q]));
  const out: BreakingChange[] = [];
  for (const q of questionsOf(before)) {
    const now = next.get(q.id);
    if (!now) out.push({ questionId: q.id, label: q.label, change: 'removed' });
    else if (!keepsAnswers(q.type, now.type))
      out.push({ questionId: q.id, label: q.label, change: 'type' });
  }
  return out;
}

/** A response without its answers to the questions a confirmed breaking edit took away: they go for good. */
export function dropLostAnswers(
  answers: FormAnswer[],
  lost: readonly BreakingChange[],
): FormAnswer[] {
  const gone = new Set(lost.map((b) => b.questionId));
  return answers.filter((a) => !gone.has(a.questionId));
}

/** The scale a rating uses. */
export const scaleOf = (q: FormQuestion) => q.scale ?? DEFAULT_SCALE;

// The short name: app.hmif.dev/f/<slug>.

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type SlugProblem = 'too_short' | 'too_long' | 'characters' | 'hyphens';

/** Capitals become lower case and spaces or underscores hyphens, as the field does while typing. */
export const tidySlug = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

/** Why a short name can't be used, before asking whether another form holds it; null when its form is fine. */
export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return 'too_short';
  if (slug.length > SLUG_MAX) return 'too_long';
  if (/[^a-z0-9-]/.test(slug)) return 'characters';
  if (!SLUG.test(slug)) return 'hyphens';
  return null;
}

/** A short name from a title: "Daftar panitia Wisuda Oktober" → `daftar-panitia-wisuda-oktober`. */
export function slugFromTitle(title: string): string {
  const s = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  return s.length >= SLUG_MIN ? s : 'form-baru';
}

/** The `n`th name to try for `base`: `base`, then `base-2`, `base-3` …, cut to fit. */
export function numberedSlug(base: string, n: number) {
  if (n <= 1) return base;
  const tail = `-${n}`;
  return `${base.slice(0, SLUG_MAX - tail.length).replace(/-+$/, '')}${tail}`;
}

// Who may do what with a form.

/** A member's relation to a form: they made it, it is shared with them, or neither. */
export type FormRelation = 'owner' | CollaboratorRole | null;

export interface FormAccess {
  /** Their relation, as the list shows it ("Bisa edit", "Lihat jawaban", "dari …"). */
  role: FormRelation;
  /** Sees the form in the builder and its answers. */
  canView: boolean;
  /** Changes the form, its Setelan, its short name and who it is shared with. */
  canEdit: boolean;
  /** Admin acting on a form that is not theirs: the builder says whose it is. */
  asAdmin: boolean;
}

/**
 * The owner and "Edit" edit and share; "Lihat jawaban" sees the form and its answers; admin edits every form
 * (owner's decision). The routes that use it are for pengurus only (`route-access.ts`).
 */
export function formAccess(
  relation: FormRelation,
  isAdmin: boolean,
): FormAccess {
  const edits = relation === 'owner' || relation === 'edit' || isAdmin;
  return {
    role: relation,
    canView: edits || relation === 'view',
    canEdit: edits,
    asAdmin: isAdmin && relation !== 'owner',
  };
}

/** A form's state for whoever manages it, as Kelola › Form tags it. */
export type ManageStatus = 'draft' | 'scheduled' | 'open' | 'closed';

export function manageStatus(
  form: {
    publishedAt: Date | string | null;
    opensAt: Date | string | null;
    closesAt: Date | string | null;
    isActive: boolean;
  },
  now: Date | number = Date.now(),
): ManageStatus {
  if (form.publishedAt === null) return 'draft';
  const t = new Date(now).getTime();
  if (!form.isActive) return 'closed';
  if (form.closesAt !== null && t >= new Date(form.closesAt).getTime())
    return 'closed';
  if (form.opensAt !== null && t < new Date(form.opensAt).getTime())
    return 'scheduled';
  return 'open';
}
