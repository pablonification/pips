/**
 * A member's profile as forms read it: the account facts and the saved details (Profil › Data diri), the checks a
 * saved detail must pass, and the text each requested field is sent as. No database.
 */
import {
  EMERGENCY_RELATIONS,
  FORM_LIMITS,
  PHOTO_TYPES,
  SAVED_FIELDS,
  fileExtension,
  type EmergencyRelation,
  type ProfileField,
  type SavedDetails,
  type SavedField,
} from './form-model';

/** What a member's account says, as forms send it. Program studi and kampus in words. */
export interface AccountFacts {
  fullName: string;
  nim: string;
  major: 'IF' | 'STI';
  angkatan: number;
  region: 'Ganesha' | 'Jatinangor';
  email: string;
}

const MAJOR_NAMES = {
  IF: 'Teknik Informatika',
  STI: 'Sistem dan Teknologi Informasi',
} as const;

export const EMPTY_DETAILS: SavedDetails = {
  whatsapp: null,
  line: null,
  instagram: null,
  address: null,
  hometown: null,
  emergencyContact: null,
  health: null,
  birthDate: null,
  studentCardPhoto: null,
  photo: null,
};

/** The text a requested field is sent as, or null when the member hasn't given it. Dates stay `YYYY-MM-DD`. */
export function fieldValue(
  field: ProfileField,
  account: AccountFacts,
  saved: SavedDetails,
): string | null {
  switch (field) {
    case 'fullName':
      return account.fullName;
    case 'nim':
      return account.nim;
    case 'major':
      return MAJOR_NAMES[account.major];
    case 'angkatan':
      return String(account.angkatan);
    case 'campus':
      return account.region;
    case 'email':
      return account.email;
    case 'emergencyContact': {
      const c = saved.emergencyContact;
      return c ? `${c.name} (${c.relation.toLowerCase()}) · ${c.phone}` : null;
    }
    default:
      return saved[field];
  }
}

/** The requested fields the member has never given: the agreement step asks them there, once. */
export function missingFields(
  requested: readonly ProfileField[],
  account: AccountFacts,
  saved: SavedDetails,
): ProfileField[] {
  return requested.filter((f) => fieldValue(f, account, saved) === null);
}

/** What goes along with a response, by field, as the member saw it. */
export function profileSnapshot(
  requested: readonly ProfileField[],
  account: AccountFacts,
  saved: SavedDetails,
): Partial<Record<ProfileField, string>> {
  const out: Partial<Record<ProfileField, string>> = {};
  for (const f of requested) {
    const v = fieldValue(f, account, saved);
    if (v !== null) out[f] = v;
  }
  return out;
}

/** A change to saved details: a value sets one, null removes it, a missing key leaves it. */
export type DetailsChange = Partial<SavedDetails>;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A phone number: digits with spaces, dashes, dots or a leading +, at least nine digits (the prototype's rule). */
export function phoneOk(v: string) {
  return (
    /^\+?[\d\s.-]+$/.test(v) &&
    v.replace(/\D/g, '').length >= 9 &&
    v.length <= 30
  );
}

/** A real date, after 1950 and before `today` (`YYYY-MM-DD`). */
export function birthDateOk(v: string, today: string) {
  const m = DATE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return (
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3] &&
    +m[1] > 1950 &&
    v < today
  );
}

export type DetailProblem = 'empty' | 'too_long' | 'phone' | 'date' | 'file';

/**
 * Per field, why a change can't be saved; empty when it can. Texts are trimmed first and may not be blank (null removes
 * a detail); a phone needs nine digits; a birth date is real and past; a photo is a JPG or PNG in the app's storage.
 */
export function detailsProblems(
  change: DetailsChange,
  {
    today,
    isStoredFile,
  }: { today: string; isStoredFile: (url: string) => boolean },
): Partial<Record<SavedField, DetailProblem>> {
  const out: Partial<Record<SavedField, DetailProblem>> = {};
  for (const field of SAVED_FIELDS) {
    const v = change[field];
    if (v === undefined || v === null) continue;
    if (field === 'emergencyContact') {
      const c = v as NonNullable<SavedDetails['emergencyContact']>;
      if (!c.name.trim() || !EMERGENCY_RELATIONS.includes(c.relation))
        out[field] = 'empty';
      else if (c.name.length > FORM_LIMITS.option) out[field] = 'too_long';
      else if (!phoneOk(c.phone.trim())) out[field] = 'phone';
      continue;
    }
    const text = (v as string).trim();
    if (!text) out[field] = 'empty';
    else if (text.length > FORM_LIMITS.detail) out[field] = 'too_long';
    else if (field === 'whatsapp' && !phoneOk(text)) out[field] = 'phone';
    else if (field === 'birthDate' && !birthDateOk(text, today))
      out[field] = 'date';
    else if (
      (field === 'studentCardPhoto' || field === 'photo') &&
      !(isStoredFile(text) && PHOTO_TYPES.includes(fileExtension(text)))
    )
      out[field] = 'file';
  }
  return out;
}

/** The change, trimmed, as it is stored. */
export function tidyChange(change: DetailsChange): DetailsChange {
  const out: DetailsChange = {};
  for (const field of SAVED_FIELDS) {
    const v = change[field];
    if (v === undefined) continue;
    if (v === null) (out as Record<string, unknown>)[field] = null;
    else if (field === 'emergencyContact') {
      const c = v as {
        name: string;
        relation: EmergencyRelation;
        phone: string;
      };
      out.emergencyContact = {
        name: c.name.trim(),
        relation: c.relation,
        phone: c.phone.trim(),
      };
    } else (out as Record<string, unknown>)[field] = (v as string).trim();
  }
  return out;
}
