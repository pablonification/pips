/**
 * P3-B: helpers for the management journeys (manage-events, manage-lomba, manage-testi): the dialogs, the toasts,
 * the failures a write may meet and where focus lands after one.
 */
import type { Page } from '@playwright/test';
import { reply, type Handler } from './mock';
import { toastText } from './pengumuman';
import { expect } from './test';

export { toastText };

/** The two things a failed write says (src/copy/kelola-tulis.ts), never the API's own words. */
export const FAILED = {
  tanpaAkses:
    'Akunmu tidak punya akses untuk ini. Hubungi pengurus HMIF kalau ini keliru.',
  gagal: 'Perubahan belum tersimpan. Periksa koneksimu, lalu coba lagi.',
} as const;

/** Failures a write may meet, with what the member is told. 401 is roleMiddleware's answer for a missing role. */
export const FAILURES = [
  { status: 401, says: FAILED.tanpaAkses },
  { status: 403, says: FAILED.tanpaAkses },
  { status: 404, says: FAILED.gagal },
  { status: 503, says: FAILED.gagal },
] as const;

export const failWith = (status: number) =>
  reply.status(status, { error: `e2e: the API's own words (${status})` });

/** A write answered after `ms`, so the busy state can be seen and a second press tried. */
export const slow =
  (handler: Handler, ms = 1_500): Handler =>
  async (req) => {
    await new Promise((r) => setTimeout(r, ms));
    return handler(req);
  };

export const dialog = (page: Page, name: string | RegExp) =>
  page.getByRole('dialog', { name });

/** Focus is on the page's title (`focusTitle`): desktop's head, or the top bar on phones and tablets. */
export async function expectTitleFocused(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.activeElement?.hasAttribute('data-page-title') ?? false,
      ),
    )
    .toBe(true);
}

/** Still signed in after a refused write: the page didn't go to sign-in, and the session is still kept. */
export async function expectStillSignedIn(page: Page) {
  await expect(page).not.toHaveURL(/\/masuk/);
  expect(await page.evaluate(() => localStorage.getItem('user'))).not.toBe(
    null,
  );
}
