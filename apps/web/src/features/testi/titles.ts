/**
 * Testi Matkul's URL slugs and page titles. Kept apart from ./rules so the shell's rules (./shell), which load at
 * start, carry only these and the words.
 */
import type { Course } from '~/api/generated';
import { fill } from '~/copy/fill';
import { testi as copy } from '~/copy/testi';

export type Major = Course['major'];

/** The URL's programme slugs (the `$type` param). */
export const MAJOR_SLUG: Record<Major, string> = {
  IF: 'teknik-informatika',
  STI: 'sistem-dan-teknologi-informasi',
  OTHER: 'mata-kuliah-umum',
};

/** The programmes on the start screen, in order. */
export const MAJORS: Major[] = ['IF', 'STI', 'OTHER'];

/** The semesters on a programme's screen, then Mata Kuliah Pilihan. */
export const SEMESTERS = [3, 4, 5, 6] as const;

/** A course list: a semester's mandatory courses, or the programme's electives ('pilihan'). */
export type ListKey = number | 'pilihan';

/** The URL's semester slug (the `$semester` param): the number, or `other` for the electives. */
export const listSlug = (key: ListKey) =>
  key === 'pilihan' ? 'other' : String(key);

export function majorOfSlug(slug: string): Major | null {
  const hit = (Object.keys(MAJOR_SLUG) as Major[]).find(
    (m) => MAJOR_SLUG[m] === slug,
  );
  return hit ?? null;
}

/** `other`, or a semester 1–8 (a mandatory course's own semester, from Beranda's links); anything else is unknown. */
export function listOfSlug(slug: string): ListKey | null {
  if (slug === 'other') return 'pilihan';
  if (!/^[1-8]$/.test(slug)) return null;
  return Number(slug);
}

/** The page's title: the course code, a list, a programme, or Testi Matkul itself. */
export function testiTitle(p: {
  major?: Major | null;
  list?: ListKey | null;
  code?: string | null;
}): string | null {
  if (p.code) return p.code;
  if (p.major && p.list != null) {
    // Mata Kuliah Umum's own list is its electives (the start screen's row). Its mandatory courses, reached through
    // search, sit in a semester list, titled so it isn't taken for the other.
    if (p.major === 'OTHER')
      return p.list === 'pilihan'
        ? copy.program.OTHER
        : fill(copy.judulSemester, {
            program: copy.program.OTHER,
            semester: p.list,
          });
    return p.list === 'pilihan'
      ? fill(copy.judulPilihan, { program: p.major })
      : fill(copy.judulSemester, { program: p.major, semester: p.list });
  }
  if (p.major) return copy.program[p.major];
  return null;
}
