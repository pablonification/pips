/**
 * Garis v5's two small desktop fixes (garis.css, 2026-11-02):
 * - the sidebar brand: the PIPS! wordmark and "HMIF ITB" fill exactly the logo's height (the wordmark's top on the
 *   logo's top, HMIF ITB's bottom on its bottom), in the sidebar and on sign-in, which uses the same piece;
 * - a narrow page's head (`.d-head:has(+ .d-narrow)`): as narrow as its 760 px body, so its action sits by the
 *   content (Hapus ruang on a Curhat room), on every narrow page with a head action. A wide page's head isn't.
 */
import type { Page } from '@playwright/test';
import { expectFits } from '../support/p1a';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

/** The brand's logo, wordmark and HMIF ITB, as drawn. */
async function brandBoxes(page: Page) {
  const brand = page.locator('.g-side-brand').first();
  await expect(brand.locator('img')).toBeVisible();
  const [logo, mark, sub] = await Promise.all(
    ['img', '.g-wordmark', '.sub'].map(
      async (s) => (await brand.locator(s).boundingBox())!,
    ),
  );
  return { logo, mark, sub };
}

test.describe('the brand fills the logo’s height', () => {
  test('in the sidebar: PIPS! on the logo’s top, HMIF ITB on its bottom @desktop-only', async ({
    page,
  }) => {
    await page.goto('/');
    const { logo, mark, sub } = await brandBoxes(page);
    expect(logo.height).toBeCloseTo(36, 0);
    expect(Math.abs(mark.y - logo.y), 'wordmark top').toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(sub.y + sub.height - (logo.y + logo.height)),
      'HMIF ITB bottom',
    ).toBeLessThanOrEqual(0.5);
  });

  test.describe('signed out', () => {
    test.use({ signedIn: false });
    test('on sign-in, the same piece lines up the same way @desktop-only', async ({
      page,
    }) => {
      await page.goto('/login');
      const { logo, mark, sub } = await brandBoxes(page);
      expect(Math.abs(mark.y - logo.y)).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(sub.y + sub.height - (logo.y + logo.height)),
      ).toBeLessThanOrEqual(0.5);
    });
  });
});

/** The page head and the body after it: their edges, and the head's last control's right edge. */
const headAndBody = (page: Page) =>
  page.evaluate(() => {
    const head = document.querySelector<HTMLElement>('#isi .g-d-head')!;
    const body = head.nextElementSibling as HTMLElement;
    const h = head.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    const action = head.lastElementChild!.getBoundingClientRect();
    return {
      narrowBody: body.matches('.g-body:not(.wide)'),
      head: [Math.round(h.left), Math.round(h.right)],
      body: [Math.round(b.left), Math.round(b.right)],
      // The action's right edge against the body's content edge (inside its padding).
      gap: Math.round(
        b.right -
          parseFloat(getComputedStyle(body).paddingRight) -
          action.right,
      ),
    };
  });

const NARROW = [
  {
    what: 'a Curhat room (Hapus ruang)',
    persona: 'anggota',
    url: '/layanan/curhat/r1',
    action: (p: Page) =>
      p.locator('.g-d-head').getByRole('button', { name: 'Hapus ruang' }),
  },
  {
    what: 'Tambah mata kuliah',
    persona: 'anggota',
    url: '/profil/matkul/tambah',
    action: (p: Page) => p.locator('.g-d-head > button'),
  },
  // Info Lomba and a Testi Matkul course were on this list until Garis v5 gave them the wide grid of posters and
  // testimonials; their heads now span that grid (the wide-page test below).
] as const;

for (const c of NARROW) {
  test.describe(c.what, () => {
    test.use({ persona: c.persona });
    test(`a narrow page’s head is as narrow as its body; its action by the content: ${c.what} @desktop-only`, async ({
      page,
      api,
    }) => {
      api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
      await page.goto(c.url);
      await expect(c.action(page)).toBeVisible();
      await expect(page.locator('.g-d-head > *')).toHaveCount(2);
      const m = await headAndBody(page);
      // If another task makes one of these pages wide, this fails: take the page off the list then.
      expect(m.narrowBody, 'the body is narrow').toBe(true);
      expect(m.head).toEqual(m.body);
      expect(m.body[1] - m.body[0]).toBe(760);
      expect(m.gap, 'the action ends at the content’s edge').toBe(0);
      await expectFits(page, c.what);
    });
  });
}

test('a wide page’s head is not narrowed: Beranda’s head spans the window @desktop-only', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Halo, Nadia' }),
  ).toBeVisible();
  const w = await page
    .locator('.g-d-head')
    .evaluate((h) => h.getBoundingClientRect().width);
  expect(w).toBeGreaterThan(760);
});

const WIDE = [
  {
    what: 'Info Lomba for cnc (Tambah)',
    persona: 'anggota',
    roles: ['cnc'],
    url: '/layanan/lomba',
  },
  {
    what: 'a Testi Matkul course for a pengurus (Tambah testimoni)',
    persona: 'pengurus',
    url: '/layanan/testi/teknik-informatika/3/course-IF2110',
  },
] as const;

for (const c of WIDE) {
  test.describe(c.what, () => {
    test.use({
      persona: c.persona,
      ...('roles' in c ? { roles: [...c.roles] } : {}),
    });
    test(`a wide grid page keeps its head as wide as the grid: ${c.what} @desktop-only`, async ({
      page,
    }) => {
      await page.goto(c.url);
      await expect(page.locator('.g-d-head > button')).toBeVisible();
      const m = await headAndBody(page);
      expect(m.narrowBody, 'the body is wide (Garis v5)').toBe(false);
      expect(m.head[1] - m.head[0]).toBeGreaterThan(760);
      expect(m.head[1]).toBeGreaterThanOrEqual(m.body[1] - 1);
      await expectFits(page, c.what);
    });
  });
}
