/**
 * What a form is made of, with no database and no HTTP, so the API, its tests and the web app's pretend API share one
 * description (docs/forms-api.md, docs/adr/0023-*). The stored JSON in `forms.sections` and `form_responses.answers`
 * has these shapes.
 */

/**
 * The kinds of question, by the names stored since the first form. On screen: `text` Jawaban singkat, `textarea`
 * Paragraf, `radio` Pilihan ganda, `checkbox` Kotak centang, `dropdown` Dropdown, `rating` Skala linier, `date`
 * Tanggal, `time` Waktu, `file` Unggah file.
 */
export const QUESTION_TYPES = [
  'text',
  'textarea',
  'radio',
  'checkbox',
  'dropdown',
  'rating',
  'date',
  'time',
  'file',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** The kinds whose answer is one or more of the question's options. */
export const CHOICE_TYPES: readonly QuestionType[] = [
  'radio',
  'checkbox',
  'dropdown',
];
/** The kinds that may offer "Lainnya" (a line the member writes). */
export const OTHER_TYPES: readonly QuestionType[] = ['radio', 'checkbox'];

/** The answer that means "Lainnya" was chosen; the words are in the answer's `other`. No option may be named this. */
export const OTHER_ANSWER = '__other';

/** A linear scale: whole numbers from `min` (0 or 1) to `max` (2 to 10), with optional words at either end. */
export interface QuestionScale {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}
/** A scale with no `scale` set, as every rating before scales could be chosen. */
export const DEFAULT_SCALE: QuestionScale = { min: 1, max: 5 };

export interface FormQuestion {
  id: string;
  label: string;
  type: QuestionType;
  /** Under the question: a hint, such as where to transfer the fee. */
  description?: string;
  options?: string[];
  /** "Lainnya" as a last option, with its own line (radio and checkbox). */
  other?: boolean;
  /** Only for `rating`; absent means 1 to 5. */
  scale?: QuestionScale;
  /**
   * "Tampilkan jika": shown, and required, only when the earlier choice question `questionId` was answered with
   * `value` (one of its options). Otherwise it is skipped and its answer is not kept.
   */
  dependsOn?: { questionId: string; value: string };
  /** Never required. */
  optional?: boolean;
  /** The PIXEL form's first two questions start with the member's own name or NIM; they may change it. */
  prefill?: 'fullName' | 'nim';
}

/** A section groups questions under a title; a form with one untitled section shows none. */
export interface FormSection {
  id: string;
  title: string;
  description?: string;
  questions: FormQuestion[];
}

/**
 * One answer. `answer` is a string (an option, the text, `YYYY-MM-DD` for a date, `HH:MM` for a time, the number of a
 * scale as text, a file's address in the app's storage) or, for a checkbox, a list of options. `OTHER_ANSWER` in it
 * means "Lainnya", and `other` holds what the member wrote.
 */
export interface FormAnswer {
  questionId: string;
  answer: string | string[];
  other?: string;
}

/**
 * The fields a form may request from a member's profile, in the order they are shown. The first six come from the
 * account (`users`) and are never typed; the rest are the member's saved details (`member_details`, Profil › Data
 * diri). Gender is not on the list: the owner decided forms cannot request it.
 */
export const PROFILE_FIELDS = [
  'fullName',
  'nim',
  'major',
  'angkatan',
  'campus',
  'email',
  'whatsapp',
  'line',
  'instagram',
  'address',
  'hometown',
  'emergencyContact',
  'health',
  'birthDate',
  'studentCardPhoto',
  'photo',
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const ACCOUNT_FIELDS: readonly ProfileField[] = [
  'fullName',
  'nim',
  'major',
  'angkatan',
  'campus',
  'email',
];
export type SavedField = Exclude<
  ProfileField,
  'fullName' | 'nim' | 'major' | 'angkatan' | 'campus' | 'email'
>;
export const SAVED_FIELDS = PROFILE_FIELDS.filter(
  (f) => !ACCOUNT_FIELDS.includes(f),
) as SavedField[];

/** A new form requests these until its maker unticks them. */
export const NEW_FORM_FIELDS: readonly ProfileField[] = ['fullName', 'nim'];

/** The column names of the export, and the labels the summary uses: the prototype's words. */
export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  fullName: 'Nama',
  nim: 'NIM',
  major: 'Program studi',
  angkatan: 'Angkatan',
  campus: 'Kampus',
  email: 'Email mahasiswa',
  whatsapp: 'Nomor WhatsApp',
  line: 'ID LINE',
  instagram: 'Instagram',
  address: 'Alamat selama kuliah',
  hometown: 'Kota asal',
  emergencyContact: 'Kontak darurat',
  health: 'Kondisi kesehatan',
  birthDate: 'Tanggal lahir',
  studentCardPhoto: 'Foto KTM',
  photo: 'Foto diri',
};

export const EMERGENCY_RELATIONS = [
  'Ayah',
  'Ibu',
  'Wali',
  'Saudara',
  'Lainnya',
] as const;
export type EmergencyRelation = (typeof EMERGENCY_RELATIONS)[number];

/** A member's saved details as the API sends them: null for one never given. */
export interface SavedDetails {
  whatsapp: string | null;
  line: string | null;
  instagram: string | null;
  address: string | null;
  hometown: string | null;
  emergencyContact: {
    name: string;
    relation: EmergencyRelation;
    phone: string;
  } | null;
  health: string | null;
  /** `YYYY-MM-DD`. */
  birthDate: string | null;
  /** Addresses in the app's storage. */
  studentCardPhoto: string | null;
  photo: string | null;
}

/** Who a form is shared with, and what they may do: see it and its answers, or also edit it. */
export const COLLABORATOR_ROLES = ['view', 'edit'] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

/** Sizes the server holds every form to. */
export const FORM_LIMITS = {
  title: 200,
  description: 2000,
  thanks: 200,
  sections: 30,
  questions: 200,
  label: 500,
  options: 50,
  option: 200,
  /** One text answer, or a "Lainnya" line. */
  answer: 5000,
  /** A saved detail typed as text; an address or a health note may be long. */
  detail: 1000,
} as const;

/** The extensions a file answer may have (the web app's picker offers JPG, PNG and PDF up to 5 MB). */
export const FILE_ANSWER_TYPES = ['jpg', 'jpeg', 'png', 'pdf'];
/** The extensions a saved photo (Foto KTM, Foto diri) may have. */
export const PHOTO_TYPES = ['jpg', 'jpeg', 'png'];

/** A file's extension from its address in storage (`<id>-<name>.<ext>`, `lib/upload-policy.ts`), lower case. */
export function fileExtension(url: string): string {
  const path = url.split(/[?#]/)[0];
  const dot = path.lastIndexOf('.');
  return dot < 0 ? '' : path.slice(dot + 1).toLowerCase();
}

/** The name a member gave a stored file, as its address keeps it (`<id>-<name>.<ext>`). */
export function fileName(url: string): string {
  const path = url.split(/[?#]/)[0];
  const last = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
  const dash = last.indexOf('-');
  return dash < 0 ? last : last.slice(dash + 1);
}

/** Whether a file's address may stand in an answer or a saved detail: in the app's storage, and one of `types`. */
export type StoredFileCheck = (
  url: string,
  types: readonly string[],
) => boolean;

/** The check from a test of "in the app's storage" (`lib/media-url.ts` in the API). */
export function storedFileCheck(
  inStore: (url: string) => boolean,
): StoredFileCheck {
  return (url, types) => inStore(url) && types.includes(fileExtension(url));
}

/** Every question of a form, in order. */
export function questionsOf(sections: readonly FormSection[]): FormQuestion[] {
  return sections.flatMap((s) => s.questions);
}

/** The options a choice question accepts as its answer, with `OTHER_ANSWER` when it offers "Lainnya". */
export function choicesOf(q: FormQuestion): string[] {
  const options = q.options ?? [];
  return q.other && OTHER_TYPES.includes(q.type)
    ? [...options, OTHER_ANSWER]
    : options;
}

/** The numbers of a scale question, as text. */
export function scaleValues(q: Pick<FormQuestion, 'scale'>): string[] {
  const { min, max } = q.scale ?? DEFAULT_SCALE;
  const out: string[] = [];
  for (let n = min; n <= max; n++) out.push(String(n));
  return out;
}
