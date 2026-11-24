/**
 * The one rule for a new or renamed s.hmif.dev name, a short link's or a form's, as the API checks it
 * (`apps/api/src/lib/short-link.ts`; `tests/short-name.test.ts` holds the two together): letters, numbers and
 * hyphens, a hyphen only between letters or numbers, 3 to 50 characters. Names are compared without capitals, which
 * only the server can check. Kept apart from the screens, so both Tautan pendek and Bagikan load it alone.
 */
import { fill } from '~/copy/fill';
import { namaPendek as copy } from '~/copy/nama-pendek';

export const NAME_MIN = 3;
export const NAME_MAX = 50;

/** The address's fixed part, before every name. */
export const SHORT_HOST = 's.hmif.dev/';

/** A name as members open it. */
export const shortUrl = (name: string) => `https://${SHORT_HOST}${name}`;

export type NameRuleProblem =
  'characters' | 'too_short' | 'too_long' | 'hyphens';
export type NameProblem = NameRuleProblem | 'taken' | 'used';

/** Spaces become hyphens while typing; capitals stay, for reading (BayarKasHMIF). */
export const tidyName = (v: string) => v.replace(/\s+/g, '-');

/** What the server would refuse in the name, in the field's order, before asking whether something holds it. */
export function nameProblem(name: string): NameRuleProblem | null {
  if (/[^A-Za-z0-9-]/.test(name)) return 'characters';
  if (name.length < NAME_MIN) return 'too_short';
  if (name.length > NAME_MAX) return 'too_long';
  if (!/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/.test(name)) return 'hyphens';
  return null;
}

/** Why a name can't be had, as the server answers it: the problem, and for `taken` what holds it and as what. */
export interface NameRefusal {
  problem: NameProblem;
  heldAs?: string | null;
  heldBy?: 'link' | 'form' | null;
}

/**
 * The words under the field. A name held in other capitals says as what ("Sudah dipakai tautan lain sebagai
 * bukber-pixel-25"); a deleted name never says whose it was.
 */
export function nameMessage(r: NameRefusal, typed: string): string {
  if (r.problem === 'taken') {
    const by = r.heldBy ?? 'link';
    return r.heldAs && r.heldAs !== typed
      ? fill(copy.dipakaiSebagai[by], { nama: r.heldAs })
      : copy.dipakai[by];
  }
  if (r.problem === 'too_long')
    return fill(copy.masalah.too_long, { jumlah: typed.length });
  return copy.masalah[r.problem];
}
