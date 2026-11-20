/*
 * Kelola › Form's rules, with no React and no requests: the builder's list of sections and questions and the API's
 * shape it is saved in, the kinds of question, "Tampilkan jika", the edits that lose answers, the nudge, the checks
 * before Terbitkan, the short name, and the words each list row shows. The server decides every one of them again
 * (apps/api/src/lib/form-rules.ts); tests/kelola-form-rules.test.ts holds the mirrors to it.
 */
import type {
  FormDetail,
  FormQuestion,
  FormSection,
  ManageForm,
  ManageFormListItem,
  ProfileField,
} from '~/api/generated';
import { kelolaForm as copy } from '~/copy/kelola-form';
import { fill } from '~/copy/fill';
import { tanggal } from '~/copy/tanggal';
import { dLong, hm, wib } from '~/lib/dates';

export type QuestionKind = FormQuestion['type'];

/** The kinds in the type menu's order, in its groups (a line between groups). */
export const KIND_GROUPS: readonly (readonly QuestionKind[])[] = [
  ['text', 'textarea'],
  ['radio', 'checkbox', 'dropdown'],
  ['rating', 'date', 'time'],
  ['file'],
];

const CHOICE: readonly QuestionKind[] = ['radio', 'checkbox', 'dropdown'];
export const isChoice = (kind: QuestionKind) => CHOICE.includes(kind);
/** "Lainnya" is offered on Pilihan ganda and Kotak centang only. */
export const offersOther = (kind: QuestionKind) =>
  kind === 'radio' || kind === 'checkbox';

/** Kind changes that keep the answers already sent (the API's `keepsAnswers`). */
const KEEPS: Partial<Record<QuestionKind, readonly QuestionKind[]>> = {
  text: ['textarea'],
  textarea: ['text'],
  radio: ['dropdown', 'checkbox'],
  dropdown: ['radio', 'checkbox'],
};
export const keepsAnswers = (from: QuestionKind, to: QuestionKind) =>
  from === to || (KEEPS[from] ?? []).includes(to);

/* ---------------- The builder's list ---------------- */

export interface SectionItem {
  kind: 'section';
  id: string;
  title: string;
  description?: string;
}

export interface QuestionItem {
  kind: 'q';
  id: string;
  type: QuestionKind;
  label: string;
  /** undefined: no description line; '' : the line is shown, empty. */
  description?: string;
  /** Objects, so the option list is a field array. Kept when the kind changes, so changing back restores them. */
  options: { value: string }[];
  other: boolean;
  scale: { min: number; max: number; minLabel: string; maxLabel: string };
  dependsOn: { questionId: string; value: string } | null;
  required: boolean;
  prefill?: FormQuestion['prefill'];
}

export type BuilderItem = SectionItem | QuestionItem;

const DEFAULT_SCALE = { min: 1, max: 5, minLabel: '', maxLabel: '' };

/** The form's sections as one list, sections and questions in order, as the builder shows and reorders them. */
export function toItems(sections: readonly FormSection[]): BuilderItem[] {
  const out: BuilderItem[] = [];
  for (const s of sections) {
    out.push({
      kind: 'section',
      id: s.id,
      title: s.title,
      ...(s.description !== undefined ? { description: s.description } : {}),
    });
    for (const q of s.questions)
      out.push({
        kind: 'q',
        id: q.id,
        type: q.type,
        label: q.label,
        ...(q.description !== undefined ? { description: q.description } : {}),
        options: (q.options ?? []).map((value) => ({ value })),
        other: !!q.other,
        scale: {
          ...DEFAULT_SCALE,
          ...(q.scale
            ? {
                min: q.scale.min,
                max: q.scale.max,
                minLabel: q.scale.minLabel ?? '',
                maxLabel: q.scale.maxLabel ?? '',
              }
            : {}),
        },
        dependsOn: q.dependsOn ?? null,
        required: !q.optional,
        ...(q.prefill ? { prefill: q.prefill } : {}),
      });
  }
  return out;
}

/** The list back in the API's shape: only what each kind may carry (an option list only on a choice question). */
export function toSections(items: readonly BuilderItem[]): FormSection[] {
  const out: FormSection[] = [];
  for (const it of items) {
    if (it.kind === 'section') {
      out.push({
        id: it.id,
        title: it.title,
        ...(it.description ? { description: it.description } : {}),
        questions: [],
      });
      continue;
    }
    const q: FormQuestion = { id: it.id, label: it.label, type: it.type };
    if (it.description !== undefined && it.description !== '')
      q.description = it.description;
    if (isChoice(it.type)) q.options = it.options.map((o) => o.value);
    if (it.other && offersOther(it.type)) q.other = true;
    if (it.type === 'rating')
      q.scale = {
        min: it.scale.min,
        max: it.scale.max,
        ...(it.scale.minLabel.trim() ? { minLabel: it.scale.minLabel } : {}),
        ...(it.scale.maxLabel.trim() ? { maxLabel: it.scale.maxLabel } : {}),
      };
    if (it.dependsOn) q.dependsOn = it.dependsOn;
    if (!it.required) q.optional = true;
    if (it.prefill) q.prefill = it.prefill;
    out[out.length - 1]?.questions.push(q);
  }
  return out;
}

const randomId = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

/** A new question: Pilihan ganda with "Opsi 1", required, as Google Forms starts one. */
export function newQuestion(): QuestionItem {
  return {
    kind: 'q',
    id: randomId('q'),
    type: 'radio',
    label: '',
    options: [{ value: 'Opsi 1' }],
    other: false,
    scale: { ...DEFAULT_SCALE },
    dependsOn: null,
    required: true,
  };
}

export const newSection = (): SectionItem => ({
  kind: 'section',
  id: randomId('s'),
  title: '',
});

/** A copy under a new id, right below; its options and rule come along. */
export function duplicateQuestion(q: QuestionItem): QuestionItem {
  return {
    ...q,
    id: randomId('q'),
    options: q.options.map((o) => ({ ...o })),
    scale: { ...q.scale },
    dependsOn: q.dependsOn ? { ...q.dependsOn } : null,
    prefill: undefined,
  };
}

/** A question with a new kind: a choice gets "Opsi 1" if it had no options, a Dropdown loses "Lainnya". */
export function withKind(q: QuestionItem, kind: QuestionKind): QuestionItem {
  return {
    ...q,
    type: kind,
    options:
      isChoice(kind) && q.options.length === 0
        ? [{ value: 'Opsi 1' }]
        : q.options,
    other: offersOther(kind) ? q.other : false,
  };
}

export const questionsOf = (items: readonly BuilderItem[]) =>
  items.filter((x): x is QuestionItem => x.kind === 'q');

/** The choice questions above `id`: the ones "Tampilkan jika" may depend on. */
export function earlierChoices(
  items: readonly BuilderItem[],
  id: string,
): QuestionItem[] {
  const qs = questionsOf(items);
  const i = qs.findIndex((q) => q.id === id);
  return qs.slice(0, Math.max(0, i)).filter((q) => isChoice(q.type));
}

/**
 * Lets go of every "Tampilkan jika" whose deciding question is gone, no longer above it, no longer a choice, or no
 * longer offers the deciding answer. Returns the list and how many rules went, so the builder can say so.
 */
export function fixRules(items: readonly BuilderItem[]): {
  items: BuilderItem[];
  dropped: number;
} {
  let dropped = 0;
  const seen = new Map<string, QuestionItem>();
  const out = items.map((it) => {
    if (it.kind !== 'q') return it;
    let next = it;
    if (it.dependsOn) {
      const src = seen.get(it.dependsOn.questionId);
      const ok =
        src &&
        isChoice(src.type) &&
        src.options.some((o) => o.value === it.dependsOn!.value);
      if (!ok) {
        dropped++;
        next = { ...it, dependsOn: null };
      }
    }
    seen.set(next.id, next);
    return next;
  });
  return { items: out, dropped };
}

/** The places of options written twice in one question (the second and later ones): the server refuses them. */
export function repeatedOptions(q: Pick<QuestionItem, 'options'>): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  q.options.forEach((o, i) => {
    const v = o.value;
    if (!v.trim()) return;
    if (seen.has(v)) out.push(i);
    seen.add(v);
  });
  return out;
}

/** Whether the list can be saved as it stands: no option written twice, and no option named as "Lainnya" is kept. */
export function canSave(items: readonly BuilderItem[]): boolean {
  return questionsOf(items).every(
    (q) =>
      !isChoice(q.type) ||
      (repeatedOptions(q).length === 0 &&
        q.options.every((o) => o.value !== '__other')),
  );
}

/** Moves one item; nothing goes above the first section's title. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const target = Math.max(1, Math.min(out.length - 1, to));
  const [x] = out.splice(from, 1);
  out.splice(target, 0, x!);
  return out;
}

/* ---------------- Edits that lose answers ---------------- */

export type Breaking =
  | { kind: 'del'; questionId: string }
  | { kind: 'type'; questionId: string; to: QuestionKind };

/** Whether this edit loses answers already sent, so the builder asks first. Only a form with answers asks. */
export function asksFirst(
  responseCount: number,
  edit: Breaking,
  from?: QuestionKind,
) {
  if (responseCount <= 0) return false;
  if (edit.kind === 'del') return true;
  return !keepsAnswers(from ?? edit.to, edit.to);
}

/* ---------------- The nudge ---------------- */

/** Words in a question that ask for something the profile already has (the prototype's NUDGES). */
const NUDGES: readonly (readonly [ProfileField, RegExp])[] = [
  ['fullName', /^nama( lengkap)?\b/],
  ['nim', /\bnim\b/],
  ['major', /jurusan|prodi|program studi/],
  ['angkatan', /angkatan/],
  ['campus', /kampus (mana|ganesha|jatinangor)|ganesha atau jatinangor/],
  ['email', /e-?mail/],
  ['emergencyContact', /kontak darurat|nomor darurat/],
  ['whatsapp', /whats\s?app|\bwa\b|no(mor)?\.? ?(hp|telepon|telp)/],
  ['line', /\bline\b/],
  ['instagram', /instagram|\big\b/],
  ['hometown', /kota asal|asal daerah|asal kota/],
  ['address', /alamat|domisili|\bkos\b/],
  ['health', /riwayat penyakit|kondisi kesehatan|alergi/],
  ['birthDate', /tanggal lahir/],
  ['studentCardPhoto', /\bktm\b/],
  ['photo', /pas foto|foto diri/],
];

/** The profile field a question's wording asks for, if any. */
export function nudgeFor(label: string): ProfileField | null {
  const t = label.toLowerCase();
  return NUDGES.find(([, re]) => re.test(t))?.[0] ?? null;
}

/* ---------------- Profile fields ---------------- */

export const FIELD_GROUPS: readonly (readonly [
  keyof typeof copy.profil.grup,
  readonly ProfileField[],
])[] = [
  ['akun', ['fullName', 'nim', 'major', 'angkatan', 'campus', 'email']],
  ['kontak', ['whatsapp', 'line', 'instagram']],
  ['alamat', ['address', 'hometown']],
  ['darurat', ['emergencyContact', 'health']],
  ['dokumen', ['birthDate', 'studentCardPhoto', 'photo']],
];
/** The fields the builder marks with a lock and "sensitif". */
export const SENSITIVE_FIELDS: readonly ProfileField[] = [
  'address',
  'emergencyContact',
  'health',
  'birthDate',
  'studentCardPhoto',
];
const FIELD_ORDER = FIELD_GROUPS.flatMap(([, f]) => f);
/** Requested fields in the list's order, whatever order they were ticked in. */
export const inFieldOrder = (fields: readonly ProfileField[]) =>
  FIELD_ORDER.filter((f) => fields.includes(f));
export const fieldLabel = (f: ProfileField) => copy.profil.field[f];

/* ---------------- Angkatan and dates ---------------- */

type AngkatanName = { year: number; name: string | null };

/** "2025 · PIXEL", or the year alone when it has no name. */
export function angkatanName(year: number, list?: readonly AngkatanName[]) {
  const name = list?.find((a) => a.year === year)?.name?.trim();
  return name && name !== String(year) ? `${year} · ${name}` : String(year);
}

/** "Angkatan 2025 · PIXEL", "Angkatan 2023, 2024, 2025 · PIXEL", or "Belum ada angkatan". */
export function audienceLabel(
  years: readonly number[],
  list?: readonly AngkatanName[],
  lower = false,
) {
  if (!years.length) return copy.belumAdaAngkatan;
  const daftar = [...years]
    .sort((a, b) => a - b)
    .map((y) => angkatanName(y, list))
    .join(', ');
  return fill(lower ? copy.angkatanKecil : copy.angkatan, { daftar });
}

/** The angkatan Setelan offers: the three newest, and any the form already has. */
export function angkatanChoices(
  list: readonly AngkatanName[],
  selected: readonly number[],
): number[] {
  const newest = [...list.map((a) => a.year)].sort((a, b) => b - a).slice(0, 3);
  return [...new Set([...newest, ...selected])].sort((a, b) => a - b);
}

/** "Min, 18 Okt · 23.59" */
export function whenShort(at: string | Date) {
  return `${dayShort(at)} · ${hm(at)}`;
}
/** "Min, 4 Okt" */
export function dayShort(at: string | Date) {
  const w = wib(at);
  return `${tanggal.hariPendek[w.weekday]}, ${w.day} ${tanggal.bulanPendek[w.month]}`;
}

/* ---------------- The list of forms ---------------- */

/** The caption under a form's title: its audience and the one date that matters, or the question count of a draft. */
export function rowCaption(
  f: Pick<
    ManageFormListItem,
    'status' | 'eligibleAngkatan' | 'opensAt' | 'closesAt' | 'questionCount'
  >,
  list?: readonly AngkatanName[],
): string {
  const when =
    f.status === 'open'
      ? f.closesAt
        ? fill(copy.daftar.tutup, { waktu: whenShort(f.closesAt) })
        : copy.daftar.tanpaBatas
      : f.status === 'scheduled'
        ? fill(copy.daftar.buka, { waktu: whenShort(f.opensAt!) })
        : f.status === 'closed'
          ? f.closesAt
            ? fill(copy.daftar.ditutup, { hari: dayShort(f.closesAt) })
            : copy.status.ditutup.toLowerCase()
          : fill(copy.daftar.pertanyaan, { jumlah: f.questionCount });
  return [
    f.eligibleAngkatan.length ? audienceLabel(f.eligibleAngkatan, list) : '',
    when,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Buatanku (made by them) and Dibagikan ke aku (shared with them); admin's other forms appear only in Semua form. */
export function splitForms<T extends Pick<ManageFormListItem, 'access'>>(
  forms: readonly T[],
) {
  return {
    mine: forms.filter((f) => f.access.role === 'owner'),
    shared: forms.filter(
      (f) => f.access.role === 'edit' || f.access.role === 'view',
    ),
  };
}

/** What a shared form lets this pengurus do, as its row says it: admin may edit any form, so theirs read "Bisa edit". */
export const sharedAs = (f: Pick<ManageFormListItem, 'access'>) =>
  f.access.canEdit ? ('edit' as const) : ('view' as const);

/* ---------------- Terbitkan ---------------- */

export interface PublishCheck {
  ok: boolean;
  text: string;
  /** A hint, not a problem: the nudge. */
  note?: boolean;
}

/** The dialog's checks, in the server's order, plus the nudge as a note. `ok` all true: Terbitkan may go. */
export function publishChecks(
  form: Pick<ManageForm, 'title' | 'eligibleAngkatan' | 'opensAt' | 'closesAt'>,
  items: readonly BuilderItem[],
  list: readonly AngkatanName[] | undefined,
  now: number = Date.now(),
): PublishCheck[] {
  const qs = questionsOf(items);
  const out: PublishCheck[] = [];
  const title = form.title.trim();
  out.push({
    ok: !!title,
    text: title ? copy.terbitkan.judulTerisi : copy.terbitkan.belumJudul,
  });
  const unwritten = qs.filter((q) => !q.label.trim()).length;
  out.push({
    ok: qs.length > 0 && !unwritten,
    text: !qs.length
      ? copy.terbitkan.belumPertanyaan
      : unwritten
        ? fill(copy.terbitkan.belumDitulis, { jumlah: unwritten })
        : fill(copy.terbitkan.pertanyaanWajib, {
            jumlah: qs.length,
            wajib: qs.filter((q) => q.required).length,
          }),
  });
  const thin = qs.filter(
    (q) =>
      isChoice(q.type) && q.options.filter((o) => o.value.trim()).length < 2,
  ).length;
  if (thin)
    out.push({
      ok: false,
      text: fill(copy.terbitkan.satuOpsi, { jumlah: thin }),
    });
  out.push({
    ok: form.eligibleAngkatan.length > 0,
    text: form.eligibleAngkatan.length
      ? fill(copy.terbitkan.untuk, {
          angkatan: audienceLabel(form.eligibleAngkatan, list, true),
        })
      : copy.terbitkan.pilihAngkatan,
  });
  if (form.closesAt) {
    const closes = Date.parse(form.closesAt);
    const opens = form.opensAt ? Date.parse(form.opensAt) : now;
    if (closes <= now) out.push({ ok: false, text: copy.terbitkan.sudahLewat });
    else if (closes <= opens)
      out.push({ ok: false, text: copy.terbitkan.tutupSebelumBuka });
  }
  const asks = qs.find((q) => nudgeFor(q.label));
  if (asks)
    out.push({
      ok: true,
      note: true,
      text: fill(copy.terbitkan.nudge, { pertanyaan: asks.label }),
    });
  return out;
}

/* ---------------- The short name ---------------- */

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
export type SlugProblem = keyof typeof copy.tautan.masalah;

/** Capitals become lower case and spaces or underscores hyphens, while typing. */
export const tidySlug = (v: string) => v.toLowerCase().replace(/[\s_]+/g, '-');

/** What the server would refuse in the name, before asking it whether another form holds it. */
export function slugProblem(
  slug: string,
): Exclude<SlugProblem, 'taken'> | null {
  if (slug.length < SLUG_MIN) return 'too_short';
  if (slug.length > SLUG_MAX) return 'too_long';
  if (/[^a-z0-9-]/.test(slug)) return 'characters';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'hyphens';
  return null;
}

/** The form's address, as members open it. */
export const LINK_HOST = 'app.hmif.dev/f/';
export const linkOf = (slug: string) => `https://${LINK_HOST}${slug}`;

/* ---------------- Jawaban ---------------- */

/** A bar's share of the responses, whole percent. */
export const percentOf = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 100) : 0;

/** A date answer as "Senin, 19 Oktober 2026" and a time as "19.30". */
export function answerWords(
  kind: QuestionKind,
  answer: string | string[],
  other: string | undefined,
  scaleMax?: number,
): string {
  const one = (v: string) =>
    v === '__other'
      ? fill(copy.jawaban.lainnyaJawaban, { teks: other ?? '–' })
      : v;
  if (Array.isArray(answer)) return answer.map(one).join(', ');
  if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(answer)) {
    const d = `${answer}T00:00:00+07:00`;
    return `${dLong(d)} ${answer.slice(0, 4)}`;
  }
  if (kind === 'time') return answer.replace(':', '.');
  if (kind === 'rating' && scaleMax)
    return fill(copy.jawaban.dariSkala, { nilai: answer, maks: scaleMax });
  return one(answer);
}

/** A file answer's name: the last part of its address. */
export const fileName = (url: string) =>
  decodeURIComponent(url.split('?')[0]!.split('/').pop() ?? url);

/**
 * The form as a member opens it, for Pratinjau: open now with every question, whatever its state, its schedule or its
 * audience, so the maker can fill it before it is published.
 */
export function previewDetail(f: ManageForm): FormDetail {
  return {
    id: f.id,
    slug: f.slug,
    title: f.title.trim() || copy.daftar.tanpaJudul,
    description: f.description,
    eligibleAngkatan: f.eligibleAngkatan,
    opensAt: f.opensAt ?? f.createdAt,
    closesAt: f.closesAt,
    isActive: true,
    order: 0,
    createdAt: f.createdAt,
    requestedFields: f.requestedFields,
    allowEdit: f.allowEdit,
    sections: f.sections,
    status: 'open',
    thanks: f.thanks,
    owner: f.owner ? { fullName: f.owner.fullName } : null,
    canChange: false,
  };
}
