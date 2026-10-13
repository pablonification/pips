import { z } from 'zod';

/*
 * View state that lives in the URL (SPEC "Information architecture and shell": every view is a link), so reload,
 * Back and shared links keep it. Names are short Indonesian words; screens that today already keep state in the
 * URL keep their names, so redirected old links keep their view. A value that doesn't parse is dropped, never
 * an error page. Later tasks add their params here (P3-A: `q`, `divisi`, `pilihan`, `status`; P3-B: `tambah`).
 */

/** A calendar day, `YYYY-MM-DD` in WIB. */
export const dayParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => !Number.isNaN(Date.parse(`${day}T00:00:00+07:00`)));

/** Kalender: the chosen day (`hari`) and the open event (`acara`, its id). */
export const kalenderSearchSchema = z.object({
  hari: dayParam.optional().catch(undefined),
  acara: z.string().min(1).optional().catch(undefined),
});

/** Beranda (P1-A): the strip's chosen day (`hari`) and the event open in its sheet on phones and tablets (`acara`). */
export const berandaSearchSchema = kalenderSearchSchema;

/** Every page in the app: `showAnnounce` opens today's desktop composer. */
export const appSearchSchema = z.object({
  showAnnounce: z.boolean().optional().catch(undefined),
});

/** Kalender's route: the redesign's `hari` and `acara` (P1-A), and today's screen's `selected*` until it is replaced. */
export const kalenderRouteSearchSchema = kalenderSearchSchema.extend({
  // P3-B: the add-event dialog (`/kalender?tambah=acara`).
  tambah: z.literal('acara').optional().catch(undefined),
  selectedDate: z.number().optional().catch(undefined),
  selectedMonth: z.number().optional().catch(undefined),
  selectedYear: z.number().optional().catch(undefined),
});

/** Pengumuman: today's names (`/timeline?…` links keep working through the redirect). */
export const pengumumanSearchSchema = z.object({
  search: z.string().optional().catch(undefined),
  unread: z.boolean().optional().catch(undefined),
  excludeCategories: z.array(z.string()).optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
});

/**
 * NIM Finder and other searches: the query (`q`). The router reads `?q=13524087` in a link as a number, and a NIM or
 * a course number is a query too, so a number is kept as its text (P2-B round 2); anything else unreadable is dropped.
 */
export const querySearchSchema = z.object({
  q: z
    .union([z.string(), z.number().transform(String)])
    .optional()
    .catch(undefined),
});

/** Testi Matkul's testimonial pages: today's 1-based `page`. Programme, semester and course are path params. */
export const testiSearchSchema = z.object({
  page: z.number().optional().catch(undefined),
});

/** Tambah mata kuliah (P1-C): `dari=mulai` when it opened from first run, so Tambahkan goes back there. */
export const matkulTambahSearchSchema = z.object({
  dari: z.literal('mulai').optional().catch(undefined),
});
