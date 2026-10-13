/**
 * Testi Matkul's rules (P2-B), from the prototype's `scrTesti`, `testiTitle`, `testiMatches` and today's query
 * mapping. Pure, so `tests/testi-rules.test.ts` checks them without a browser.
 */
import type { Course, Testimoni } from '~/api/generated';
import { fill } from '~/copy/fill';
import { testi as copy } from '~/copy/testi';
import { extractUrls, removePunctuation } from '~/lib/url-parser';

export type Major = Course['major'];

/** The URL's programme slugs (P0-B's `$type`, today's values, which P1-A's links use too). */
export const MAJOR_SLUG: Record<Major, string> = {
  IF: 'teknik-informatika',
  STI: 'sistem-dan-teknologi-informasi',
  OTHER: 'mata-kuliah-umum',
};

/** The programmes on the start screen, in the prototype's order. */
export const MAJORS: Major[] = ['IF', 'STI', 'OTHER'];

/** The semesters on a programme's screen (`scrTesti`), then Mata Kuliah Pilihan. */
export const SEMESTERS = [3, 4, 5, 6] as const;

/** A course list: a semester's mandatory courses, or the programme's electives ('pilihan'). */
export type ListKey = number | 'pilihan';

/** The URL's semester slug (P0-B's `$semester`): the number, or today's `other` for the electives. */
export const listSlug = (key: ListKey) =>
  key === 'pilihan' ? 'other' : String(key);

export function majorOfSlug(slug: string): Major | null {
  const hit = (Object.keys(MAJOR_SLUG) as Major[]).find(
    (m) => MAJOR_SLUG[m] === slug,
  );
  return hit ?? null;
}

/** `other`, or a semester 1–8 (a mandatory course's own semester, from P1-A's links); anything else is unknown. */
export function listOfSlug(slug: string): ListKey | null {
  if (slug === 'other') return 'pilihan';
  if (!/^[1-8]$/.test(slug)) return null;
  return Number(slug);
}

/**
 * The bug fix: true when "{code} {name}" contains the trimmed query, ignoring case. Today's list lowercased the
 * query and compared it with upper-case codes, so a code never matched.
 */
export function matchCourse(
  course: Pick<Course, 'code' | 'name'>,
  q: string,
): boolean {
  const needle = q.trim().toLocaleLowerCase('id');
  if (!needle) return true;
  return `${course.code} ${course.name}`
    .toLocaleLowerCase('id')
    .includes(needle);
}

const byCode = (a: Course, b: Course) =>
  a.code < b.code ? -1 : a.code > b.code ? 1 : 0;

/**
 * Is a course in a list? Today's query mapping: a semester means that programme's mandatory courses of that
 * semester; Pilihan (and Mata Kuliah Umum, which is OTHER's Pilihan) means the programme's electives, whatever
 * semester number the catalogue gives them.
 */
export function inList(course: Course, major: Major, key: ListKey): boolean {
  if (course.major !== major) return false;
  if (key === 'pilihan') return course.type === 'Elective';
  return course.type === 'Mandatory' && course.semester === key;
}

/** A course list, filtered by its own search, ordered by code as the API orders the catalogue. */
export function listCourses(
  catalogue: Course[],
  major: Major,
  key: ListKey,
  q = '',
): Course[] {
  return catalogue
    .filter((c) => inList(c, major, key) && matchCourse(c, q))
    .sort(byCode);
}

/** The start screen's search over the whole catalogue; null while nothing is typed (`testiMatches`). */
export function searchCourses(catalogue: Course[], q: string): Course[] | null {
  if (!q.trim()) return null;
  return catalogue.filter((c) => matchCourse(c, q)).sort(byCode);
}

/** Where a course's page is: its programme, its list (a semester, or the electives) and its id. */
export function courseParams(course: Course) {
  return {
    type: MAJOR_SLUG[course.major],
    semester:
      course.type === 'Elective' || course.semester === null
        ? 'other'
        : String(course.semester),
    courseId: course.id,
  };
}

/** The page's title (`testiTitle`): the course code, a list, a programme, or Testi Matkul itself. */
export function testiTitle(p: {
  major?: Major | null;
  list?: ListKey | null;
  code?: string | null;
}): string | null {
  if (p.code) return p.code;
  if (p.major && p.list != null) {
    if (p.major === 'OTHER') return copy.program.OTHER;
    return p.list === 'pilihan'
      ? fill(copy.judulPilihan, { program: p.major })
      : fill(copy.judulSemester, { program: p.major, semester: p.list });
  }
  if (p.major) return copy.program[p.major];
  return null;
}

/** "3 testimoni" or "Belum ada testimoni" (`testiCourseRow`). */
export const countLine = (n: number) =>
  n ? fill(copy.jumlahTestimoni, { jumlah: n }) : copy.belumAdaTestimoni;

/** "IF2110 · 3 SKS", or just the code when the catalogue has no credits. */
export const codeLine = (course: Pick<Course, 'code' | 'credits'>) =>
  course.credits == null
    ? course.code
    : fill(copy.kodeSks, { kode: course.code, sks: course.credits });

export interface Section {
  key: string;
  title: string;
  text: string;
}

type Field = keyof Pick<
  Testimoni,
  | 'overview'
  | 'assignments'
  | 'lecturer_review'
  | 'impressions'
  | 'challenges'
  | 'advice'
>;
const IF_FIELDS: [Field, string][] = [
  ['overview', copy.bagian.overview],
  ['assignments', copy.bagian.tugas],
  ['lecturer_review', copy.bagian.reviewDosen],
];
const STI_FIELDS: [Field, string][] = [
  ['impressions', copy.bagian.kesan],
  ['challenges', copy.bagian.tantangan],
  ['advice', copy.bagian.saran],
];

/**
 * A testimonial's sections: STI courses ask Kesan, Tantangan and Saran; every other programme Overview, Tugas and
 * Review Dosen. Empty ones are left out. Today's app shows every filled field whatever the programme, so the other
 * programme's fields follow the programme's own, and the lecturer comes last as "Dosen" (open questions 3 and 6).
 */
export function sections(major: Major, t: Testimoni): Section[] {
  const [own, other] =
    major === 'STI' ? [STI_FIELDS, IF_FIELDS] : [IF_FIELDS, STI_FIELDS];
  const out: Section[] = [];
  for (const [key, title] of [...own, ...other]) {
    const text = t[key]?.trim();
    if (text) out.push({ key, title, text: t[key] as string });
  }
  const lecturer = t.lecturer?.trim();
  if (lecturer)
    out.push({ key: 'lecturer', title: copy.bagian.dosen, text: lecturer });
  return out;
}

/**
 * The byline: an unnamed author (null, empty or "Anonim") is "Anonim" with "?"; otherwise the name, with the first
 * letters of its first two words, as the prototype does ("Fikri, IF 2023" → "FI").
 */
export function authorOf(userName: string | null | undefined): {
  name: string;
  initials: string;
} {
  const name = userName?.trim() ?? '';
  if (!name || name.toLocaleLowerCase('id') === 'anonim')
    return { name: copy.anonim, initials: '?' };
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('id');
  return { name, initials };
}

/** The testimonial shown for a 1-based `page` from the URL: an index in range, or 0 when there are none. */
export function clampIndex(page: number | undefined, count: number): number {
  if (count <= 0) return 0;
  const i = Math.trunc((page ?? 1) - 1);
  if (!Number.isFinite(i) || i < 0) return 0;
  return Math.min(i, count - 1);
}

export type Segment = { text: string; href?: string };

/** Text split into plain runs and links, as today's `TestiContent` links URLs (`extractUrls`); line breaks kept. */
export function linkSegments(text: string): Segment[] {
  const urls = extractUrls(text);
  if (!urls.length) return [{ text }];
  const out: Segment[] = [];
  const push = (s: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last && !last.href) last.text += s;
    else out.push({ text: s });
  };
  for (const token of text.split(/(\s+)/)) {
    const clean = removePunctuation(token);
    if (!clean || !urls.includes(clean)) {
      push(token);
      continue;
    }
    const at = token.indexOf(clean);
    push(token.slice(0, at));
    out.push({
      text: clean,
      href: /^https?:\/\//i.test(clean) ? clean : `https://${clean}`,
    });
    push(token.slice(at + clean.length));
  }
  return out;
}
