/**
 * Global search's sources (P1-A): Tindakan and Pintasan to start, Kalender and Mata kuliah from the device's data,
 * Pengumuman and Orang from the API from 3 characters, the theme and notification actions, the empty result, the
 * keyboard, and a failing API leaving the local groups. P0-C's journeys (shell.spec.ts) cover the palette itself.
 */
import type { Page } from '@playwright/test';
import type { CalendarEvent } from '../../src/api/generated';
import { layoutOf } from '../support/app';
import { defaultHandlers } from '../support/handlers';
import { reply } from '../support/mock';
import * as writes from '../support/writes';
import { strictGates } from '../support/p1a';
import { strictAudit } from '../support/strict';
import { expect, test } from '../support/test';

const palette = (page: Page) =>
  page.getByRole('dialog', { name: 'Pencarian global' });
const field = (page: Page) =>
  palette(page).getByRole('combobox', { name: 'Cari di PIPS!' });
const groups = (page: Page) =>
  palette(page).locator('[cmdk-group-heading]').allTextContents();
const options = (page: Page) => palette(page).getByRole('option');

async function openSearch(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Halo/ })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette(page)).toBeVisible();
}

const event = (
  id: string,
  title: string,
  start: string,
  end: string,
  courseId: string,
): CalendarEvent => ({
  id,
  calendarGroupId: `group-${courseId}`,
  courseId,
  title,
  description: '',
  category: 'akademik',
  academicYear: 2026,
  academicSemesterCode: 'Ganjil',
  start: new Date(`${start}:00+07:00`).toISOString(),
  end: new Date(`${end}:00+07:00`).toISOString(),
  googleCalendarUrl: `https://calendar.google.com/calendar/event?eid=${id}`,
  googleCalendarId: id,
});

test('to start: Tindakan, then Pintasan; key hints only on desktop, Tutup on phones', async ({
  page,
}, testInfo) => {
  await openSearch(page);
  expect(await groups(page)).toEqual(['Tindakan', 'Pintasan']);
  await expect(options(page)).toHaveText([
    /^Buat pengumuman/,
    /^Tambah mata kuliah/,
    /^Ding Dong/,
    /^Testi Matkul/,
    /^NIM Finder/,
    /^Bayar Kas!/,
  ]);
  await expect(
    palette(page).getByRole('button', { name: 'Tutup' }),
  ).toBeVisible();
  if (layoutOf(testInfo) === 'desktop')
    await expect(palette(page).getByText('Enter buka')).toBeVisible();
  else await expect(palette(page).getByText('Enter buka')).toBeHidden();
  await strictGates(page, testInfo, 'search-start');
  await options(page).first().click();
  await expect(page).toHaveURL(/\/pengumuman\/tulis$/);
});

test('/ opens it when focus isn’t in a field @desktop-only', async ({
  page,
}) => {
  await page.goto('/kalender');
  await page.locator('#isi').focus();
  await page.keyboard.press('/');
  await expect(palette(page)).toBeVisible();
});

test.describe('Raka', () => {
  test.use({ persona: 'pengurus' });
  test('“IF3170” finds his events within 21 days and the course; Enter opens the first', async ({
    page,
    db,
  }, testInfo) => {
    // P3-B's add-event flow added Kuis 2 for IF3170 on 13 Oktober, 13.00–15.00 (the locked i-palette capture).
    db.events.push(
      event(
        'b10',
        'Kuis 2',
        '2026-10-13T13:00',
        '2026-10-13T15:00',
        'course-IF3170',
      ),
    );
    await openSearch(page);
    await field(page).fill('IF3170');
    await expect.poll(() => groups(page)).toEqual(['Kalender', 'Mata kuliah']);
    await expect(options(page)).toHaveText([
      /^Kuis 2 · IF3170\s*Sel 13 Okt 13\.00$/,
      /^UTS · IF3170\s*Rab 21 Okt 13\.00$/,
      /^IF3170 Inteligensi Buatan\s*Ding Dong$/,
    ]);
    // Kuis 1 this morning has passed.
    await expect(options(page).filter({ hasText: 'Kuis 1' })).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(palette(page)).toBeHidden();
    if (layoutOf(testInfo) === 'desktop') {
      await expect(page).toHaveURL(
        /\/kalender\?.*hari=2026-10-13.*acara=b10|acara=b10.*hari=2026-10-13/,
      );
      await expect(
        page
          .getByRole('region', { name: 'Acara hari terpilih' })
          .getByRole('heading', { name: 'Kuis 2' }),
      ).toBeVisible();
    } else {
      // Over Beranda, where search was opened.
      await expect(page).toHaveURL(/^[^?]*\/\?acara=b10$/);
      await expect(
        page
          .getByRole('dialog', { name: 'Detail acara' })
          .getByText('IF3170 · Inteligensi Buatan'),
      ).toBeVisible();
    }
  });

  test('with notifications on, “notif” offers no Nyalakan notifikasi', async ({
    page,
  }) => {
    await openSearch(page);
    await field(page).fill('notif');
    await expect(
      options(page).filter({ hasText: 'Nyalakan notifikasi' }),
    ).toHaveCount(0);
  });
});

test('announcements and people come from the API from 3 characters', async ({
  page,
  api,
}) => {
  await openSearch(page);
  await field(page).fill('na');
  await page.waitForTimeout(600);
  expect(api.calls('GET /api/user/nim')).toHaveLength(0);
  expect(
    api.calls('GET /api/info').filter((c) => c.query.includes('search=')),
  ).toHaveLength(0);

  await field(page).fill('gemastik');
  await expect(
    options(page).filter({ hasText: 'Cari tim Gemastik XIX? Isi form ini' }),
  ).toBeVisible();
  expect(
    api
      .calls('GET /api/info')
      .some((c) => new URLSearchParams(c.query).get('search') === 'gemastik'),
  ).toBe(true);

  await field(page).fill('nadia');
  const nadia = options(page).filter({ hasText: 'Nadia Putri' });
  await expect(nadia).toContainText('13525045 · IF');
  expect(
    api
      .calls('GET /api/user/nim')
      .some((c) => new URLSearchParams(c.query).get('search') === 'nadia'),
  ).toBe(true);
  await nadia.click();
  await expect(page).toHaveURL(/\/layanan\/nim\?q=Nadia(\+|%20)Putri$/);
});

test('while people are on their way, search never says nothing was found', async ({
  page,
  api,
}) => {
  const people = defaultHandlers['GET /api/user/nim'];
  api.on('GET /api/user/nim', (ctx) => reply.delay(1500, people(ctx)));
  await openSearch(page);
  // Notes whether the empty result ever shows, however briefly.
  await page.evaluate(() => {
    const w = window as { sawEmpty?: boolean };
    w.sawEmpty = false;
    new MutationObserver(() => {
      if (document.querySelector('.g-pal-empty')) w.sawEmpty = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await field(page).fill('nadia');
  await expect(options(page).filter({ hasText: 'Nadia Putri' })).toBeVisible();
  expect(
    await page.evaluate(() => (window as { sawEmpty?: boolean }).sawEmpty),
  ).toBe(false);
  // Once nothing is on its way, an empty result still says so.
  await field(page).fill('zzzz');
  await expect(
    palette(page).getByText('Tidak ada hasil untuk “zzzz”.'),
  ).toBeVisible();
});

test('results that arrive from the API take the highlight while you haven’t moved it: Enter opens the first', async ({
  page,
  api,
}) => {
  const posts = defaultHandlers['GET /api/info'];
  api.on('GET /api/info', (ctx) => reply.delay(800, posts(ctx)));
  api.on('POST /api/info/:infoId/read', writes.markRead);
  await openSearch(page);
  await field(page).fill('uts');
  // The device's own results first: an event, highlighted.
  await expect(options(page).first()).toContainText('UTS');
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
  // The announcement arrives and ranks above it (Pengumuman before Kalender): it takes the highlight.
  const post = options(page).filter({
    hasText: 'Jadwal UTS Ganjil 2026/2027 sudah keluar',
  });
  await expect(post).toHaveAttribute('aria-selected', 'true');
  expect(await groups(page)).toEqual(
    expect.arrayContaining(['Pengumuman', 'Kalender']),
  );
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pengumuman\/p1$/);
});

test('once you move the highlight, arriving results leave it where you put it', async ({
  page,
  api,
}) => {
  const posts = defaultHandlers['GET /api/info'];
  api.on('GET /api/info', (ctx) => reply.delay(800, posts(ctx)));
  await openSearch(page);
  await field(page).fill('uts');
  await expect(options(page).first()).toContainText('UTS');
  await page.keyboard.press('ArrowDown');
  const chosen = palette(page).locator('[role="option"][aria-selected="true"]');
  const label = await chosen.textContent();
  await expect(
    options(page).filter({
      hasText: 'Jadwal UTS Ganjil 2026/2027 sudah keluar',
    }),
  ).toBeVisible();
  await expect(chosen).toHaveText(label!);
});

test('a course opens its Ding Dong folder in a new tab', async ({ page }) => {
  await openSearch(page);
  await field(page).fill('IF2110');
  const course = options(page).filter({
    hasText: 'IF2110 Algoritma dan Pemrograman II',
  });
  await expect(course).toContainText('Ding Dong');
  // The harness keeps the outside world out, so record what the app asks the browser to open.
  await page.evaluate(() => {
    (window as unknown as { opened: unknown[] }).opened = [];
    window.open = (...args: unknown[]) => {
      (window as unknown as { opened: unknown[] }).opened.push(args);
      return null;
    };
  });
  await course.click();
  expect(
    await page.evaluate(
      () => (window as unknown as { opened: unknown[] }).opened,
    ),
  ).toEqual([
    [
      'https://drive.google.com/drive/folders/e2e-IF2110',
      '_blank',
      'noopener,noreferrer',
    ],
  ]);
});

test('“gelap” switches the theme; “notif” turns notifications on while they are off', async ({
  page,
}, testInfo) => {
  const dark = testInfo.project.name.endsWith('dark');
  await openSearch(page);
  await field(page).fill(dark ? 'terang' : 'gelap');
  const theme = options(page).filter({
    hasText: dark ? 'Ganti ke tampilan terang' : 'Ganti ke tampilan gelap',
  });
  await expect(theme).toBeVisible();
  await theme.click();
  await expect(page.locator('html')).toHaveClass(
    dark ? /^(?!.*\bdark\b)/ : /\bdark\b/,
  );
  await page.keyboard.press('ControlOrMeta+k');
  await field(page).fill('notif');
  await options(page).filter({ hasText: 'Nyalakan notifikasi' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Nyalakan notifikasi?' }),
  ).toBeVisible();
});

test('arrows move through the results, up from the first goes back to the field; Escape closes', async ({
  page,
}) => {
  await openSearch(page);
  await field(page).fill('uts');
  await expect(options(page).first()).toBeVisible();
  const first = await options(page).first().textContent();
  await page.keyboard.press('ArrowDown');
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(options(page).first()).toHaveAttribute('aria-selected', 'true');
  await expect(field(page)).toBeFocused();
  expect(first).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(palette(page)).toBeHidden();
});

test('nothing found says so; a failing API leaves the local groups', async ({
  page,
  api,
}) => {
  api.on('GET /api/info', ({ query }) =>
    query.get('search') ? reply.status(503) : { infos: [] },
  );
  api.on('GET /api/user/nim', reply.status(503));
  await openSearch(page);
  await field(page).fill('zzzz');
  await expect(
    palette(page).getByText('Tidak ada hasil untuk “zzzz”.'),
  ).toBeVisible();
  await field(page).fill('uts');
  await page.waitForTimeout(600);
  await expect.poll(() => groups(page)).toContain('Kalender');
  expect(await groups(page)).not.toContain('Pengumuman');
  expect(await groups(page)).not.toContain('Orang');
});

test('regression (F2-001, F1-1): a search with no result passes axe, with the field still naming its list', async ({
  page,
}, testInfo) => {
  await openSearch(page);
  await field(page).fill('zzzz');
  await expect(
    palette(page).getByText('Tidak ada hasil untuk “zzzz”.'),
  ).toBeVisible();
  // Before the fix the list stayed in the page as an empty listbox: axe's aria-required-children (critical).
  await strictAudit(page, testInfo, 'search with no result');
  const controls = await field(page).getAttribute('aria-controls');
  expect(controls).toBeTruthy();
  await expect(page.locator(`[id="${controls}"]`)).toHaveCount(1);
  // A new query that finds something brings the list back, and Enter still opens the first result.
  await field(page).fill('kalender');
  await expect(options(page).first()).toBeVisible();
});
