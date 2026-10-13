/**
 * P3-B: Tambah testimoni's rules (a proposal; SPEC story 112). The sections are the programme's own, from Testi
 * Matkul's rule (`sectionFields`); empty ones are sent as null, at least one must be written, and an empty author
 * name is null (shown "Anonim"). Pure, so `tests/kelola-testi-rules.test.ts` checks them without a browser.
 */
import { kelolaTesti as t } from '~/copy/kelola-testi';
import { sectionFields, type Major } from '~/features/testi/rules';

export type SectionKey =
  | 'overview'
  | 'assignments'
  | 'lecturer_review'
  | 'impressions'
  | 'challenges'
  | 'advice';

export interface TestiDraft {
  userName: string;
  sections: Partial<Record<SectionKey, string>>;
  lecturer: string;
}

export const newTestiDraft = (): TestiDraft => ({
  userName: '',
  sections: {},
  lecturer: '',
});

/** The textareas a course asks for: its programme's three sections, with Testi Matkul's titles. */
export const testiSections = (major: Major) =>
  sectionFields(major).map(([key, title]) => ({ key, title }));

const orNull = (text: string | undefined) => text?.trim() || null;

/** At least one of the programme's sections written; the error sits under the first one. */
export function validateTesti(major: Major, d: TestiDraft): string | null {
  return testiSections(major).some(({ key }) => orNull(d.sections[key]))
    ? null
    : t.galat.kosong;
}

/** `POST /testimoni`: the programme's sections, each null when empty; the other programme's are left out. */
export function testiBody(courseId: string, major: Major, d: TestiDraft) {
  return {
    courseId,
    userName: orNull(d.userName),
    ...Object.fromEntries(
      testiSections(major).map(({ key }) => [key, orNull(d.sections[key])]),
    ),
    lecturer: orNull(d.lecturer),
  } as {
    courseId: string;
    userName: string | null;
    lecturer: string | null;
  } & Partial<Record<SectionKey, string | null>>;
}
