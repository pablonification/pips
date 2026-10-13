/**
 * Beranda (P1-A): the greeting, the agenda card and its strip, the service tiles, Perlu ditindaklanjuti and every
 * button in it, Pengumuman belum dibaca, Kelola and Pintasan; opening events; loading, errors, offline and empty
 * states; motion; and the gates at every width. Replaces T3's home.spec.ts, keeping what it checked (Raka's Kuis 1
 * not shown to Nadia, the tiles opening their services).
 */
import type { Page } from '@playwright/test';
import type { CalendarEvent } from '../../src/api/generated';
import { greeting, layoutOf, navLink } from '../support/app';
import { reply } from '../support/mock';
import {
  expectFits,
  focusIsVisible,
  hitSizes,
  mainText,
  strictGates,
} from '../support/p1a';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const agenda = (page: Page) =>
  page.getByRole('region', { name: '8 hari ke depan' });
const strip = (page: Page) =>
  agenda(page).getByRole('group', { name: 'Pilih hari' });
const stripDay = (page: Page, name: RegExp | string) =>
  strip(page).getByRole('button', { name });
/** The chosen day's rows: each row's title, then its course line. */
const agendaRows = (page: Page) =>
  agenda(page)
    .getByRole('listitem')
    .locator('.g-agenda-item > span:last-child > .block');
/** Perlu ditindaklanjuti's rows: each row's title. */
const attentionTitles = (page: Page) =>
  main(page).locator('.g-att > .grow > .t-sub').allTextContents();
const attentionRow = (page: Page, title: string | RegExp) =>
  main(page).locator('.g-att').filter({ hasText: title });
/** A section of Beranda: its heading's wrapper (the heading row's parent). */
const section = (page: Page, name: string) =>
  main(page).getByRole('heading', { name, exact: true }).locator('xpath=../..');
const unreadSection = (page: Page) => section(page, 'Pengumuman belum dibaca');

/** An extra event in WIB wall time. */
const event = (
  id: string,
  title: string,
  start: string,
  end = start,
  category: 'akademik' | 'himpunan' = 'himpunan',
  courseId: string | null = null,
): CalendarEvent => ({
  id,
  calendarGroupId: courseId ? `group-${courseId}` : 'group-himpunan',
  courseId,
  title,
  description: '',
  category,
  academicYear: 2026,
  academicSemesterCode: 'Ganjil',
  start: new Date(`${start}:00+07:00`).toISOString(),
  end: new Date(`${end}:00+07:00`).toISOString(),
  googleCalendarUrl: `https://calendar.google.com/calendar/event?eid=${id}`,
  googleCalendarId: id,
});

test.describe('Nadia', () => {
  test('greets her; the card with today chosen and two events; tiles; follow-ups; three unread titles', async ({
    page,
    db,
  }, testInfo) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await expect(page).toHaveTitle('Beranda · PIPS!');
    await expect(navLink(page, 'Beranda')).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The strip: eight days from today, today chosen, each named for screen readers.
    await expect(strip(page).getByRole('button')).toHaveCount(8);
    await expect(
      stripDay(page, 'Kamis, 8 Oktober, hari ini, 2 acara'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      stripDay(page, 'Jumat, 9 Oktober, besok, 1 acara'),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(agendaRows(page)).toHaveText([
      'Kuis 2',
      'IF2123 Aljabar Linier dan Geometri',
      'Sharing Session: Magang di Startup',
      'Acara Himpunan',
    ]);
    // Raka's Kuis 1 (IF3170) is for a course Nadia doesn't take.
    expect(await mainText(page)).not.toContain('IF3170');

    if (layoutOf(testInfo) === 'desktop') {
      await expect(page.getByRole('region', { name: 'Layanan' })).toHaveCount(
        0,
      );
      await expect(
        main(page).getByRole('heading', { name: 'Pintasan' }),
      ).toBeVisible();
    } else {
      const tiles = page
        .getByRole('region', { name: 'Layanan' })
        .getByRole('link');
      await expect(tiles).toHaveText([
        'Ding Dong',
        'NIM Finder',
        'Testi Matkul',
        'Info Lomba',
        'Curhat Yuk!',
        'Beasiswa (situs luar)',
        'Bayar Kas! (situs luar)',
        'Lainnya',
      ]);
    }

    // Follow-ups, in order, from their signals only; never a Curhat message's text.
    await expect
      .poll(() => attentionTitles(page))
      .toEqual([
        'Deadline Tugas Besar 1 · IF2110',
        'Balasan baru dari Welfare',
        'Form Analisis Kondisi PIXEL',
        'Notifikasi belum menyala',
      ]);
    await expect(attentionRow(page, 'Deadline Tugas')).toContainText(
      'Besok, 23.59',
    );
    await expect(attentionRow(page, 'Welfare')).toContainText(
      'Hari ini, 10.12',
    );
    await expect(attentionRow(page, 'PIXEL')).toContainText('5 bagian');
    const text = await page.evaluate(() => document.body.innerText);
    for (const room of Object.values(db.chatrooms))
      for (const m of room.messages ?? [])
        expect(text, 'no Curhat text on Beranda').not.toContain(m.content);

    // The three newest unread titles, each a link to its post.
    const unread = unreadSection(page).getByRole('listitem').getByRole('link');
    await expect(unread).toHaveCount(3);
    await expect(unread.first()).toHaveAccessibleName(/\(belum dibaca\)$/);
    await expect(
      unreadSection(page).getByRole('link', { name: /^Semua/ }),
    ).toHaveAttribute('href', '/pengumuman');
    await expect(
      main(page).getByRole('heading', { name: 'Kelola' }),
    ).toHaveCount(0);
    await strictGates(page, testInfo, 'beranda-nadia');
  });

  test('the gold bar keeps its height under a long page: 60 px, the field 8 px from its top @phone-only', async ({
    page,
  }) => {
    // Regression: the top bar is a flex item of the scrolling column; with only a min-height it shrank to 58 px
    // under Beranda's long page, moving everything up 2 px from the locked screens.
    await page.goto('/');
    await expect.poll(() => attentionTitles(page)).toHaveLength(4);
    const bar = await page.locator('.g-top.gold').boundingBox();
    const field = await page
      .getByRole('button', { name: 'Cari di PIPS!' })
      .boundingBox();
    expect(bar!.height).toBe(60);
    expect(field!.y - bar!.y).toBe(8);
  });

  test('external tiles open over https in a new tab; a tile opens its service @phone-only', async ({
    page,
  }) => {
    await page.goto('/');
    const tiles = page.getByRole('region', { name: 'Layanan' });
    for (const [name, href] of [
      ['Beasiswa (situs luar)', 'https://s.hmif.dev/MadingBeasiswa'],
      ['Bayar Kas! (situs luar)', 'https://s.hmif.dev/BayarKasHMIF'],
    ]) {
      const link = tiles.getByRole('link', { name });
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
    await tiles.getByRole('link', { name: 'Lainnya' }).click();
    await expect(page).toHaveURL(/\/layanan$/);
    await page.goBack();
    await page
      .getByRole('region', { name: 'Layanan' })
      .getByRole('link', { name: 'NIM Finder' })
      .click();
    await expect(page).toHaveURL(/\/layanan\/nim$/);
    await expect(
      main(page).getByRole('heading', { name: 'NIM Finder' }),
    ).toBeVisible();
  });

  test('Pintasan: four shortcuts, Bayar Kas! over https in a new tab, Semua to Layanan @desktop-only', async ({
    page,
  }) => {
    await page.goto('/');
    const pins = section(page, 'Pintasan');
    await expect(pins.locator('.g-svc')).toHaveText([
      'Ding Dong',
      'Testi Matkul',
      'NIM Finder',
      'Bayar Kas! (situs luar)',
    ]);
    const kas = pins.getByRole('link', { name: 'Bayar Kas! (situs luar)' });
    await expect(kas).toHaveAttribute(
      'href',
      'https://s.hmif.dev/BayarKasHMIF',
    );
    await expect(kas).toHaveAttribute('target', '_blank');
    await pins.getByRole('link', { name: /^Semua/ }).click();
    await expect(page).toHaveURL(/\/layanan$/);
  });

  test('the strip: Sabtu 10 has Bakti Sosial HMIF, Minggu 11 nothing; focus stays; reload keeps the day', async ({
    page,
  }) => {
    await page.goto('/');
    const sabtu = stripDay(page, /^Sabtu, 10 Oktober/);
    await sabtu.click();
    await expect(sabtu).toHaveAttribute('aria-pressed', 'true');
    await expect(sabtu).toBeFocused();
    await expect(agendaRows(page)).toHaveText([
      'Bakti Sosial HMIF',
      'Acara Himpunan',
    ]);
    await expect(page).toHaveURL(/hari=2026-10-10/);
    const minggu = stripDay(page, 'Minggu, 11 Oktober, tidak ada acara');
    await minggu.focus();
    await page.keyboard.press('Enter');
    await expect(minggu).toBeFocused();
    await expect(agenda(page).getByText('Tidak ada acara.')).toBeVisible();
    await page.reload();
    await expect(
      stripDay(page, 'Minggu, 11 Oktober, tidak ada acara'),
    ).toHaveAttribute('aria-pressed', 'true');
    // Choosing a day replaces the entry: Back leaves Beranda, it doesn't step through days.
    expect(await page.evaluate(() => history.length)).toBe(2);
  });

  test('an event opens from the strip: a sheet on phones, a centred panel on tablets, Kalender on desktop', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    const row = agenda(page).getByRole('button', { name: /^15\.00.*Kuis 2/ });
    await row.click();
    if (layoutOf(testInfo) === 'desktop') {
      await expect(page).toHaveURL(/\/kalender\?.*acara=/);
      const side = page.getByRole('region', { name: 'Acara hari terpilih' });
      await expect(side.getByRole('heading', { name: 'Kuis 2' })).toBeVisible();
      await expect(
        side.getByRole('button', { name: /Kuis 2/ }),
      ).toHaveAttribute('aria-current', 'true');
      return;
    }
    const sheet = page.getByRole('dialog', { name: 'Detail acara' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Kuis 2' })).toBeVisible();
    await expect(sheet).toContainText('15.00–16.40 WIB');
    const box = (await sheet.boundingBox())!;
    const width = page.viewportSize()!.width;
    if (layoutOf(testInfo) === 'tablet') {
      // Centred, not at the bottom edge.
      expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
      expect(box.y + box.height).toBeLessThan(page.viewportSize()!.height - 20);
    } else {
      expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
    }
    await strictGates(page, testInfo, 'beranda-event');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(row).toBeFocused();
    await expect(page).not.toHaveURL(/acara=/);
    // Back closes it too.
    await row.click();
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet).toBeHidden();
    await expect(greeting(page)).toBeVisible();
  });

  test('a shared link with an event reopens it; an unknown id opens nothing and is dropped', async ({
    page,
  }, testInfo) => {
    await page.goto('/?acara=a3');
    if (layoutOf(testInfo) === 'desktop') {
      await expect(page).toHaveURL(/\/kalender\?.*acara=a3/);
      await expect(
        page
          .getByRole('region', { name: 'Acara hari terpilih' })
          .getByRole('heading', { name: 'Deadline Tugas Besar 1' }),
      ).toBeVisible();
    } else {
      await expect(
        page
          .getByRole('dialog', { name: 'Detail acara' })
          .getByRole('heading', { name: 'Deadline Tugas Besar 1' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Tutup' }).click();
      await expect(page).not.toHaveURL(/acara=/);
    }
    await page.goto('/?acara=nope');
    // On desktop the link goes to Kalender, which drops the unknown id there.
    if (layoutOf(testInfo) === 'desktop')
      await expect(page).toHaveURL(/\/kalender$/);
    else await expect(greeting(page)).toBeVisible();
    await expect(page).not.toHaveURL(/acara=/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('every follow-up’s button: Lihat, Buka, Isi and Nyalakan', async ({
    page,
  }, testInfo) => {
    const desk = layoutOf(testInfo) === 'desktop';
    await page.goto('/');
    await attentionRow(page, 'Deadline Tugas')
      .getByRole('button', { name: 'Lihat' })
      .click();
    if (desk) await expect(page).toHaveURL(/\/kalender\?.*acara=a3/);
    else {
      await expect(
        page
          .getByRole('dialog', { name: 'Detail acara' })
          .getByText('Paling lambat 23.59 WIB'),
      ).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await page.goto('/');
    await attentionRow(page, 'Welfare')
      .getByRole('link', { name: 'Buka' })
      .click();
    await expect(page).toHaveURL(/\/layanan\/curhat\/r1$/);
    await page.goto('/');
    await attentionRow(page, 'PIXEL')
      .getByRole('link', { name: 'Isi' })
      .click();
    await expect(page).toHaveURL(/\/layanan\/form\/pixel$/);
    await page.goto('/');
    await attentionRow(page, 'Notifikasi belum menyala')
      .getByRole('button', { name: 'Nyalakan' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Nyalakan notifikasi?' }),
    ).toBeVisible();
  });

  test('a row goes with its signal: no courses, notifications on, the form sent, several rooms, nothing to do', async ({
    page,
    db,
  }) => {
    // No courses this semester: the Atur row (gold), and only Himpunan events.
    db.myCourses = [];
    db.events = db.events.filter((e) => e.category === 'himpunan');
    await page.goto('/');
    await expect
      .poll(() => attentionTitles(page))
      .toEqual([
        'Balasan baru dari Welfare',
        'Form Analisis Kondisi PIXEL',
        'Atur mata kuliah semester ini',
        'Notifikasi belum menyala',
      ]);
    await expect(attentionRow(page, 'Atur mata kuliah')).toContainText(
      'Ding Dong dan acara Akademik masih kosong.',
    );
    await expect(agendaRows(page)).toHaveText([
      'Sharing Session: Magang di Startup',
      'Acara Himpunan',
    ]);
    await attentionRow(page, 'Atur mata kuliah')
      .getByRole('link', { name: 'Atur' })
      .click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);

    // The form sent and a second room with a reply: one Welfare row for both rooms.
    db.forms = db.forms.map((f) => ({ ...f, status: 'already_responded' }));
    const [r1] = Object.values(db.chatrooms);
    db.chatrooms.r9 = {
      ...r1,
      id: 'r9',
      title: 'Ruang Lain',
      messages: (r1.messages ?? []).map((m) => ({
        ...m,
        id: `${m.id}-r9`,
        chatroomId: 'r9',
      })),
    };
    await page.goto('/');
    await expect
      .poll(() => attentionTitles(page))
      .toEqual([
        'Balasan baru dari Welfare',
        'Atur mata kuliah semester ini',
        'Notifikasi belum menyala',
      ]);
    await expect(attentionRow(page, 'Welfare')).toContainText('Di 2 ruang');
    await attentionRow(page, 'Welfare')
      .getByRole('link', { name: 'Buka' })
      .click();
    await expect(page).toHaveURL(/\/layanan\/curhat$/);
  });

  test.describe('nothing to do', () => {
    test.use({ push: 'on' });
    test('no deadline, no reply, no form, courses set, notifications on: Tidak ada yang perlu diurus.', async ({
      page,
      db,
    }, testInfo) => {
      db.events = db.events.filter((e) => e.id !== 'a3');
      db.chatroomReads = Object.values(db.chatrooms).flatMap((r) =>
        (r.messages ?? []).map((m) => m.id),
      );
      db.forms = [];
      db.infos = db.infos.map((i) => ({ ...i, isRead: true }));
      await page.goto('/');
      await expect(
        main(page).getByText('Tidak ada yang perlu diurus.'),
      ).toBeVisible();
      await expect(main(page).getByText('Semua sudah dibaca.')).toBeVisible();
      await strictGates(page, testInfo, 'beranda-empty');
    });
  });

  test('the agenda card never waits for the follow-ups or the unread list, and needs at most 15 API requests', async ({
    page,
    api,
  }) => {
    for (const spec of [
      'GET /api/curhat/chatrooms',
      'GET /api/curhat/chatrooms/unread',
      'GET /api/form',
      'GET /api/info',
    ])
      api.on(spec, reply.hang());
    await page.goto('/');
    await expect(agendaRows(page).first()).toHaveText('Kuis 2');
    const before = api.requests.filter((r) =>
      r.path.startsWith('/api/'),
    ).length;
    expect(before).toBeLessThanOrEqual(15);
  });
});

test.describe('the month’s end', () => {
  test.use({ now: '2026-10-28T09:00:00+07:00' });
  test('at the month’s end both months are asked for, and November’s days show their events', async ({
    page,
    api,
    db,
  }) => {
    db.events.push(
      event('n1', 'Malam Keakraban', '2026-11-02T18:00', '2026-11-02T21:00'),
    );
    await page.goto('/');
    await expect(stripDay(page, /^Rabu, 28 Oktober, hari ini/)).toBeVisible();
    await stripDay(page, /^Senin, 2 November, 1 acara$/).click();
    await expect(agendaRows(page)).toHaveText([
      'Malam Keakraban',
      'Acara Himpunan',
    ]);
    const asked = api
      .calls('GET /api/calendar/me')
      .map((c) => new URLSearchParams(c.query).toString());
    expect(asked).toContain('month=10&year=2026');
    expect(asked).toContain('month=11&year=2026');
  });
});

test.describe('Raka, pengurus', () => {
  test.use({ persona: 'pengurus' });

  test('only his deadline; Kuis 1 ended; the Kelola card with 142', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(greeting(page, 'Raka')).toBeVisible();
    await expect(agendaRows(page)).toHaveText([
      'Kuis 1 (selesai)',
      'IF3170 Inteligensi Buatan',
      'Sharing Session: Magang di Startup',
      'Acara Himpunan',
    ]);
    await expect
      .poll(() => attentionTitles(page))
      .toEqual(['Deadline Tugas Besar 1 · IF3110']);
    // Nadia's Kuis 2 is for a course Raka doesn't take.
    expect(await mainText(page)).not.toContain('Kuis 2');
    const kelola = main(page).getByRole('link', { name: /Live Counting/ });
    await expect(kelola).toContainText('Form Analisis Kondisi PIXEL');
    await expect(kelola).toContainText('142');
    await expect(kelola).toContainText('sudah mengisi');
    await expect(kelola).toHaveAttribute('href', '/kelola/live/pixel');
    if (layoutOf(testInfo) === 'desktop')
      await expect(
        main(page).getByRole('heading', { name: 'Pintasan' }),
      ).toBeVisible();
    await strictGates(page, testInfo, 'beranda-raka');
    await kelola.click();
    await expect(page).toHaveURL(/\/kelola\/live\/pixel$/);
  });

  test('with no form open, the Kelola card is hidden', async ({ page, db }) => {
    db.adminForms = db.adminForms.map((f) => ({ ...f, isActive: false }));
    await page.goto('/');
    await expect(agendaRows(page).first()).toBeVisible();
    await expect(
      main(page).getByRole('heading', { name: 'Kelola' }),
    ).toHaveCount(0);
  });
});

test.describe('states', () => {
  test('loading: layout-shaped skeletons after 300 ms; nothing before', async ({
    page,
    api,
  }) => {
    api.on('GET /api/calendar/me', reply.hang());
    api.on('GET /api/info', reply.hang());
    api.on('GET /api/form', reply.hang());
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await expect(strip(page).getByRole('button')).toHaveCount(8);
    await expect(
      page.getByRole('status', { name: 'Memuat acara…' }),
    ).toBeVisible();
    await expect(
      page.getByRole('status', { name: 'Memuat yang perlu ditindaklanjuti…' }),
    ).toBeVisible();
    await expect(
      page.getByRole('status', { name: 'Memuat pengumuman…' }),
    ).toBeVisible();
  });

  test('each section fails alone, and Coba lagi retries it', async ({
    page,
    api,
  }) => {
    api.on('GET /api/calendar/me', reply.status(503));
    api.on('GET /api/info', reply.status(503));
    await page.goto('/');
    // Follow-ups still arrive.
    await expect
      .poll(() => attentionTitles(page))
      .toContain('Balasan baru dari Welfare');
    const failed = agenda(page).getByRole('alert');
    // The client retries a 5xx three times (1, 2 and 4 s) before it says so.
    await expect(failed).toContainText('Acara gagal dimuat.', {
      timeout: 15_000,
    });
    await expect(unreadSection(page).getByRole('alert')).toContainText(
      'Pengumuman gagal dimuat.',
    );
    api.on('GET /api/calendar/me', ({ db, query }) => {
      const month = Number(query.get('month'));
      return db.events.filter(
        (e) =>
          new Date(Date.parse(e.start) + 7 * 36e5).getUTCMonth() + 1 === month,
      );
    });
    await failed.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(agendaRows(page).first()).toHaveText('Kuis 2');
  });

  test('offline: what was kept stays, under the offline line', async ({
    page,
    api,
  }) => {
    await page.goto('/');
    await expect(agendaRows(page).first()).toHaveText('Kuis 2');
    await api.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(
      main(page)
        .getByRole('status')
        .filter({ hasText: /^Offline · diperbarui \d\d\.\d\d$/ }),
    ).toBeVisible();
    await expect(agendaRows(page).first()).toHaveText('Kuis 2');
  });
});

test.describe('motion', () => {
  test('the bars draw once per session, and never under reduced motion', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(agenda(page)).toHaveClass(/\bdraw\b/);
    const bar = agenda(page).locator('.g-mbars i').first();
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((el) => getComputedStyle(el).animationName)).toBe(
      'g-draw',
    );
    // Back on Beranda in the same session: no second draw.
    await navLink(page, 'Kalender').click();
    await navLink(page, 'Beranda').click();
    await expect(agenda(page)).not.toHaveClass(/\bdraw\b/);
    await page.reload();
    await expect(agenda(page)).not.toHaveClass(/\bdraw\b/);
  });

  test('under reduced motion nothing moves', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const bar = agenda(page).locator('.g-mbars i').first();
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((el) => getComputedStyle(el).animationName)).toBe(
      'none',
    );
  });
});

test.describe('gates', () => {
  test('Beranda fits at 320, 390, 768, 1024 and 1440 px and at 200% zoom', async ({
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
      await page.goto('/');
      await expect(agendaRows(page).first()).toBeVisible();
      await expectFits(page, `Beranda at ${width} px`);
    }
  });

  test('44 px targets on touch; the strip’s days at least 24 px wide and 72 px tall @phone-only', async ({
    page,
  }) => {
    await page.goto('/');
    await expect.poll(() => attentionTitles(page)).toHaveLength(4);
    const small = (await hitSizes(page, '#isi a, #isi button')).filter(
      (s) => !(s.w >= 44 && s.h >= 44),
    );
    const days = await hitSizes(page, '.g-ag-day');
    expect(days).toHaveLength(8);
    for (const d of days) {
      expect(d.w).toBeGreaterThanOrEqual(24);
      expect(d.h).toBeGreaterThanOrEqual(72);
    }
    expect(
      small.filter(
        (s) => !/^(Kamis|Jumat|Sabtu|Minggu|Senin|Selasa|Rabu),/.test(s.name),
      ),
    ).toEqual([]);
  });

  test('every Tab stop on Beranda shows its focus', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => attentionTitles(page)).toHaveLength(4);
    await page.locator('#isi').focus();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const inPage = await page.evaluate(
        () => !!document.activeElement?.closest('#isi'),
      );
      if (!inPage) break;
      expect(await focusIsVisible(page), `Tab stop ${i + 1}`).toBe(true);
    }
  });
});
