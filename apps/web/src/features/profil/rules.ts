/*
 * Profil's rules, pure so they are unit-tested (tests/profil-rules.test.ts): the categories' switches, the member
 * card's labels, Informasi akun, the semester line, credits and the course catalogue.
 */
import type { Category } from '~/api/generated';

export interface CategoryRow {
  id: string;
  name: string;
  /** HMIF requires it: locked on, and says why. */
  required: boolean;
  /** The line under the name: why it's locked, or what Akademik includes. */
  note: 'wajib' | 'akademik' | null;
  on: boolean;
}

/** One switch per category, in the API's order (garis/screens-more.js `scrNotif`). */
export function categoryRows(
  categories: readonly Category[],
  muted: readonly string[],
): CategoryRow[] {
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    required: c.requiredPush,
    note: c.requiredPush
      ? 'wajib'
      : c.name.trim().toLowerCase() === 'akademik'
        ? 'akademik'
        : null,
    on: c.requiredPush || !muted.includes(c.id),
  }));
}

/* ---- The member card and Informasi akun ---- */

/** The programme's name (garis/screens-more.js `PROG`). */
export function programName(major: string): string {
  if (major === 'IF') return 'Teknik Informatika';
  if (major === 'STI') return 'Sistem dan Teknologi Informasi';
  return major;
}

/**
 * The card's angkatan: "IF’25 · PIXEL" (`shortAng` plus the angkatan's name), the name only when `GET /api/angkatan`
 * gives a real one (not empty, not just the year).
 */
export function angkatanLabel(
  major: string,
  year: number,
  list: ReadonlyArray<{ year: number; name: string | null }> | undefined,
): string {
  const short = `${major}’${String(year).slice(2)}`;
  const name = list?.find((a) => a.year === year)?.name?.trim();
  return name && name !== String(year) ? `${short} · ${name}` : short;
}

export interface Academic {
  semester?: number;
  semesterYear: number;
  semesterCode: 'Ganjil' | 'Genap';
}

/** "Ganjil 2026/2027": the academic year runs from `semesterYear` to the next. */
export function semesterLabel(a: Academic): string {
  return `${a.semesterCode} ${a.semesterYear}/${a.semesterYear + 1}`;
}

/**
 * Informasi akun's Grup: the groups' names, only for a member with roles. Nothing until the names have loaded, so
 * the row never shows role keys ("welfarenakademik") while they load or after they fail (review m6).
 */
export function groupsFact(
  roles: readonly string[],
  groups: ReadonlyArray<{ role: string; group: string }> | undefined,
): string | null {
  if (!roles.length || !groups) return null;
  const names = roles.map((r) => groups?.find((g) => g.role === r)?.group ?? r);
  return [...new Set(names)].join(', ');
}

/* ---- Mata kuliahku and Tambah mata kuliah ---- */

/** Jumlah SKS: a course without credits counts 0. */
export function totalSks(
  courses: ReadonlyArray<{ course?: { credits: number | null } | null }>,
): number {
  return courses.reduce((n, c) => n + (c.course?.credits ?? 0), 0);
}

export const CATALOGUE_LIMIT = 10;

/**
 * Tambah mata kuliah's results (garis/screens-more.js `caddResults`): the catalogue minus this semester's courses,
 * matching the code or name (any case), your major first, then your semester, then by code; at most 10.
 */
export function catalogueResults<
  C extends {
    id: string;
    code: string;
    name: string;
    major: string;
    semester: number | null;
  },
>(
  catalogue: readonly C[],
  mine: readonly string[],
  query: string,
  me: { major: string; semester?: number },
): C[] {
  const q = query.trim().toLowerCase();
  return catalogue
    .filter((c) => !mine.includes(c.id))
    .filter((c) => !q || `${c.code} ${c.name}`.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        Number(b.major === me.major) - Number(a.major === me.major) ||
        Number(b.semester === me.semester) -
          Number(a.semester === me.semester) ||
        a.code.localeCompare(b.code),
    )
    .slice(0, CATALOGUE_LIMIT);
}

/** Picks: course id → class 1–3. */
export type Picks = Readonly<Record<string, number>>;

/** Choosing a class (`pick-k`): choosing the chosen one again clears it. */
export function togglePick(picks: Picks, courseId: string, k: number): Picks {
  return setPick(picks, courseId, picks[courseId] === k ? null : k);
}

/** Sets or clears one course's class; the other picks stay. */
export function setPick(
  picks: Picks,
  courseId: string,
  k: number | null,
): Picks {
  const next = { ...picks };
  if (k === null) delete next[courseId];
  else next[courseId] = k;
  return next;
}

/** The `PUT /api/course/take/batch` body for the picks. */
export function picksBody(picks: Picks) {
  return Object.entries(picks).map(([courseId, k]) => ({
    courseId,
    class: k,
  }));
}
