/**
 * Info Lomba for members (P2-B): open competitions, soonest deadline first, every page reachable. Phone, tablet and
 * desktop, light and dark, with strict gates.
 */
import type { Page } from '@playwright/test';
import type { Competition } from '../../src/api/generated';
import { reply } from '../support/mock';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const names = (page: Page) =>
  main(page).getByRole('heading', { level: 2 }).allTextContents();
const offsets = (api: { calls: (s: string) => { query: string }[] }) =>
  api
    .calls('GET /api/competitions')
    .map((c) => new URLSearchParams(c.query).get('offset'));

/** A competition closing `days` days after the harness's now (Kamis, 8 Oktober 2026), at 23.59 WIB. */
function competition(
  base: Competition,
  id: string,
  name: string,
  close: string,
  over: Partial<Competition> = {},
): Competition {
  return {
    ...base,
    id,
    name,
    registrationDeadline: close,
    registrationUrl: `https://example.org/e2e/${id}/daftar`,
    sourceUrl: `https://example.org/e2e/${id}`,
    medias: [],
    ...over,
  };
}

test.describe('Info Lomba', () => {
  test('soonest deadline first, each with its deadline, fee, Daftar and Sumber', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/layanan/lomba');
    await expect
      .poll(() => names(page))
      .toEqual([
        'COMPFEST 18: Capture The Flag',
        'Gemastik XIX',
        'Hology 2026: UI/UX Design',
        'Find IT! 2026',
      ]);
    // The deadline in WIB, as a date and time; none closes within 3 days, so none takes the danger colour.
    const close = main(page).getByText('Tutup Rab 14 Okt, 23.59');
    await expect(close).toBeVisible();
    await expect(close).not.toHaveClass(/\burgent\b/);
    await expect(main(page).getByText('Rp150.000')).toBeVisible();
    await expect(main(page).getByText('Gratis')).toHaveCount(2);
    // The categories as tags.
    await expect(
      main(page).getByText('Data Science / Data Analytics'),
    ).toBeVisible();
    // Daftar and Sumber: other sites in a new tab, each named for its competition.
    const daftar = main(page).getByRole('link', {
      name: 'Daftar COMPFEST 18: Capture The Flag (situs luar, tab baru)',
    });
    await expect(daftar).toHaveAttribute(
      'href',
      'https://example.org/e2e/l2/daftar',
    );
    await expect(daftar).toHaveAttribute('target', '_blank');
    await expect(daftar).toHaveAttribute('rel', /noopener/);
    const sumber = main(page).getByRole('link', {
      name: 'Sumber Gemastik XIX (situs luar, tab baru)',
    });
    await expect(sumber).toHaveAttribute('href', 'https://example.org/e2e/l1');
    await expect(sumber).toHaveAttribute('target', '_blank');
    await expect(
      main(page).getByRole('link', { name: /^Daftar / }),
    ).toHaveCount(4);
    // Four competitions, one short page: nothing more to load.
    await expect(
      main(page).getByRole('button', { name: 'Muat lagi' }),
    ).toHaveCount(0);
    expect(offsets(api)).toEqual(['0']);
    expect(
      new URLSearchParams(api.calls('GET /api/competitions')[0].query).get(
        'sort',
      ),
    ).toBe('deadline');
    await strictGates(page, testInfo, 'lomba', 'Layanan');
  });

  test('within 3 days the line turns the danger colour; a closed one is left out; a link without a scheme gets https://', async ({
    page,
    api,
    db,
  }) => {
    const base = db.competitions[0];
    const soon = competition(
      base,
      's1',
      'Lomba Segera',
      '2026-10-11T16:59:00Z',
      {
        registrationUrl: 'example.org/e2e/s1/daftar',
      },
    );
    const later = competition(
      base,
      's2',
      'Lomba Nanti',
      '2026-10-11T17:00:00Z',
    );
    // A list kept from earlier can still hold one that has closed since; the app's clock leaves it out.
    const closed = competition(
      base,
      's0',
      'Lomba Lewat',
      '2026-10-08T05:00:00Z',
    );
    api.on('GET /api/competitions', { competitions: [closed, soon, later] });
    await page.goto('/layanan/lomba');
    await expect
      .poll(() => names(page))
      .toEqual(['Lomba Segera', 'Lomba Nanti']);
    // Sunday 11 October 23.59 WIB is 3 days away; Monday 12 October 00.00 is 4.
    await expect(main(page).getByText('Tutup Min 11 Okt, 23.59')).toHaveClass(
      /\burgent\b/,
    );
    await expect(
      main(page).getByText('Tutup Sen 12 Okt, 00.00'),
    ).not.toHaveClass(/\burgent\b/);
    await expect(
      main(page).getByRole('link', { name: /^Daftar Lomba Segera/ }),
    ).toHaveAttribute('href', 'https://example.org/e2e/s1/daftar');
  });

  for (const how of ['scroll', 'Muat lagi'] as const) {
    test(`regression: 12 competitions, the second page at offset 10 by ${how}, then no third request`, async ({
      page,
      api,
      db,
      context,
    }) => {
      if (how === 'Muat lagi')
        // Nothing scrolls into view by itself: only the button can load more.
        await context.addInitScript(() => {
          window.IntersectionObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
            takeRecords() {
              return [];
            }
          } as unknown as typeof IntersectionObserver;
        });
      const base = db.competitions[0];
      db.competitions = Array.from({ length: 12 }, (_, i) =>
        competition(
          base,
          `m${i + 1}`,
          `Lomba ${String(i + 1).padStart(2, '0')}`,
          `2026-11-${String(i + 1).padStart(2, '0')}T16:59:00Z`,
        ),
      );
      await page.goto('/layanan/lomba');
      await expect.poll(async () => (await names(page)).length).toBe(10);
      expect(offsets(api)).toEqual(['0']);
      const more = main(page).getByRole('button', { name: 'Muat lagi' });
      // Scrolling the list's end into view loads more by itself; the button does the same, from the keyboard.
      if (how === 'scroll') await more.scrollIntoViewIfNeeded();
      else {
        await more.focus();
        await page.keyboard.press('Enter');
      }
      await expect.poll(async () => (await names(page)).length).toBe(12);
      expect(offsets(api)).toEqual(['0', '10']);
      // The second page was short: no more to ask for.
      await expect(more).toHaveCount(0);
      // Regression (P2-B review, finding 1): the button went away with focus on it, dropping keyboard users to the
      // page's start. Focus moves to the first competition that just arrived.
      if (how === 'Muat lagi')
        await expect(
          main(page).getByRole('heading', { level: 2, name: 'Lomba 11' }),
        ).toBeFocused();
      await page.waitForTimeout(500);
      expect(offsets(api)).toEqual(['0', '10']);
    });
  }

  test('regression: when the next page fails, focus moves from Muat lagi to Coba lagi, then to what arrives', async ({
    page,
    api,
    db,
    context,
  }) => {
    await context.addInitScript(() => {
      window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;
    });
    const base = db.competitions[0];
    const all = Array.from({ length: 12 }, (_, i) =>
      competition(
        base,
        `m${i + 1}`,
        `Lomba ${String(i + 1).padStart(2, '0')}`,
        `2026-11-${String(i + 1).padStart(2, '0')}T16:59:00Z`,
      ),
    );
    let fail = true;
    api.on('GET /api/competitions', ({ query }) => {
      const offset = Number(query.get('offset') ?? 0);
      if (offset > 0 && fail) return reply.status(503);
      return { competitions: all.slice(offset, offset + 10) };
    });
    await page.goto('/layanan/lomba');
    await expect.poll(async () => (await names(page)).length).toBe(10);
    await main(page).getByRole('button', { name: 'Muat lagi' }).focus();
    await page.keyboard.press('Enter');
    const retry = main(page).getByRole('button', { name: 'Coba lagi' });
    await expect(
      main(page).getByText('Lomba berikutnya gagal dimuat.'),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(retry).toBeFocused();
    fail = false;
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await names(page)).length).toBe(12);
    await expect(
      main(page).getByRole('heading', { level: 2, name: 'Lomba 11' }),
    ).toBeFocused();
  });

  test('nothing open: says so', async ({ page, db }, testInfo) => {
    db.competitions = [];
    await page.goto('/layanan/lomba');
    await expect(
      main(page).getByText('Belum ada lomba yang dibuka'),
    ).toBeVisible();
    await strictAudit(page, testInfo, 'lomba-empty');
  });

  test('loading shows cards being loaded', async ({ page, api }) => {
    api.on('GET /api/competitions', reply.hang());
    await page.goto('/layanan/lomba');
    await expect(
      main(page).getByRole('status', { name: 'Memuat lomba…' }),
    ).toBeVisible();
  });

  test('a 503 says what failed and Coba lagi recovers', async ({
    page,
    api,
    db,
  }, testInfo) => {
    let fail = true;
    api.on('GET /api/competitions', () =>
      fail ? reply.status(503) : { competitions: db.competitions },
    );
    await page.goto('/layanan/lomba');
    await expect(main(page).getByText('Lomba gagal dimuat.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(main(page)).not.toContainText('503');
    await strictAudit(page, testInfo, 'lomba-error');
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect.poll(async () => (await names(page)).length).toBe(4);
  });
});

// Regression (FEATURES.md gap 3): today's phone "+" showed to everyone. Only cnc may add a competition (P3-B).
for (const persona of ['anggota', 'pengurus'] as const) {
  test.describe(`Info Lomba for ${persona}`, () => {
    test.use({ persona });
    test('has no way to add a competition', async ({ page, db }) => {
      expect(db.me!.roles ?? []).not.toContain('cnc');
      await page.goto('/layanan/lomba');
      await expect.poll(async () => (await names(page)).length).toBe(4);
      await expect(page.getByRole('button', { name: /tambah/i })).toHaveCount(
        0,
      );
      await expect(page.getByRole('link', { name: /tambah/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^\+$/ })).toHaveCount(0);
    });
  });
}
