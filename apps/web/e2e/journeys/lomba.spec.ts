/**
 * Info Lomba for members (P2-B): open competitions, soonest deadline first, every page reachable. Phone, tablet and
 * desktop, light and dark, with strict gates.
 *
 * Garis v5: every competition's 3:4 poster, beside the facts on phones (104 px, 88 px on 320 px phones) and a grid of
 * poster cards on tablets (3 columns) and desktops (3 at 1024, 4 at 1440), Daftar lined up across each row. Tapping a
 * poster opens the poster viewer.
 */
import type { Page, TestInfo } from '@playwright/test';
import type { Competition } from '../../src/api/generated';
import { reply } from '../support/mock';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const names = (page: Page) =>
  main(page).getByRole('heading', { level: 2 }).allTextContents();
const SIX = [
  'COMPFEST 18: Capture The Flag',
  'Gemastik XIX',
  'Hology 2026: UI/UX Design',
  'Find IT! 2026',
  'IT Today 2026: Business IT Case',
  'Technofest 2026: Game Development',
];
const cardsOf = (page: Page) => main(page).getByRole('listitem');
const posterBtn = (page: Page, name: string) =>
  main(page).getByRole('button', { name: `Perbesar poster ${name}` });
const viewer = (page: Page, name: string) => page.getByRole('dialog', { name });

/** The sizes to check in this project: phones 390 and 320, the tablet, desktops 1440 and 1024. */
function sizesFor(testInfo: TestInfo) {
  const p = testInfo.project.name;
  if (p.startsWith('desktop'))
    return [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
    ];
  if (p.startsWith('tablet')) return [{ width: 834, height: 1112 }];
  return [
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ];
}
/** Poster columns (Garis v5): phones one list; tablets 3; desktops 3 at 1024 and 4 at 1440. */
const posterColumns = (width: number) =>
  width < 640 ? 1 : width < 1024 ? 3 : width < 1300 ? 3 : 4;

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
    await expect.poll(() => names(page)).toEqual(SIX);
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
    ).toHaveCount(6);
    // Six competitions, one short page: nothing more to load.
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
    await expect.poll(async () => (await names(page)).length).toBe(6);
  });
});

test.describe('Info Lomba posters (Garis v5)', () => {
  test('every competition has its 3:4 poster: beside the facts on phones, a grid with Daftar lined up elsewhere', async ({
    page,
  }, testInfo) => {
    for (const size of sizesFor(testInfo)) {
      await page.setViewportSize(size);
      await page.goto('/layanan/lomba');
      await expect.poll(() => names(page)).toEqual(SIX);
      for (const name of SIX) {
        const btn = posterBtn(page, name);
        await btn.scrollIntoViewIfNeeded();
        await expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
        const img = btn.getByRole('img', { name: `Poster ${name}` });
        await expect(img).toBeVisible();
        // Loaded, at 3:4, filling its button.
        await expect
          .poll(() =>
            img.evaluate(
              (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
            ),
          )
          .toBe(true);
        const box = (await btn.boundingBox())!;
        expect(Math.abs(box.width / box.height - 0.75)).toBeLessThan(0.01);
      }
      const layout = await cardsOf(page).evaluateAll((els) =>
        els.map((li) => {
          const p = li.querySelector('.g-poster')!.getBoundingClientRect();
          const h = li.querySelector('h2')!.getBoundingClientRect();
          const d = [...li.querySelectorAll('a')]
            .find((a) => a.textContent?.startsWith('Daftar'))!
            .getBoundingClientRect();
          return {
            left: Math.round(li.getBoundingClientRect().left),
            top: Math.round(li.getBoundingClientRect().top),
            posterW: Math.round(p.width),
            beside: p.right <= h.left,
            above: p.bottom <= h.top,
            daftarTop: Math.round(d.top),
          };
        }),
      );
      const cols = posterColumns(size.width);
      expect(
        new Set(layout.map((l) => l.left)).size,
        `columns at ${size.width}`,
      ).toBe(cols);
      if (cols === 1) {
        // Phones: the poster beside the facts, 104 px wide (88 px on a 320 px phone).
        for (const l of layout) {
          expect(l.beside).toBe(true);
          expect(l.posterW).toBe(size.width <= 340 ? 88 : 104);
        }
      } else {
        // A grid of poster cards: the poster above the facts, Daftar at the same height across each row.
        for (const l of layout) expect(l.above).toBe(true);
        const rows = new Map<number, number[]>();
        for (const l of layout)
          rows.set(l.top, [...(rows.get(l.top) ?? []), l.daftarTop]);
        expect(rows.size).toBe(Math.ceil(6 / cols));
        for (const tops of rows.values())
          expect(new Set(tops).size, `Daftar in a row: ${tops}`).toBe(1);
      }
      // Every fact and action kept.
      await expect(main(page).getByText('Rp75.000')).toBeAttached();
      await expect(
        main(page).getByText('Tutup Sen 16 Nov, 23.59'),
      ).toBeAttached();
      await expect(
        main(page).getByRole('link', { name: /^Sumber / }),
      ).toHaveCount(6);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
      await strictGates(
        page,
        testInfo,
        `lomba-posters-${size.width}`,
        'Layanan',
      );
    }
  });

  test('the poster viewer by keyboard: Enter opens it with focus on Tutup, Tab stays inside, Esc gives focus back', async ({
    page,
  }, testInfo) => {
    for (const size of sizesFor(testInfo)) {
      await page.setViewportSize(size);
      await page.goto('/layanan/lomba');
      const btn = posterBtn(page, 'Gemastik XIX');
      await btn.focus();
      await page.keyboard.press('Enter');
      const d = viewer(page, 'Gemastik XIX');
      await expect(d).toBeVisible();
      await expect(d).toHaveAttribute('aria-modal', 'true');
      // Modal for real: the page behind is hidden from assistive technology while it is open.
      await expect(main(page)).toHaveCount(0);
      const close = d.getByRole('button', { name: 'Tutup poster' });
      await expect(close).toBeFocused();
      const img = d.getByRole('img', { name: 'Poster Gemastik XIX' });
      await expect
        .poll(() =>
          img.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
          ),
        )
        .toBe(true);
      // Large, whole and at 3:4, inside the window.
      const r = (await img.boundingBox())!;
      expect(r.height).toBeGreaterThanOrEqual(size.height * 0.5);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(size.width + 1);
      expect(r.y + r.height).toBeLessThanOrEqual(size.height + 1);
      expect(Math.abs(r.width / r.height - 0.75)).toBeLessThan(0.01);
      // The page behind can't be reached.
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(close).toBeFocused();
      await strictAudit(page, testInfo, `lomba-viewer-${size.width}`);
      await page.keyboard.press('Escape');
      await expect(d).toBeHidden();
      await expect(btn).toBeFocused();
      // Enter on Tutup closes it too.
      await page.keyboard.press('Enter');
      await expect(close).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(d).toBeHidden();
      await expect(btn).toBeFocused();
    }
  });

  test('the poster viewer by pointer: Tutup and a tap beside the poster close it, a tap on the poster does not', async ({
    page,
  }, testInfo) => {
    for (const size of sizesFor(testInfo)) {
      await page.setViewportSize(size);
      await page.goto('/layanan/lomba');
      const btn = posterBtn(page, 'Hology 2026: UI/UX Design');
      const d = viewer(page, 'Hology 2026: UI/UX Design');
      await btn.click();
      await expect(d).toBeVisible();
      const img = d.getByRole('img', {
        name: 'Poster Hology 2026: UI/UX Design',
      });
      await img.click();
      await expect(d).toBeVisible();
      await d.getByRole('button', { name: 'Tutup poster' }).click();
      await expect(d).toBeHidden();
      await expect(btn).toBeFocused();

      await btn.click();
      await expect(d).toBeVisible();
      // The backdrop: below the poster's frame, at the bottom of the window.
      await page.mouse.click(size.width / 2, size.height - 6);
      await expect(d).toBeHidden();
      await expect(btn).toBeFocused();
      // And beside it, on wide windows where the poster leaves room.
      await btn.click();
      const r = (await img.boundingBox())!;
      if (r.x > 20) {
        await page.mouse.click(r.x / 2, r.y + r.height / 2);
        await expect(d).toBeHidden();
        await expect(btn).toBeFocused();
      } else await page.keyboard.press('Escape');
    }
  });

  test('a poster that fails to load, or a competition with none, keeps its 3:4 place as a quiet panel', async ({
    page,
    db,
  }, testInfo) => {
    await page.route('**/__e2e__/media/poster-gemastik.svg', (r) =>
      r.fulfill({ status: 404, body: 'not found' }),
    );
    db.competitions[3].medias = [];
    for (const size of sizesFor(testInfo)) {
      await page.setViewportSize(size);
      await page.goto('/layanan/lomba');
      await expect.poll(() => names(page)).toEqual(SIX);
      for (const name of ['Gemastik XIX', 'Find IT! 2026']) {
        const li = cardsOf(page).filter({
          has: page.getByRole('heading', { name, exact: true }),
        });
        await li.scrollIntoViewIfNeeded();
        // No broken image and nothing to open: the panel is decoration.
        await expect(li.getByRole('img')).toHaveCount(0);
        await expect(li.locator('img')).toHaveCount(0);
        await expect(posterBtn(page, name)).toHaveCount(0);
        const panel = li.locator('[data-poster="none"]');
        await expect(panel).toBeVisible();
        await expect(panel).toHaveAttribute('aria-hidden', 'true');
        // The same place as a poster: the same width and 3:4.
        const p = (await panel.boundingBox())!;
        const other = (await posterBtn(
          page,
          'COMPFEST 18: Capture The Flag',
        ).boundingBox())!;
        expect(Math.round(p.width)).toBe(Math.round(other.width));
        expect(Math.abs(p.width / p.height - 0.75)).toBeLessThan(0.01);
        // Its facts and actions stay.
        await expect(
          li.getByRole('link', {
            name: `Daftar ${name} (situs luar, tab baru)`,
          }),
        ).toBeVisible();
      }
      await strictGates(
        page,
        testInfo,
        `lomba-poster-failed-${size.width}`,
        'Layanan',
      );
    }
  });
});

// Regression (FEATURES.md gap 3): today's phone "+" showed to everyone. Only cnc may add a competition (P3-B).
for (const persona of ['anggota', 'pengurus'] as const) {
  test.describe(`Info Lomba for ${persona}`, () => {
    test.use({ persona });
    test('has no way to add a competition', async ({ page, db }) => {
      expect(db.me!.roles ?? []).not.toContain('cnc');
      await page.goto('/layanan/lomba');
      await expect.poll(async () => (await names(page)).length).toBe(6);
      await expect(page.getByRole('button', { name: /tambah/i })).toHaveCount(
        0,
      );
      await expect(page.getByRole('link', { name: /tambah/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^\+$/ })).toHaveCount(0);
    });
  });
}
