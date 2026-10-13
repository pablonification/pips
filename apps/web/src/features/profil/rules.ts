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
