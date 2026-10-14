/**
 * F2 (brief step 8): what every page does when the API fails, and every not-found state.
 * - Every read the page makes answers 503 (the session check, the profile and the roles stay up, as a member
 *   already signed in would have them): the page still has its title, says what failed in Indonesian with
 *   Coba lagi, and never shows the API's own text ("e2e: HTTP 503") or a programmer's word. Back up, Coba lagi
 *   brings the content.
 * - A dropped request (no answer at all) behaves the same.
 * - Not found: an unknown URL, a deleted post, a room that's gone, an unknown course, form, event or submission:
 *   each says so in Indonesian, with a way back.
 */
import type { Page } from '@playwright/test';
import { ROUTES } from '../review/routes';
import { defaultHandlers } from '../support/handlers';
import { reply } from '../support/mock';
import * as writes from '../support/writes';
import { expect, test } from '../support/test';
import { openSettled, QA_LAYOUT } from './probe';

/** Reads that stay up: a signed-in member's session and profile come from the device. */
const KEPT = new Set([
  'GET /api/me',
  'GET /api/user/academic',
  'GET /api/auth/groups',
]);

/**
 * Pages whose reads only add to what is already there, so a failure shows nothing by design: Layanan's and Kelola's
 * badges and counts (P1-C, P3-A), and Testi Matkul's first two lists, which are fixed (the catalogue they read is for
 * search and the course pages, which say when it fails).
 */
const SILENT = new Set([
  '/layanan',
  '/kelola',
  '/layanan/testi',
  '/layanan/testi/$type',
]);

const PROGRAMMER =
  /e2e:|HTTP \d{3}|\bError\b|undefined|\bnull\b|NaN|\[object|Unauthorized|Not Found/;

/** What a page says when a read failed: an error state, a toast or the offline line. */
const FAILED = /gagal|belum bisa|Offline|terhubung/i;

const bodyText = (page: Page) =>
  page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

for (const kind of ['503', 'dropped'] as const)
  for (const [path, route] of Object.entries(ROUTES)) {
    const who = route.as[0];
    if (path === '/login') continue;
    test.describe(`${path} as ${who.key}`, () => {
      test.use(who.use);
      test(`${kind}: ${route.url} says what failed, and Coba lagi recovers`, async ({
        page,
        api,
      }, testInfo) => {
        test.skip(
          !/^qa-(phone-light|desktop-dark)$/.test(testInfo.project.name),
          'phone light and desktop dark',
        );
        let failing = true;
        // Opening a post or a room marks it read (a write, answered as the API does).
        api.on('POST /api/info/:infoId/read', writes.markRead);
        api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
        for (const [key, handler] of Object.entries(defaultHandlers)) {
          if (KEPT.has(key)) continue;
          api.on(key, (req) =>
            failing
              ? kind === '503'
                ? reply.status(503)
                : reply.abort('failed')
              : handler(req),
          );
        }
        await page.goto(route.url);
        await expect(
          page.locator('main, [role="dialog"]').first(),
        ).toBeVisible();
        await page.waitForLoadState('load');
        // Give the retries (React Query's own) time to give up.
        await expect(page.getByRole('status', { name: /^Memuat/ })).toHaveCount(
          0,
          {
            timeout: 30_000,
          },
        );
        const retry = page
          .getByRole('button', { name: 'Coba lagi' })
          .locator('visible=true');
        const reads = () =>
          api.requests.filter(
            (r) =>
              r.method === 'GET' &&
              r.path.startsWith('/api/') &&
              !KEPT.has(`GET ${r.path}`) &&
              r.outcome === 'explicit',
          ).length;
        // The app retries a failed read three times (1, 2 and 4 s apart) before it says so: wait for that. Layanan
        // reads only its badges' counts, and shows none when they fail (P1-C, layanan.spec.ts "no badges while their
        // counts load or when they fail").
        if (reads() && !SILENT.has(path))
          await expect
            .poll(
              async () =>
                (await retry.count()) > 0 || FAILED.test(await bodyText(page)),
              { message: 'a failed read is said on screen', timeout: 30_000 },
            )
            .toBe(true);
        expect(
          await bodyText(page),
          'no programmer’s text on screen',
        ).not.toMatch(PROGRAMMER);
        failing = false;
        for (let i = 0; i < 5 && (await retry.count()); i++) {
          await retry.first().click();
          await page.waitForTimeout(300);
        }
        await expect(retry).toHaveCount(0, { timeout: 15_000 });
      });
    });
  }

const NOT_FOUND: {
  url: string;
  who: 'anggota' | 'pengurus';
  roles?: string[];
}[] = [
  { url: '/halaman-yang-tidak-ada', who: 'anggota' },
  { url: '/pengumuman/tidak-ada', who: 'anggota' },
  { url: '/layanan/curhat/tidak-ada', who: 'anggota' },
  { url: '/layanan/testi/teknik-informatika/3/tidak-ada', who: 'anggota' },
  { url: '/layanan/form/tidak-ada', who: 'anggota' },
  { url: '/kalender?acara=tidak-ada', who: 'anggota' },
  { url: '/kelola/sparta/tidak-ada', who: 'pengurus' },
  { url: '/kelola/live/tidak-ada', who: 'pengurus' },
  { url: '/kelola/curhat/tidak-ada', who: 'pengurus', roles: ['curhatadmin'] },
];

for (const nf of NOT_FOUND)
  test.describe(`not found: ${nf.url}`, () => {
    test.use({ persona: nf.who, roles: nf.roles ?? null });
    test(`${nf.url} says it isn’t there, in Indonesian, with a way back`, async ({
      page,
      api,
    }, testInfo) => {
      test.skip(
        !QA_LAYOUT.test(testInfo.project.name) ||
          !/light$/.test(testInfo.project.name),
        'light',
      );
      await openSettled(page, api, nf.url);
      const text = await bodyText(page);
      expect(text).not.toMatch(PROGRAMMER);
      expect(text).toMatch(
        /tidak ditemukan|tidak ada|sudah dihapus|tidak bisa dibuka/i,
      );
      // A way back: Ke Beranda, a link up, or the shell's back button and navigation.
      await expect(
        page
          .getByRole('link', {
            name: /Ke Beranda|Kembali|Ke Kelola|Ke Layanan|Ke Pengumuman/,
          })
          .or(page.getByRole('button', { name: /Kembali|Ke Beranda/ }))
          .or(page.getByRole('navigation', { name: 'Navigasi utama' }))
          .first(),
      ).toBeVisible();
    });
  });
