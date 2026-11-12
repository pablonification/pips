import {
  arrayOf,
  boolean,
  INVALID,
  literal,
  nonEmpty,
  number,
  object,
  string,
  type Check,
} from './params';

/*
 * View state that lives in the URL (every view is a link), so reload, Back and shared links keep it. Names are
 * short Indonesian words; names that old links already use are kept, so redirected links keep their view. A value
 * that doesn't parse is dropped, never an error page. Plain checks (./params.ts) instead of zod, which would load
 * before every page; tests/params.test.ts holds them to zod's answers.
 */

/** A calendar day, `YYYY-MM-DD` in WIB. */
export const dayParam: Check<string> = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00+07:00`))
    ? v
    : INVALID;

/** Kalender: the chosen day (`hari`) and the open event (`acara`, its id). */
export const kalenderSearchSchema = object({
  hari: dayParam,
  acara: nonEmpty,
});

/** Beranda: the strip's chosen day (`hari`) and the event open in its sheet on phones and tablets (`acara`). */
export const berandaSearchSchema = kalenderSearchSchema;

/** Every page in the app: `showAnnounce` is an old link's param that nothing reads now. */
export const appSearchSchema = object({
  showAnnounce: boolean,
});

/** Kalender's route: `hari` and `acara`, plus the old `selected*` params that nothing reads now. */
export const kalenderRouteSearchSchema = kalenderSearchSchema.extend({
  // The add-event dialog (`/kalender?tambah=acara`).
  tambah: literal('acara'),
  selectedDate: number,
  selectedMonth: number,
  selectedYear: number,
});

/** Pengumuman. The names are the old ones, so `/timeline?…` links keep working through the redirect. */
export const pengumumanSearchSchema = object({
  search: string,
  unread: boolean,
  excludeCategories: arrayOf(string),
  sort: string,
});

/**
 * NIM Finder and other searches: the query (`q`). The router reads `?q=13524087` in a link as a number, and a NIM or
 * a course number is a query too, so a number is kept as its text; anything else unreadable is dropped.
 */
export const querySearchSchema = object({
  q: (v): string | typeof INVALID =>
    typeof v === 'string'
      ? v
      : typeof v === 'number' && !Number.isNaN(v)
        ? String(v)
        : INVALID,
});

/** Testi Matkul's testimonial pages: the 1-based `page`. Programme, semester and course are path params. */
export const testiSearchSchema = object({
  page: number,
});

/** Tambah mata kuliah: `dari=mulai` when it opened from first run, so Tambahkan goes back there. */
export const matkulTambahSearchSchema = object({
  dari: literal('mulai'),
});

/** Rekap Form: the search (`q`) and the 1-based page (`halaman`). */
export const rekapSearchSchema = object({
  q: string,
  halaman: (v): number | typeof INVALID =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : INVALID,
});

/** Data SPARTA Magang: the search and every filter, so reload, Back and a shared link keep them. */
export const spartaDataSearchSchema = object({
  q: string,
  divisi: nonEmpty,
  pilihan: literal(1, 2, 3, 4),
  status: literal('terkunci', 'draf'),
});

/**
 * Curhat Yuk!'s inbox for Welfare: the search (`q`; a number is kept as its text, as `querySearchSchema`) and
 * the Belum dibaca toggle (`unread`, the name Pengumuman uses).
 */
export const inboxSearchSchema = querySearchSchema.extend({
  unread: boolean,
});
