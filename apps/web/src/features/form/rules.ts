/**
 * The member's side of a form made in the builder, with no screen: which questions show, what counts as answered, what
 * goes to the server, how a sent answer reads, the list's order, and the profile fields a form may request (Data diri).
 * The server's own rules are in apps/api/src/lib/form-answers.ts and member-details.ts; `tests/form-rules.test.ts`
 * holds these to them, so what the screen calls complete is what the server accepts.
 */
import type {
  FormAnswer,
  FormListItem,
  FormQuestion,
  FormSection,
  MyDetails,
  ProfileValues,
  SavedDetails,
} from '~/api/generated';
import { fill } from '~/copy/fill';
import { isi } from '~/copy/isi';
import { tanggal } from '~/copy/tanggal';
import { dayDiff, hm, wib } from '~/lib/dates';

/* ================= Questions and answers ================= */

/** "Lainnya", as the API stores it among the options. */
export const OTHER = '__other';

export type AnswerValue = string | string[];
/** What the member has typed or chosen: answers by question id, and each "Lainnya" line by question id. */
export interface FillValues {
  a: Record<string, AnswerValue>;
  o: Record<string, string>;
}

/** A question moves on by itself once chosen (Pilihan ganda, Skala linier, Dropdown, Tanggal); the rest wait for Oke. */
export const MOVES_ON: readonly FormQuestion['type'][] = [
  'radio',
  'rating',
  'dropdown',
  'date',
];

export const questionsOf = (sections: readonly FormSection[]) =>
  sections.flatMap((s) => s.questions);

/** The ids of every question shown with these answers, in order (a condition on a hidden question hides it too). */
export function shownIds(
  sections: readonly FormSection[],
  a: FillValues['a'],
): Set<string> {
  const shown = new Set<string>();
  for (const q of questionsOf(sections)) {
    if (q.dependsOn) {
      const { questionId, value } = q.dependsOn;
      if (!shown.has(questionId)) continue;
      const v = a[questionId];
      if (!(Array.isArray(v) ? v.includes(value) : v === value)) continue;
    }
    shown.add(q.id);
  }
  return shown;
}

/** "19.30" or "19:30" as the server's "19:30"; null when it isn't a time. */
export function timeToSend(v: string): string | null {
  const m = /^([01]\d|2[0-3])[.:]([0-5]\d)$/.exec(v.trim());
  return m ? `${m[1]}:${m[2]}` : null;
}

/** What the member types into a time answer, as they type it: digits only, "1930" → "19.30". */
export function tidyTime(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}.${n.slice(2)}` : n;
}

/** What the member types into a birth date: "14032007" → "14/03/2007". */
export function tidyDate(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 8);
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4)].filter(Boolean).join('/');
}

/** Whether a question has an answer the server would accept as one. */
export function isAnswered(q: FormQuestion, values: FillValues): boolean {
  const v = values.a[q.id];
  const other = (values.o[q.id] ?? '').trim() !== '';
  if (Array.isArray(v)) return v.length > 0 && (!v.includes(OTHER) || other);
  if (v === undefined || v === '') return false;
  if (v === OTHER) return other;
  if (q.type === 'time') return timeToSend(v) !== null;
  return v.trim() !== '';
}

/** The required questions shown and not answered, in order. */
export function missingRequired(
  sections: readonly FormSection[],
  values: FillValues,
): string[] {
  const shown = shownIds(sections, values.a);
  return questionsOf(sections)
    .filter((q) => shown.has(q.id) && !q.optional && !isAnswered(q, values))
    .map((q) => q.id);
}

/** The answers as the server takes them: only questions shown and answered, times as "19:30", "Lainnya" with its words. */
export function answersToSend(
  sections: readonly FormSection[],
  values: FillValues,
): FormAnswer[] {
  const shown = shownIds(sections, values.a);
  const out: FormAnswer[] = [];
  for (const q of questionsOf(sections)) {
    if (!shown.has(q.id) || !isAnswered(q, values)) continue;
    const v = values.a[q.id];
    const answer =
      typeof v !== 'string'
        ? v
        : q.type === 'time'
          ? (timeToSend(v) as string)
          : v.trim();
    const choseOther = Array.isArray(v) ? v.includes(OTHER) : v === OTHER;
    out.push(
      choseOther
        ? { questionId: q.id, answer, other: values.o[q.id].trim() }
        : { questionId: q.id, answer },
    );
  }
  return out;
}

/** The values to start from: nothing, a draft, or what was sent (Ubah jawaban), times back as "19.30". */
export function startingValues(
  sections: readonly FormSection[],
  from?: { answers?: FormAnswer[]; draft?: FillValues | null },
): FillValues {
  const values: FillValues = { a: {}, o: {} };
  for (const q of questionsOf(sections))
    values.a[q.id] = q.type === 'checkbox' ? [] : '';
  if (from?.draft) {
    for (const [id, v] of Object.entries(from.draft.a)) {
      const q = questionsOf(sections).find((x) => x.id === id);
      if (!q) continue;
      if (q.type === 'checkbox' ? Array.isArray(v) : typeof v === 'string')
        values.a[id] = v;
    }
    Object.assign(values.o, from.draft.o);
  }
  for (const ans of from?.answers ?? []) {
    const q = questionsOf(sections).find((x) => x.id === ans.questionId);
    if (!q) continue;
    values.a[q.id] =
      q.type === 'time' && typeof ans.answer === 'string'
        ? ans.answer.replace(':', '.')
        : ans.answer;
    if (ans.other !== undefined) values.o[q.id] = ans.other;
  }
  return values;
}

/** A draft as the device keeps it (`lib/form/draft-store.ts`): answers by id, each "Lainnya" line under `<id>::lainnya`. */
const OTHER_KEY = '::lainnya';
export function draftOf(values: FillValues): Record<string, AnswerValue> {
  const out: Record<string, AnswerValue> = {};
  for (const [k, v] of Object.entries(values.a))
    if (Array.isArray(v) ? v.length : v) out[k] = v;
  for (const [k, v] of Object.entries(values.o))
    if (v) out[`${k}${OTHER_KEY}`] = v;
  return out;
}
export function valuesOfDraft(draft: Record<string, AnswerValue>): FillValues {
  const values: FillValues = { a: {}, o: {} };
  for (const [k, v] of Object.entries(draft)) {
    if (k.endsWith(OTHER_KEY)) {
      if (typeof v === 'string') values.o[k.slice(0, -OTHER_KEY.length)] = v;
    } else values.a[k] = v;
  }
  return values;
}

/** The name a member gave a stored file, from its address (`<id>-<name>.<ext>`), as the API reads it. */
export function fileName(url: string): string {
  const path = url.split(/[?#]/)[0];
  let last = path.slice(path.lastIndexOf('/') + 1);
  try {
    last = decodeURIComponent(last);
  } catch {
    /* an address with a stray % keeps its letters */
  }
  const dash = last.indexOf('-');
  return dash < 0 ? last : last.slice(dash + 1);
}

/** "Selasa, 20 Oktober" for a date answer `2026-10-20`. */
export function dateAnswerText(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${tanggal.hari[d.getUTCDay()]}, ${d.getUTCDate()} ${tanggal.bulan[d.getUTCMonth()]}`;
}

/** How an answer reads on "Yang kamu kirim": choices joined, "Lainnya: …", "5 dari 5", a date in words, a file's name. */
export function answerText(
  q: FormQuestion,
  ans: FormAnswer | undefined,
): string {
  if (!ans) return '';
  const one = (v: string) =>
    v === OTHER ? fill(isi.terkirim.lainnya, { isi: ans.other ?? '' }) : v;
  const v = ans.answer;
  if (Array.isArray(v)) return v.map(one).join(', ');
  if (!v) return '';
  if (q.type === 'rating')
    return fill(isi.terkirim.dariSkala, { angka: v, maks: q.scale?.max ?? 5 });
  if (q.type === 'date') return dateAnswerText(v);
  if (q.type === 'time') return v.replace(':', '.');
  if (q.type === 'file') return fileName(v);
  return one(v);
}

/* ================= Times ================= */

/** "Min, 18 Okt · 23.59": a form's closing or opening time. */
export function whenShort(at: string | number): string {
  const w = wib(at);
  return `${tanggal.hariPendek[w.weekday]}, ${w.day} ${tanggal.bulanPendek[w.month]} · ${hm(at)}`;
}

/** "Min, 4 Okt": the day alone. */
export function dayShort(at: string | number): string {
  const w = wib(at);
  return `${tanggal.hariPendek[w.weekday]}, ${w.day} ${tanggal.bulanPendek[w.month]}`;
}

/** How long until a time: "besok", "4 hari lagi", "2 jam 5 menit lagi". */
export function untilText(at: string | number, now: number): string {
  const mins = Math.round((new Date(at).getTime() - now) / 60_000);
  const k = isi.keadaan;
  if (mins <= 0) return k.sebentarLagi;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const days = dayDiff(at, now);
    return days === 1 ? k.besok : fill(k.hariLagi, { jumlah: days });
  }
  if (h && m) return fill(k.jamMenitLagi, { jam: h, menit: m });
  if (h) return fill(k.jamLagi, { jam: h });
  return fill(k.menitLagi, { menit: m });
}

/** "angkatan 2023, 2024, 2025": who a form is for. */
export function audienceText(years: readonly number[]): string {
  return fill(isi.keadaan.angkatan, { tahun: [...years].sort().join(', ') });
}

/* ================= The list ================= */

/** A list row's state: open (Isi sekarang or Lanjutkan), soon, done, closed. */
export type RowState = 'open' | 'soon' | 'done' | 'closed';
export function rowState(f: Pick<FormListItem, 'status'>): RowState {
  return f.status === 'already_responded'
    ? 'done'
    : f.status === 'not_opened'
      ? 'soon'
      : f.status === 'closed'
        ? 'closed'
        : 'open';
}
const ORDER: Record<RowState, number> = {
  open: 0,
  soon: 1,
  done: 2,
  closed: 3,
};
/** Open first, then soon, sent and closed, keeping the server's order inside each. */
export function sortRows<F extends Pick<FormListItem, 'status'>>(
  forms: readonly F[],
): F[] {
  return forms
    .map((f, i) => ({ f, i }))
    .sort((x, y) => ORDER[rowState(x.f)] - ORDER[rowState(y.f)] || x.i - y.i)
    .map((x) => x.f);
}

/* ================= Profile fields (Data diri) ================= */

export type ProfileField = keyof ProfileValues & keyof typeof isi.bidang;
export type SavedField = keyof SavedDetails;
export type FieldGroup = keyof typeof isi.grup;
/** How a saved detail is given: one line, a long text, a phone number, a birth date, a photo, or the emergency contact. */
export type FieldKind =
  'account' | 'text' | 'long' | 'tel' | 'date' | 'file' | 'contact';

export interface FieldInfo {
  key: ProfileField;
  group: FieldGroup;
  kind: FieldKind;
  /** Shown with a lock and "sensitif" in the builder; only a flag here. */
  sensitive?: boolean;
}

/** Every field a form may request, in the API's order (`PROFILE_FIELDS`), with the prototype's groups. */
export const FIELDS: readonly FieldInfo[] = [
  { key: 'fullName', group: 'akun', kind: 'account' },
  { key: 'nim', group: 'akun', kind: 'account' },
  { key: 'major', group: 'akun', kind: 'account' },
  { key: 'angkatan', group: 'akun', kind: 'account' },
  { key: 'campus', group: 'akun', kind: 'account' },
  { key: 'email', group: 'akun', kind: 'account' },
  { key: 'whatsapp', group: 'kontak', kind: 'tel' },
  { key: 'line', group: 'kontak', kind: 'text' },
  { key: 'instagram', group: 'kontak', kind: 'text' },
  { key: 'address', group: 'alamat', kind: 'long', sensitive: true },
  { key: 'hometown', group: 'alamat', kind: 'text' },
  {
    key: 'emergencyContact',
    group: 'darurat',
    kind: 'contact',
    sensitive: true,
  },
  { key: 'health', group: 'darurat', kind: 'long', sensitive: true },
  { key: 'birthDate', group: 'dokumen', kind: 'date', sensitive: true },
  { key: 'studentCardPhoto', group: 'dokumen', kind: 'file', sensitive: true },
  { key: 'photo', group: 'dokumen', kind: 'file' },
];
export const SAVED: readonly SavedField[] = FIELDS.filter(
  (f) => f.kind !== 'account',
).map((f) => f.key as SavedField);
export const fieldInfo = (key: ProfileField) =>
  FIELDS.find((f) => f.key === key) as FieldInfo;
export const isSaved = (key: ProfileField): key is SavedField =>
  fieldInfo(key).kind !== 'account';
/** The requested fields in the API's order. */
export const requestedInOrder = (fields: readonly string[]) =>
  FIELDS.filter((f) => fields.includes(f.key));

export const RELATIONS = ['Ayah', 'Ibu', 'Wali', 'Saudara', 'Lainnya'] as const;
export type Relation = (typeof RELATIONS)[number];

/** "14 Maret 2007" for a birth date `2007-03-14`. */
export function birthDateText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${+m[3]} ${tanggal.bulan[+m[2] - 1]} ${m[1]}` : iso;
}

/** How a field reads, from a value the server sent with a response (`profile`). */
export function sentFieldText(key: ProfileField, value: string): string {
  const kind = fieldInfo(key).kind;
  if (kind === 'date') return birthDateText(value);
  if (kind === 'file') return fileName(value);
  return value;
}

/** How a field reads from the member's details, or '' when they haven't given it. */
export function fieldText(key: ProfileField, details: MyDetails): string {
  const acc = details.account;
  switch (key) {
    case 'fullName':
      return acc.fullName;
    case 'nim':
      return acc.nim;
    case 'major':
      return acc.major;
    case 'angkatan':
      return acc.angkatan;
    case 'campus':
      return acc.campus;
    case 'email':
      return acc.email;
    case 'emergencyContact': {
      const c = details.saved.emergencyContact;
      return c ? `${c.name} (${c.relation.toLowerCase()}) · ${c.phone}` : '';
    }
    default: {
      const v = details.saved[key];
      return v ? sentFieldText(key, v) : '';
    }
  }
}

/** How many of the ten saved details are given: Profil's "3 dari 10 terisi". */
export const filledCount = (saved: SavedDetails) =>
  SAVED.filter((k) => saved[k] !== null).length;

/* ---- Editing one saved detail ---- */

/** A saved detail as its editor holds it: text for most, a birth date as "14/03/2007", the contact in three parts. */
export type DraftValue =
  string | { name: string; relation: Relation | ''; phone: string };

/** The editor's starting value from what is saved. */
export function draftFromSaved(
  key: SavedField,
  saved: SavedDetails,
): DraftValue {
  if (key === 'emergencyContact') {
    const c = saved.emergencyContact;
    return {
      name: c?.name ?? '',
      relation: c?.relation ?? '',
      phone: c?.phone ?? '',
    };
  }
  const v = saved[key] ?? '';
  if (key === 'birthDate' && v) {
    const [y, mo, d] = v.split('-');
    return `${d}/${mo}/${y}`;
  }
  return v;
}

/** A phone number: digits with spaces, dashes, dots or a leading +, at least nine digits (the API's `phoneOk`). */
export const phoneOk = (v: string) =>
  /^\+?[\d\s.-]+$/.test(v) &&
  v.replace(/\D/g, '').length >= 9 &&
  v.length <= 30;

/** "14/03/2007" as `2007-03-14` when it is a real date after 1950 and before `today` (`YYYY-MM-DD`); else null. */
export function birthDateToSend(v: string, today: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const real = d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1];
  return real && +m[3] > 1950 && iso < today ? iso : null;
}

/** The longest text a saved detail may be (the API's `FORM_LIMITS.detail`). */
export const DETAIL_MAX = 1000;

/** Why a detail's editor can't be saved as it is, in the words the screen says it. */
export type DetailReason = keyof typeof isi.alasan;

/**
 * The value to send for an edited detail, or why it can't go. `today` is `YYYY-MM-DD` in WIB, for the birth date.
 * A photo is sent as its address once uploaded.
 */
export function detailToSend(
  key: SavedField,
  draft: DraftValue,
  today: string,
):
  | { ok: true; value: SavedDetails[SavedField] }
  | { ok: false; reason: DetailReason } {
  const kind = fieldInfo(key).kind;
  if (kind === 'contact') {
    const c = draft as Exclude<DraftValue, string>;
    if (!c.name.trim() || !c.relation || !phoneOk(c.phone.trim()))
      return { ok: false, reason: 'kontak' };
    if (c.name.trim().length > 200) return { ok: false, reason: 'panjang' };
    return {
      ok: true,
      value: {
        name: c.name.trim(),
        relation: c.relation,
        phone: c.phone.trim(),
      },
    };
  }
  const v = (draft as string).trim();
  if (kind === 'file')
    return v ? { ok: true, value: v } : { ok: false, reason: 'file' };
  if (kind === 'date') {
    const iso = birthDateToSend(v, today);
    return iso ? { ok: true, value: iso } : { ok: false, reason: 'tanggal' };
  }
  if (kind === 'tel')
    return phoneOk(v) ? { ok: true, value: v } : { ok: false, reason: 'nomor' };
  if (!v) return { ok: false, reason: 'isi' };
  if (v.length > DETAIL_MAX) return { ok: false, reason: 'panjang' };
  return { ok: true, value: v };
}

/** The reason a field's editor shows when it can't be sent, as the prototype words each kind. */
export function reasonFor(key: SavedField): DetailReason {
  const kind = fieldInfo(key).kind;
  return kind === 'contact'
    ? 'kontak'
    : kind === 'tel'
      ? 'nomor'
      : kind === 'date'
        ? 'tanggal'
        : kind === 'file'
          ? 'file'
          : 'isi';
}

/** The API's problem for a detail, as the reason the screen gives. */
export function reasonOfProblem(
  key: SavedField,
  problem: string,
): DetailReason {
  return problem === 'too_long' ? 'panjang' : reasonFor(key);
}

/** Today in WIB as `YYYY-MM-DD`. */
export function todayKey(now: number): string {
  const w = wib(now);
  return `${w.year}-${String(w.month + 1).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

/* ================= Files ================= */

/** A file answer: JPG, PNG or PDF, at most 5 MB (the prototype's words; the API checks the type too). */
export const ANSWER_FILE_TYPES = ['jpg', 'jpeg', 'png', 'pdf'];
/** Foto KTM and Foto diri: JPG or PNG. */
export const PHOTO_FILE_TYPES = ['jpg', 'jpeg', 'png'];
export const FILE_MAX_BYTES = 5 * 1024 * 1024;

export function fileFits(
  file: { name: string; size: number },
  types: readonly string[],
): boolean {
  const dot = file.name.lastIndexOf('.');
  const ext = dot < 0 ? '' : file.name.slice(dot + 1).toLowerCase();
  return types.includes(ext) && file.size <= FILE_MAX_BYTES;
}

/** A choice made right after an arrow key moved through a question's options stays put; any other choice moves on. */
export const ARROW_HOLD_MS = 400;
/** When no arrow key has been pressed: never, so a choice in the page's first moments moves on too. */
export const NO_ARROW_YET = Number.NEGATIVE_INFINITY;
export const choiceMovesOn = (now: number, lastArrowAt: number) =>
  now - lastArrowAt >= ARROW_HOLD_MS;
