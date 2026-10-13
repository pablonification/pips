import { windowStatus } from './programme-window';

/** One-off early-access allowlist: these NIMs may fill a form before it opens (not after it closes). */
export const EARLY_ACCESS_NIMS = ['18225020', '13525006'];

export type FormStatus = 'already_responded' | 'closed' | 'not_opened' | 'open';

export interface FormWindow {
  opensAt: Date | string;
  closesAt: Date | string | null;
  isActive: boolean;
}

/**
 * A member's status for a form, in this order: already responded; closed (switched off, or `now ≥ closesAt`);
 * not opened yet (except the early-access NIMs); open. The window itself is `windowStatus`.
 */
export function formStatus(
  form: FormWindow,
  {
    hasResponse,
    nim,
    now = Date.now(),
  }: { hasResponse: boolean; nim: string; now?: Date | number },
): FormStatus {
  if (hasResponse) return 'already_responded';
  const status = windowStatus(form, now);
  if (status === 'closed') return 'closed';
  if (status === 'not_opened' && !EARLY_ACCESS_NIMS.includes(nim)) {
    return 'not_opened';
  }
  return 'open';
}

/**
 * Whether a form's questions may be shown: from its opening time (or early access), whatever its status, so a
 * closed form stays readable once it has opened. Switched off or closed before opening still hides them.
 */
export function formSectionsVisible(
  form: Pick<FormWindow, 'opensAt'>,
  nim: string,
  now: Date | number = Date.now(),
): boolean {
  return (
    new Date(now).getTime() >= new Date(form.opensAt).getTime() ||
    EARLY_ACCESS_NIMS.includes(nim)
  );
}

/**
 * Whether `GET /form/{id}` sends a form's questions to this member (P3-A, from the P2-A review): only to the form's
 * angkatan, or to a form admin (Live Counting and Rekap Form read the title through it, and an admin needn't be in
 * the angkatan), and then only from the opening time (`formSectionsVisible`). Everyone else still gets the form's
 * title, window and status with `sections: null`, so the member side can say it isn't for their angkatan.
 */
export function formQuestionsVisible(
  form: Pick<FormWindow, 'opensAt'> & { eligibleAngkatan: readonly number[] },
  member: { nim: string; angkatan: number; isFormAdmin: boolean },
  now: Date | number = Date.now(),
): boolean {
  const forThisMember =
    form.eligibleAngkatan.includes(member.angkatan) || member.isFormAdmin;
  return forThisMember && formSectionsVisible(form, member.nim, now);
}

/** Number of sections, for the list ("5 bagian"). */
export function sectionCount(form: { sections: readonly unknown[] }): number {
  return form.sections.length;
}
