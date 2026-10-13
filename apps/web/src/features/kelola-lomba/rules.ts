/**
 * P3-B: Tambah lomba and Ubah lomba's rules (a proposal; SPEC stories 113 and 117). Each check comes from the API
 * or today's form: names and organisers of 3 characters or more (the API's update rule, used for both), both dates
 * and times, the deadline after the opening (today's rule) and after now (Info Lomba lists only open
 * competitions, so a closed one would vanish at once), and complete links (`https://` added as P2-B's link rule).
 * Times are typed in WIB and sent as ISO. Pure, so `tests/kelola-lomba-rules.test.ts` runs them under another zone.
 */
import type { Competition, CompetitionCategories } from '~/api/generated';
import { kelolaLomba as t } from '~/copy/kelola-lomba';
import { wibOf, wibToIso, type DayKey, type TimeKey } from '~/lib/days';
import { withScheme } from '~/features/lomba/rules';

export type LombaCategory = CompetitionCategories[number];

export interface LombaDraft {
  name: string;
  organizer: string;
  categories: LombaCategory[];
  openDate: DayKey;
  openTime: TimeKey;
  closeDate: DayKey;
  closeTime: TimeKey;
  /** A whole number of rupiah, as typed; empty when free. */
  price: string;
  registrationUrl: string;
  sourceUrl: string;
}

export type LombaField =
  | 'name'
  | 'organizer'
  | 'open'
  | 'close'
  | 'price'
  | 'registrationUrl'
  | 'sourceUrl';
export type LombaErrors = Partial<Record<LombaField, string>>;

/** Top to bottom, the order errors are focused in. */
export const LOMBA_FIELDS: readonly LombaField[] = [
  'name',
  'organizer',
  'open',
  'close',
  'price',
  'registrationUrl',
  'sourceUrl',
];

/** A fresh draft: opening today at 00.00, closing at 23.59 on a day still to choose. */
export function newLombaDraft(today: DayKey): LombaDraft {
  return {
    name: '',
    organizer: '',
    categories: [],
    openDate: today,
    openTime: '00:00',
    closeDate: '',
    closeTime: '23:59',
    price: '',
    registrationUrl: '',
    sourceUrl: '',
  };
}

/** A whole number of rupiah from what the API stores ("150000", "150000.00"); anything else is kept as typed. */
function priceText(price: string | null): string {
  const raw = price?.trim() ?? '';
  if (/^\d+(\.0+)?$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    return n === 0 ? '' : String(n);
  }
  return raw;
}

/** A draft from a competition, in WIB, for Ubah lomba. */
export function draftOfLomba(c: Competition): LombaDraft {
  const open = wibOf(c.registrationStart);
  const close = wibOf(c.registrationDeadline);
  return {
    name: c.name,
    organizer: c.organizer,
    categories: [...c.categories],
    openDate: open.day,
    openTime: open.time,
    closeDate: close.day,
    closeTime: close.time,
    price: priceText(c.price),
    registrationUrl: c.registrationUrl,
    sourceUrl: c.sourceUrl,
  };
}

/** A complete web address once `https://` is added: a host with a dot ("gemastik.id"), nothing else. */
export function isCompleteUrl(typed: string): boolean {
  if (!typed.trim()) return false;
  try {
    const u = new URL(withScheme(typed));
    return /^https?:$/.test(u.protocol) && /\.[a-z]{2,}$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function validateLomba(d: LombaDraft, now: number): LombaErrors {
  const errors: LombaErrors = {};
  if (d.name.trim().length < 3) errors.name = t.galat.pendek;
  if (d.organizer.trim().length < 3) errors.organizer = t.galat.pendek;
  const open = wibToIso(d.openDate, d.openTime);
  const close = wibToIso(d.closeDate, d.closeTime);
  if (!open) errors.open = t.galat.waktu;
  if (!close) errors.close = t.galat.waktu;
  else if (open && Date.parse(close) <= Date.parse(open))
    errors.close = t.galat.urutan;
  else if (Date.parse(close) <= now) errors.close = t.galat.lewat;
  if (d.price.trim() && !/^\d+$/.test(d.price.trim()))
    errors.price = t.galat.biaya;
  if (!isCompleteUrl(d.registrationUrl))
    errors.registrationUrl = t.galat.tautan;
  if (!isCompleteUrl(d.sourceUrl)) errors.sourceUrl = t.galat.tautan;
  return errors;
}

export const firstLombaError = (e: LombaErrors): LombaField | undefined =>
  LOMBA_FIELDS.find((k) => e[k]);

/** The fee as the API keeps it: null when empty or 0 (shown "Gratis"), else the whole number as a string. */
export function priceValue(typed: string): string | null {
  const raw = typed.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return n === 0 ? null : String(n);
}

/** `POST /competitions`: no posters (P2-B's open question 1). */
export function lombaBody(d: LombaDraft) {
  return {
    name: d.name.trim(),
    organizer: d.organizer.trim(),
    categories: d.categories,
    registrationStart: wibToIso(d.openDate, d.openTime)!,
    registrationDeadline: wibToIso(d.closeDate, d.closeTime)!,
    price: priceValue(d.price),
    registrationUrl: withScheme(d.registrationUrl),
    sourceUrl: withScheme(d.sourceUrl),
  };
}

/**
 * `PUT /competitions/{id}`: only the fields that changed, and never `mediaUrls`, so the posters already stored
 * stay (a sent list replaces them).
 */
export function changedFields(before: Competition, d: LombaDraft) {
  const next = lombaBody(d);
  const same = {
    name: next.name === before.name,
    organizer: next.organizer === before.organizer,
    categories:
      [...next.categories].sort().join('\n') ===
      [...before.categories].sort().join('\n'),
    registrationStart:
      Date.parse(next.registrationStart) ===
      Date.parse(before.registrationStart),
    registrationDeadline:
      Date.parse(next.registrationDeadline) ===
      Date.parse(before.registrationDeadline),
    price: next.price === priceValue(priceText(before.price)),
    registrationUrl: next.registrationUrl === before.registrationUrl,
    sourceUrl: next.sourceUrl === before.sourceUrl,
  };
  return Object.fromEntries(
    Object.entries(next).filter(([k]) => !same[k as keyof typeof same]),
  ) as Partial<ReturnType<typeof lombaBody>>;
}
