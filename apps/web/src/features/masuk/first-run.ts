import type { PushStatus } from '~/lib/push-state';

/*
 * First run (SPEC stories 5–7): when it shows after a sign-in, and when each step is done. Pure, unit-tested
 * (tests/masuk-rules.test.ts).
 */

/** This device's answer: finished or skipped, kept in localStorage. */
export const FIRST_RUN_KEY = 'pips:mulai';
export type FirstRunFlag = 'selesai' | 'lewati';

export interface FirstRunSignals {
  courseCount: number;
  push: PushStatus;
}

/** Steps still open: courses not set, or notifications that can still be turned on (as Beranda's `attentionItems`). */
export function openSteps(s: FirstRunSignals): Array<'matkul' | 'notif'> {
  const out: Array<'matkul' | 'notif'> = [];
  if (s.courseCount === 0) out.push('matkul');
  if (s.push === 'belum') out.push('notif');
  return out;
}

/**
 * Where a sign-in from `/login` lands: a shared link (the validated `redirect`) always wins; then first run, on a
 * device that hasn't finished or skipped it, while a step is open; else Beranda.
 */
export function afterSignIn(input: {
  redirect: string | null;
  flag: FirstRunFlag | null;
  signals: FirstRunSignals | null;
}): string {
  if (input.redirect) return input.redirect;
  if (!input.flag && input.signals && openSteps(input.signals).length)
    return '/mulai';
  return '/';
}

export function readFirstRunFlag(storage: Pick<Storage, 'getItem'>) {
  try {
    const v = storage.getItem(FIRST_RUN_KEY);
    return v === 'selesai' || v === 'lewati' ? v : null;
  } catch {
    return null;
  }
}

export function writeFirstRunFlag(
  storage: Pick<Storage, 'setItem'>,
  flag: FirstRunFlag,
) {
  try {
    storage.setItem(FIRST_RUN_KEY, flag);
  } catch {
    // Storage blocked: first run may show again after the next sign-in, which is harmless.
  }
}
