/**
 * Kalender (P1-A): today on open with its month asked for, a deadline and its detail, the reminder line for each push
 * state, the detail's links, the month buttons and Hari ini, the grid's keyboard model, desktop's chosen event,
 * "+N lagi", Tambah acara, the URL, and the loading, error and offline states. Replaces T3's calendar.spec.ts,
 * keeping what it checked (today's month asked for, Raka reaching the add-event flow, no history entry of its own).
 */
import type { Page } from '@playwright/test';
import type { CalendarEvent } from '../../src/api/generated';
import { layoutOf, navLink } from '../support/app';
import { reply } from '../support/mock';
import {
  expectFits,
  focusIsVisible,
  mainText,
  strictGates,
} from '../support/p1a';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const grid = (page: Page, month = 'Oktober 2026') =>
  main(page).getByRole('group', { name: month });
const day = (page: Page, name: RegExp | string, month?: string) =>
  grid(page, month).getByRole('button', { name });
const side = (page: Page) =>
  page.getByRole('region', { name: 'Acara hari terpilih' });
/** The chosen day's rows (in the page on phones, the side column on desktop): titles and course lines. */
const dayRows = (page: Page) =>
  main(page).locator('.g-agenda-item > span:last-child > .block');
const detail = (page: Page, desk: boolean) =>
  desk ? side(page) : page.getByRole('dialog', { name: 'Detail acara' });
const monthHeading = (page: Page, desk: boolean, name: string) =>
  desk
    ? main(page).getByRole('heading', { level: 1, name })
    : main(page).getByText(name, { exact: true });

const event = (
  id: string,
  title: string,
  start: string,
  end = start,
  courseId: string | null = null,
): CalendarEvent => ({
  id,
  calendarGroupId: courseId ? `group-${courseId}` : 'group-himpunan',
  courseId,
  title,
  description: '',
  category: courseId ? 'akademik' : 'himpunan',
  academicYear: 2026,
  academicSemesterCode: 'Ganjil',
  start: new Date(`${start}:00+07:00`).toISOString(),
  end: new Date(`${end}:00+07:00`).toISOString(),
  googleCalendarUrl: `https://calendar.google.com/calendar/event?eid=${id}`,
  googleCalendarId: id,
});

const asked = (api: { calls: (s: string) => { query: string }[] }) =>
  api
    .calls('GET /api/calendar/me')
    .map((c) => new URLSearchParams(c.query).toString());

test('opens on today, asking for this month; today’s events; the legend; no Tambah acara for Nadia', async ({
  page,
  api,
}, testInfo) => {
  const desk = layoutOf(testInfo) === 'desktop';
  await page.goto('/kalender');
  await expect(page).toHaveTitle('Kalender · PIPS!');
  await expect(navLink(page, 'Kalender')).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(monthHeading(page, desk, 'Oktober 2026')).toBeVisible();
  const today = day(page, /^Kamis, 8 Oktober, hari ini, 2 acara/);
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await expect(
    main(page).getByRole('heading', { name: 'Kamis, 8 Oktober · hari ini' }),
  ).toBeVisible();
  await expect(dayRows(page)).toHaveText([
    'Kuis 2',
    'IF2123 Aljabar Linier dan Geometri',
    'Sharing Session: Magang di Startup',
    'Acara Himpunan',
  ]);
  expect(asked(api)).toContain('month=10&year=2026');
  // Hari ini only away from today; Tambah acara only for akademik or ring1.
  await expect(
    main(page).getByRole('button', { name: 'Hari ini', exact: true }),
  ).toHaveCount(0);
  await expect(
    main(page).getByRole('button', { name: 'Tambah acara' }),
  ).toHaveCount(0);
  await expect(main(page).getByText('Batas waktu')).toBeVisible();
  await expect(
    main(page).getByRole('link', { name: 'Atur mata kuliah' }),
  ).toHaveAttribute('href', '/profil/matkul');
  // Raka's IF3170 quiz isn't Nadia's.
  expect(await mainText(page)).not.toContain('IF3170');
  // Monday first; October 2026 starts on 28 September, muted.
  const first = grid(page).getByRole('button').first();
  await expect(first).toHaveAccessibleName(/^Senin, 28 September/);
  await strictGates(page, testInfo, 'kalender');
});

test('9 Oktober: the deadline says Batas; its detail, reminder and three links', async ({
  page,
}, testInfo) => {
  const desk = layoutOf(testInfo) === 'desktop';
  await page.goto('/kalender');
  await day(page, /^Jumat, 9 Oktober/).click();
  await expect(page).toHaveURL(/hari=2026-10-09/);
  const row = main(page)
    // The day's row (named by its time first), not the grid's cell.
    .getByRole('button', { name: /^23\.59.*Deadline Tugas Besar 1/ });
  await expect(row).toContainText('23.59');
  await expect(row).toContainText('Batas');
  if (!desk) await row.click();
  const d = detail(page, desk);
  await expect(
    d.getByRole('heading', { name: 'Deadline Tugas Besar 1' }),
  ).toBeVisible();
  await expect(d).toContainText('Akademik');
  await expect(d).toContainText('IF2110 · Algoritma dan Pemrograman II');
  await expect(d).toContainText('Paling lambat 23.59 WIB');
  await expect(d).toContainText('Jumat, 9 Oktober 2026');
  await expect(d).toContainText(
    'Kumpulkan di Edunex. Satu kelompok tiga orang.',
  );
  await expect(d).toContainText('Notifikasi belum menyala di perangkat ini');
  const gcal = d.getByRole('link', { name: /Google Calendar/ });
  await expect(gcal).toHaveAttribute(
    'href',
    'https://calendar.google.com/calendar/event?eid=e2e-a3',
  );
  await expect(gcal).toHaveAttribute('target', '_blank');
  await expect(d.getByRole('link', { name: 'Ding Dong' })).toHaveAttribute(
    'href',
    '/layanan/dingdong',
  );
  await expect(d.getByRole('link', { name: 'Testi Matkul' })).toHaveAttribute(
    'href',
    '/layanan/testi/teknik-informatika/3/course-IF2110',
  );
  await strictGates(page, testInfo, 'kalender-detail');
  await d.getByRole('link', { name: 'Ding Dong' }).click();
  await expect(page).toHaveURL(/\/layanan\/dingdong$/);
});

test.describe('Pengingat H-1 with notifications on', () => {
  test.use({ push: 'on' });
  test('already sent for Kuis 2, still to come for the deadline', async ({
    page,
  }, testInfo) => {
    const desk = layoutOf(testInfo) === 'desktop';
    await page.goto('/kalender?hari=2026-10-08&acara=a2');
    await expect(detail(page, desk)).toContainText(
      'Sudah dikirim Rab 7 Okt, 15.00',
    );
    await page.goto('/kalender?hari=2026-10-09&acara=a3');
    await expect(detail(page, desk)).toContainText('Dikirim Kam 8 Okt, 23.59');
  });
});

test.describe('Pengingat H-1 with notifications blocked', () => {
  test.use({ push: 'blocked' });
  test('says notifications are off on this device', async ({
    page,
  }, testInfo) => {
    await page.goto('/kalender?hari=2026-10-09&acara=a3');
    await expect(detail(page, layoutOf(testInfo) === 'desktop')).toContainText(
      'Notifikasi belum menyala di perangkat ini',
    );
  });
});

test('a Himpunan event has no course links; an ended one says Sudah lewat', async ({
  page,
}, testInfo) => {
  const desk = layoutOf(testInfo) === 'desktop';
  await page.goto('/kalender?hari=2026-10-08&acara=h1');
  const d = detail(page, desk);
  await expect(
    d.getByRole('heading', { name: 'Sharing Session: Magang di Startup' }),
  ).toBeVisible();
  await expect(d).toContainText('Himpunan');
  await expect(d.getByRole('link', { name: 'Ding Dong' })).toHaveCount(0);
  await page.goto('/kalender?hari=2026-10-07&acara=a1');
  await expect(detail(page, desk)).toContainText('Sudah lewat');
});

test('the month buttons choose today in today’s month, else the 1st; Hari ini comes back and takes focus', async ({
  page,
  api,
}, testInfo) => {
  const desk = layoutOf(testInfo) === 'desktop';
  await page.goto('/kalender');
  await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
  await expect(monthHeading(page, desk, 'November 2026')).toBeVisible();
  await expect(
    day(page, /^Minggu, 1 November/, 'November 2026'),
  ).toHaveAttribute('aria-pressed', 'true');
  // A month away loads its own events (regression: today's calendar loaded the three months around today only).
  await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
  await expect(monthHeading(page, desk, 'Desember 2026')).toBeVisible();
  await expect.poll(() => asked(api)).toContain('month=12&year=2026');
  await main(page).getByRole('button', { name: 'Bulan sebelumnya' }).click();
  await day(page, /^Selasa, 10 November/, 'November 2026').click();
  await expect(
    main(page).getByText('Dies Natalis HMIF ke-44').first(),
  ).toBeVisible();
  await main(page)
    .getByRole('button', { name: 'Hari ini', exact: true })
    .click();
  await expect(monthHeading(page, desk, 'Oktober 2026')).toBeVisible();
  const today = day(page, /^Kamis, 8 Oktober, hari ini/);
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await expect(today).toBeFocused();
  await expect(
    main(page).getByRole('button', { name: 'Hari ini', exact: true }),
  ).toHaveCount(0);
  await main(page).getByRole('button', { name: 'Bulan sebelumnya' }).click();
  await expect(
    day(page, /^Selasa, 1 September/, 'September 2026'),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('the keyboard: one Tab stop, arrows, Home and End, Page Up and Down, Enter chooses', async ({
  page,
}, testInfo) => {
  const desk = layoutOf(testInfo) === 'desktop';
  await page.goto('/kalender');
  const today = day(page, /^Kamis, 8 Oktober/);
  await today.focus();
  // One tab stop: every other day is out of the Tab order.
  await expect(grid(page).locator('button[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(day(page, /^Jumat, 9 Oktober/)).toBeFocused();
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(day(page, /^Jumat, 16 Oktober/)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(day(page, /^Senin, 12 Oktober/)).toBeFocused();
  await page.keyboard.press('End');
  await expect(day(page, /^Minggu, 18 Oktober/)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(day(page, /^Minggu, 11 Oktober/)).toBeFocused();
  expect(await focusIsVisible(page)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(day(page, /^Minggu, 11 Oktober/)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(main(page).getByText('Tidak ada acara.')).toBeVisible();
  await page.keyboard.press('PageDown');
  await expect(monthHeading(page, desk, 'November 2026')).toBeVisible();
  await expect(day(page, /^Rabu, 11 November/, 'November 2026')).toBeFocused();
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await expect(
    day(page, /^Jumat, 11 September/, 'September 2026'),
  ).toBeFocused();
  await page.keyboard.press(' ');
  await expect(
    day(page, /^Jumat, 11 September/, 'September 2026'),
  ).toHaveAttribute('aria-pressed', 'true');
  // The Tab stop follows: Tab out and back lands on the same day.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(
    day(page, /^Jumat, 11 September/, 'September 2026'),
  ).toBeFocused();
});

test('choosing days replaces the entry: Back leaves Kalender; reload keeps the day', async ({
  page,
}) => {
  await page.goto('/kalender');
  await expect(day(page, /^Kamis, 8 Oktober/)).toBeVisible();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => history.length)).toBe(2);
  await day(page, /^Senin, 12 Oktober/).click();
  await day(page, /^Rabu, 14 Oktober/).click();
  expect(await page.evaluate(() => history.length)).toBe(2);
  await page.reload();
  await expect(day(page, /^Rabu, 14 Oktober/)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('an event opens in a sheet on phones and tablets; Escape closes it and focus returns @phone-only', async ({
  page,
}, testInfo) => {
  await page.goto('/kalender');
  const row = main(page).getByRole('button', { name: /^15\.00.*Kuis 2/ });
  await row.click();
  const sheet = page.getByRole('dialog', { name: 'Detail acara' });
  await expect(sheet.getByRole('heading', { name: 'Kuis 2' })).toBeVisible();
  await strictGates(page, testInfo, 'kalender-sheet');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(row).toBeFocused();
  await expect(page).not.toHaveURL(/acara=/);
});

test('an unknown event id opens nothing and is dropped', async ({ page }) => {
  await page.goto('/kalender?acara=nope');
  await expect(day(page, /^Kamis, 8 Oktober/)).toBeVisible();
  await expect(page).not.toHaveURL(/acara=/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('an event in a month not on screen, from a link, is fetched by its id', async ({
  page,
  api,
  db,
}, testInfo) => {
  db.events.push(
    event(
      'j1',
      'Malam Tahun Baru HMIF',
      '2027-01-08T19:00',
      '2027-01-08T22:00',
    ),
  );
  await page.goto('/kalender?hari=2026-10-08&acara=j1');
  await expect(
    detail(page, layoutOf(testInfo) === 'desktop').getByRole('heading', {
      name: 'Malam Tahun Baru HMIF',
    }),
  ).toBeVisible();
  expect(api.calls('GET /api/calendar/event/:eventId')).toHaveLength(1);
});

test.describe('desktop', () => {
  test('today chooses the first event not yet ended; a day its first; a month none @desktop-only', async ({
    page,
  }) => {
    await page.goto('/kalender');
    await expect(
      side(page).getByRole('heading', { name: 'Kuis 2' }),
    ).toBeVisible();
    await expect(
      side(page).getByRole('button', { name: /Kuis 2/ }),
    ).toHaveAttribute('aria-current', 'true');
    await day(page, /^Rabu, 7 Oktober/).click();
    await expect(
      side(page).getByRole('heading', { name: 'Kuis 1' }),
    ).toBeVisible();
    await expect(side(page)).toContainText('Sudah lewat');
    await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
    await expect(
      side(page).getByText('Pilih acara untuk melihat detailnya.'),
    ).toBeVisible();
    // A cell names its events.
    await main(page).getByRole('button', { name: 'Bulan sebelumnya' }).click();
    await expect(
      day(
        page,
        'Kamis, 8 Oktober, hari ini, 2 acara: Kuis 2 · IF2123, Sharing Session: Magang di Startup',
      ),
    ).toBeVisible();
  });

  test('a third event shows as +1 lagi @desktop-only', async ({ page, db }) => {
    db.events.push(
      event('x1', 'Rapat Divisi', '2026-10-08T20:00', '2026-10-08T21:00'),
    );
    await page.goto('/kalender');
    await expect(day(page, /^Kamis, 8 Oktober/)).toContainText('+1 lagi');
    await expect(day(page, /^Kamis, 8 Oktober/)).toHaveAccessibleName(
      /3 acara: .*Rapat Divisi/,
    );
  });
});

test.describe('Raka, akademik', () => {
  test.use({ persona: 'pengurus' });

  test('Tambah acara opens today’s add-event flow', async ({
    page,
  }, testInfo) => {
    await page.goto('/kalender');
    if (layoutOf(testInfo) === 'desktop')
      await expect(
        side(page).getByRole('heading', {
          name: 'Sharing Session: Magang di Startup',
        }),
      ).toBeVisible();
    await main(page).getByRole('button', { name: 'Tambah acara' }).click();
    // Today's form, unchanged until P3-B: a drawer on phones and tablets, a panel on desktop; Raka adds Akademik events.
    await expect(
      page.getByPlaceholder('Add Title').locator('visible=true'),
    ).toBeVisible();
  });
});

test.describe('states', () => {
  test('loading: the grid draws at once; the day list shows a skeleton', async ({
    page,
    api,
  }) => {
    api.on('GET /api/calendar/me', reply.hang());
    await page.goto('/kalender');
    await expect(day(page, /^Kamis, 8 Oktober/)).toBeVisible();
    await expect(
      page.getByRole('status', { name: 'Memuat acara…' }),
    ).toBeVisible();
  });

  test('an error with Coba lagi that retries', async ({ page, api, db }) => {
    api.on('GET /api/calendar/me', reply.status(503));
    await page.goto('/kalender');
    const alert = main(page).getByRole('alert');
    // The client retries a 5xx three times (1, 2 and 4 s) before it says so.
    await expect(alert).toContainText('Acara gagal dimuat.', {
      timeout: 15_000,
    });
    api.on('GET /api/calendar/me', ({ query }) =>
      db.events.filter(
        (e) =>
          new Date(Date.parse(e.start) + 7 * 36e5).getUTCMonth() + 1 ===
          Number(query.get('month')),
      ),
    );
    await alert.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(dayRows(page).first()).toHaveText('Kuis 2');
  });

  test('offline: a kept month under the offline line; a month not kept says so', async ({
    page,
    api,
  }, testInfo) => {
    const desk = layoutOf(testInfo) === 'desktop';
    await page.goto('/kalender');
    await expect(dayRows(page).first()).toHaveText('Kuis 2');
    await api.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(
      main(page)
        .getByRole('status')
        .filter({ hasText: /^Offline · diperbarui/ }),
    ).toBeVisible();
    await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
    await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
    await expect(monthHeading(page, desk, 'Desember 2026')).toBeVisible();
    await expect(main(page).getByRole('alert')).toContainText(
      'Acara bulan ini belum tersimpan di perangkat ini.',
    );
  });
});

test('Kalender fits at 320, 390, 768, 1024 and 1440 px and at 200% zoom', async ({
  page,
}, testInfo) => {
  test.skip(layoutOf(testInfo) !== 'desktop', 'one run covers every width');
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [720, 450],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/kalender');
    await expect(day(page, /^Kamis, 8 Oktober/)).toBeVisible();
    await expectFits(page, `Kalender at ${width} px`);
    // Seven 44 px days on a 320 px phone.
    if (width === 320) {
      const w = await day(page, /^Kamis, 8 Oktober/).evaluate(
        (el) => el.getBoundingClientRect().width,
      );
      expect(w).toBeGreaterThanOrEqual(44);
    }
  }
});
