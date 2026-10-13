/**
 * Kelola (P3-A): the hub, choosing a form, Live Counting with its socket, Rekap Form, the CSV exports and Data SPARTA
 * Magang with one submission. Persona Raka (akademik, admin) unless noted; Nadia (no roles) and a peoplemanage-only
 * member through the harness's `roles` option. Every journey runs at phone, tablet and desktop size, light and dark;
 * each screen passes the strict gates. Every assertion of the journey this replaces is kept or made stronger.
 */
import fs from 'node:fs';
import type { Download, Page, TestInfo } from '@playwright/test';
import type {
  AdminFormListItem,
  AdminFormResponseItem,
} from '../../src/api/generated';
import type { Db } from '../fixtures/api';
import { layoutOf, navLink } from '../support/app';
import { defaultHandlers } from '../support/handlers';
import type { ApiMock } from '../support/mock';
import { reply } from '../support/mock';
import { strictGates } from '../support/strict';
import { expect, test } from '../support/test';

test.use({ persona: 'pengurus' });

const main = (page: Page) => page.getByRole('main');
const touch = (testInfo: TestInfo) => layoutOf(testInfo) !== 'desktop';
const lit = (testInfo: TestInfo) => (touch(testInfo) ? 'Layanan' : 'Kelola');
const plaque = (page: Page) => main(page).locator('.g-live-plaque');
const square = (page: Page) => plaque(page).locator('[data-live]');
const rows = (page: Page) => main(page).locator('li.g-resp');
/** The page's own list of links (desktop breadcrumbs are links in main too). */
const listLinks = (page: Page) =>
  main(page).getByRole('list').getByRole('link');
const ADMIN_CALLS = [
  'GET /api/form/admin/list',
  'GET /api/form/:formId/responses',
  'GET /api/form/:formId/responses/count',
  'GET /api/form/:formId/analytics',
  'GET /api/internship/submissions',
  'GET /api/internship/submissions/:id',
];
const adminCalls = (api: ApiMock) =>
  ADMIN_CALLS.flatMap((spec) => api.calls(spec));

test("Beranda's Kelola section leads to the hub", async ({ page }) => {
  // Beranda's Kelola section (P1-A; today's Home had an Admin tile) leads to the hub.
  await page.goto('/');
  await main(page)
    .getByRole('heading', { name: 'Kelola', exact: true })
    .locator('xpath=../..')
    .getByRole('link', { name: /^Semua/ })
    .click();
  await expect(page).toHaveURL(/\/kelola$/);
  await expect(
    listLinks(page).filter({ hasText: 'Live Counting & Rekap Form' }),
  ).toBeVisible();
  await expect(
    listLinks(page).filter({ hasText: 'Data SPARTA Magang' }),
  ).toBeVisible();
});

/** The live page's socket is in the form's admin room. */
async function socketReady(api: ApiMock, formId = 'pixel') {
  await expect
    .poll(
      () =>
        [...api.socket.sessions.values()].some(
          (s) => s.connected && s.rooms.has(`form-admin:${formId}`),
        ),
      // socket.io reconnects with up to 5 s of backoff (plus jitter) after a drop.
      { timeout: 20_000 },
    )
    .toBe(true);
}

/** As the API: the response is saved, then the admin room hears of it. */
function newResponse(
  api: ApiMock,
  db: Db,
  r: Partial<AdminFormResponseItem> & { nim: string; fullName: string },
) {
  const item: AdminFormResponseItem = {
    id: `resp-${r.nim}`,
    userId: `user-${r.nim}`,
    major: 'IF',
    angkatan: 2025,
    answers: [],
    submittedAt: '2026-10-08T06:32:00.000Z',
    ...r,
  };
  db.adminResponses.pixel.unshift(item);
  return api.socket.emit(
    'form:new-response',
    {
      total: db.adminResponses.pixel.length,
      nim: item.nim,
      fullName: item.fullName,
      submittedAt: item.submittedAt,
    },
    (s) => s.rooms.has('form-admin:pixel'),
  );
}

async function readDownload(download: Download) {
  return fs.readFileSync((await download.path())!, 'utf8');
}

// ---------------------------------------------------------------- The hub

test.describe('Kelola hub', () => {
  test("Raka's three rows, in order, each reaching its place", async ({
    page,
  }, testInfo) => {
    await page.goto('/kelola');
    const links = listLinks(page);
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toHaveAccessibleName(
      /^Live Counting & Rekap Form Pengisi form secara realtime, rekap, dan analitik/,
    );
    await expect(links.nth(1)).toHaveAccessibleName(
      /^Data SPARTA Magang Pilihan divisi magang angkatan 2025 · ditutup 23 Agu 2026/,
    );
    await expect(links.nth(2)).toHaveAccessibleName(
      /^Tambah acara Akademik Kuis, UTS, dan tenggat per mata kuliah/,
    );
    await strictGates(page, testInfo, 'kelola', lit(testInfo));

    await links.nth(0).click();
    await expect(page).toHaveURL(/\/kelola\/live\/pixel$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/kelola$/);
    await main(page)
      .getByRole('link', { name: /^Data SPARTA Magang/ })
      .click();
    await expect(page).toHaveURL(/\/kelola\/sparta$/);
    await page.goBack();
    await main(page)
      .getByRole('link', { name: /^Tambah acara Akademik/ })
      .click();
    await expect(page).toHaveURL(/\/kalender/);
  });

  test('desktop: Kelola in the sidebar; touch: last in Layanan', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan');
    if (touch(testInfo)) {
      await expect(
        main(page).getByRole('heading', { name: 'Kelola' }),
      ).toBeVisible();
      await main(page)
        .getByRole('link', { name: /^Live Counting & Rekap Form/ })
        .click();
    } else {
      await page
        .getByRole('navigation', { name: 'Navigasi utama' })
        .getByRole('link', { name: /^Kelola/ })
        .click();
      await expect(page).toHaveURL(/\/kelola$/);
      await main(page)
        .getByRole('link', { name: /^Live Counting & Rekap Form/ })
        .click();
    }
    await expect(page).toHaveURL(/\/kelola\/live\/pixel$/);
    await expect(plaque(page)).toContainText('142');
  });

  test.describe('a peoplemanage-only member', () => {
    test.use({ roles: { only: ['peoplemanage'] } });

    test('sees Data SPARTA Magang only, and is sent from Live Counting to Kelola', async ({
      page,
      api,
    }) => {
      await page.goto('/kelola');
      await expect(listLinks(page)).toHaveCount(1);
      await expect(listLinks(page)).toHaveAccessibleName(/^Data SPARTA Magang/);
      await page.goto('/kelola/live/pixel');
      await expect(page).toHaveURL(/\/kelola$/);
      await expect(listLinks(page)).toHaveCount(1);
      expect(api.calls('GET /api/form/:formId/responses/count')).toEqual([]);
      expect(api.calls('GET /api/form/:formId/analytics')).toEqual([]);
      await page.goto('/kelola/sparta');
      await expect(main(page).getByText('3 pendaftar')).toBeVisible();
    });
  });

  test.describe('Nadia, anggota', () => {
    test.use({ persona: 'anggota' });

    test('no Kelola anywhere, and every Kelola page sends her to Layanan without an admin request', async ({
      page,
      api,
    }, testInfo) => {
      await page.goto('/layanan');
      await expect(
        main(page).getByRole('heading', { name: 'Kuliah' }),
      ).toBeVisible();
      await expect(
        main(page).getByRole('heading', { name: 'Kelola' }),
      ).toHaveCount(0);
      if (!touch(testInfo))
        await expect(
          page
            .getByRole('navigation', { name: 'Navigasi utama' })
            .getByRole('link', { name: /^Kelola/ }),
        ).toHaveCount(0);
      for (const path of [
        '/kelola',
        '/kelola/live',
        '/kelola/live/pixel',
        '/kelola/live/pixel/rekap',
        '/kelola/sparta',
        '/kelola/sparta/sub-13525071',
      ]) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/layanan$/);
        await expect(navLink(page, 'Layanan')).toBeVisible();
      }
      // The old Admin tile is gone too.
      await page.goto('/');
      await expect(page.getByText('Admin', { exact: true })).toHaveCount(0);
      expect(adminCalls(api)).toEqual([]);
    });
  });

  test('back from a deep-linked live page lands on Kelola, then Layanan; no loop', async ({
    page,
  }, testInfo) => {
    await page.goto('/kelola/live/pixel');
    await expect(plaque(page)).toContainText('142');
    if (touch(testInfo)) {
      await page.getByRole('button', { name: 'Kembali ke Kelola' }).click();
      await expect(page).toHaveURL(/\/kelola$/);
      await page.getByRole('button', { name: 'Kembali ke Layanan' }).click();
      await expect(page).toHaveURL(/\/layanan$/);
    } else {
      const crumbs = page.getByRole('navigation', { name: 'Jejak halaman' });
      await expect(crumbs).toHaveText(/Kelola\s*Live Counting/);
      await crumbs.getByRole('link', { name: 'Kelola' }).click();
      await expect(page).toHaveURL(/\/kelola$/);
    }
  });
});

// ---------------------------------------------------------------- Choosing a form

const secondForm = (db: Db): AdminFormListItem => ({
  ...db.adminForms[0],
  id: 'kesan',
  slug: 'kesan',
  title: 'Form Kesan Welcoming Party',
  opensAt: '2026-10-01T06:00:00.000Z',
  closesAt: '2026-10-07T16:59:00.000Z',
  order: 1,
});

test.describe('Choosing a form', () => {
  test('one active form goes straight to its live page; back leaves', async ({
    page,
  }) => {
    await page.goto('/kelola');
    await main(page)
      .getByRole('link', { name: /^Live Counting & Rekap Form/ })
      .click();
    await expect(page).toHaveURL(/\/kelola\/live\/pixel$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/kelola$/);
  });

  test('two forms list both in order, each with its time', async ({
    page,
    db,
  }, testInfo) => {
    db.adminForms.push(secondForm(db));
    db.formDetails.kesan = {
      ...db.formDetails.pixel,
      ...secondForm(db),
    };
    db.adminResponses.kesan = [];
    db.formAnalytics.kesan = { totalResponses: 0, questions: [] };
    await page.goto('/kelola/live');
    const links = listLinks(page);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAccessibleName(
      /^Form Analisis Kondisi PIXEL Dibuka /,
    );
    await expect(links.nth(1)).toHaveAccessibleName(
      'Form Kesan Welcoming Party Ditutup Rab 7 Okt, 23.59',
    );
    await strictGates(page, testInfo, 'kelola-forms', lit(testInfo));
    await links.nth(1).click();
    await expect(page).toHaveURL(/\/kelola\/live\/kesan$/);
    await expect(plaque(page)).toContainText('Form Kesan Welcoming Party');
    await expect(plaque(page)).toContainText('orang sudah mengisi');
    await expect(
      main(page).getByText('Belum ada yang mengisi form ini.'),
    ).toBeVisible();
  });

  test('no active form says so', async ({ page, db }) => {
    db.adminForms = [];
    await page.goto('/kelola/live');
    await expect(main(page).getByText('Belum ada form')).toBeVisible();
  });
});

// ---------------------------------------------------------------- Live Counting

test.describe('Live Counting', () => {
  test('the plaque, the newest five and both charts', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/kelola/live/pixel');
    await expect(plaque(page)).toContainText('Form Analisis Kondisi PIXEL');
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('142');
    await expect(plaque(page)).toContainText(
      'orang sudah mengisi · terakhir 13.31 WIB',
    );
    await expect(rows(page)).toHaveCount(5);
    await expect(rows(page).first()).toHaveText(
      /13525103\s*Farah Nabila\s*IF\s*13\.31/,
    );
    await expect(rows(page).nth(1)).toHaveText(
      /18225077\s*Yoga Prakoso\s*STI\s*13\.22/,
    );
    // Only the newest five are asked for.
    expect(
      api.calls('GET /api/form/:formId/responses').map((c) => c.query),
    ).toEqual(['?page=1&limit=5']);
    const charts = main(page).locator('.g-hbars');
    await expect(charts).toHaveCount(2);
    await expect(main(page).getByText('Jurusan IF/STI deh?')).toBeVisible();
    await expect(charts.nth(0).locator('.g-hbar')).toHaveText([
      /IF\s*96/,
      /STI\s*46/,
    ]);
    await expect(charts.nth(1).locator('.g-hbar')).toHaveText([
      /Tertarik\s*81/,
      /Belum bisa memastikan\s*49/,
      /Tidak tertarik\s*12/,
    ]);
    // The bar is count / max of its question.
    const sti = await charts
      .nth(0)
      .locator('.g-hbar')
      .nth(1)
      .locator('.trk i')
      .evaluate((el) => el.style.width);
    expect(parseFloat(sti)).toBeCloseTo((46 / 96) * 100, 3);
    await expect(
      main(page).getByRole('link', { name: 'Semua' }),
    ).toHaveAttribute('href', '/kelola/live/pixel/rekap');
    await expect(
      main(page).getByRole('button', { name: 'Export CSV' }),
    ).toBeVisible();
    await expect(page.getByText('Simulasi pengisi baru')).toHaveCount(0);
    await expect(page.getByText(/Contoh/)).toHaveCount(0);
    // The browser tab names the whole service (brief, Build 3; review P3-A m8); the top bar keeps "Live Counting".
    await expect(page).toHaveTitle('Live Counting & Rekap Form · PIPS!');
    // The count is in a polite live region; the square is still under reduced motion.
    await expect(plaque(page).locator('[aria-live="polite"]')).toContainText(
      '142',
    );
    await socketReady(api);
    await expect(square(page)).toBeVisible();
    expect(
      await square(page).evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
    await strictGates(page, testInfo, 'live', lit(testInfo));
  });

  test('a live event: 143 at once, then the new row with its major and the time', async ({
    page,
    api,
    db,
  }) => {
    await page.goto('/kelola/live/pixel');
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('142');
    await socketReady(api);
    // The refetch is held, so the event's own total is what shows first.
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    api.on('GET /api/form/:formId/responses', async (req) => {
      await held;
      return defaultHandlers['GET /api/form/:formId/responses'](req);
    });
    expect(
      newResponse(api, db, {
        nim: '13525243',
        fullName: 'Pengisi Baru',
        major: 'STI',
      }),
    ).toBe(1);
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('143');
    await expect(plaque(page)).toContainText('terakhir 13.32 WIB');
    await expect(rows(page).first()).toContainText('Farah Nabila');
    release();
    await expect(rows(page).first()).toHaveText(
      /13525243\s*Pengisi Baru\s*STI\s*13\.32/,
    );
    await expect(rows(page)).toHaveCount(5);
  });

  // Regression (the race): a count request that answers after an event must not lower the number.
  test('a slow count answer arriving after an event never lowers the number', async ({
    page,
    api,
    db,
  }) => {
    await page.goto('/kelola/live/pixel');
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('142');
    await socketReady(api);
    // The server counted before the new response was saved: a stale 142, answered late.
    api.on(
      'GET /api/form/:formId/responses/count',
      reply.delay(800, { total: 142 }),
    );
    const before = api.calls('GET /api/form/:formId/responses/count').length;
    newResponse(api, db, { nim: '13525243', fullName: 'Pengisi Baru' });
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('143');
    await expect
      .poll(() => api.calls('GET /api/form/:formId/responses/count').length)
      .toBeGreaterThan(before);
    await page.waitForTimeout(1200);
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('143');
  });

  test('a dropped socket: the square stops, and the count and rows catch up on reconnect', async ({
    page,
    api,
    db,
  }) => {
    await page.goto('/kelola/live/pixel');
    await socketReady(api);
    await expect(square(page)).toBeVisible();
    api.socket.drop();
    await expect(square(page)).toHaveCount(0);
    // A response arrives while the page can't hear it.
    db.adminResponses.pixel.unshift({
      ...db.adminResponses.pixel[0],
      id: 'resp-missed',
      nim: '13525250',
      fullName: 'Terlewat Sebentar',
      submittedAt: '2026-10-08T06:33:00.000Z',
    });
    const counts = api.calls('GET /api/form/:formId/responses/count').length;
    api.socket.restore();
    await socketReady(api);
    await expect(square(page)).toBeVisible();
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('143');
    await expect(rows(page).first()).toContainText('Terlewat Sebentar');
    expect(
      api.calls('GET /api/form/:formId/responses/count').length,
    ).toBeGreaterThan(counts);
  });

  test('zero responses', async ({ page, db }, testInfo) => {
    db.adminResponses.pixel = [];
    db.formAnalytics.pixel = {
      totalResponses: 0,
      questions: db.formAnalytics.pixel.questions.map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o, count: 0 })),
      })),
    };
    await page.goto('/kelola/live/pixel');
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('0');
    await expect(plaque(page).locator('p.sub')).toHaveText(
      'orang sudah mengisi',
    );
    await expect(
      main(page).getByText('Belum ada yang mengisi form ini.'),
    ).toBeVisible();
    // Empty tracks, no NaN.
    const widths = await main(page)
      .locator('.g-hbar .trk i')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).style.width));
    expect(widths.every((w) => w === '0%')).toBe(true);
    await strictGates(page, testInfo, 'live-empty', lit(testInfo));
  });

  test('no choice questions: no Analitik jawaban', async ({ page, db }) => {
    db.formAnalytics.pixel = { totalResponses: 142, questions: [] };
    await page.goto('/kelola/live/pixel');
    await expect(rows(page)).toHaveCount(5);
    await expect(
      main(page).getByRole('heading', { name: 'Analitik jawaban' }),
    ).toHaveCount(0);
  });

  test('a rating question shows 1 to 5 in order, with zeros', async ({
    page,
    db,
  }) => {
    db.formAnalytics.pixel.questions.push({
      questionId: 'q21',
      label:
        'Secara keseluruhan, gimana penilaian kamu soal Welcoming Party 2025?',
      type: 'rating' as never,
      options: [
        { value: '4', count: 60 },
        { value: '5', count: 50 },
        { value: '2', count: 7 },
      ],
    });
    await page.goto('/kelola/live/pixel');
    const charts = main(page).locator('.g-hbars');
    await expect(charts).toHaveCount(3);
    await expect(charts.nth(2).locator('.g-hbar')).toHaveText([
      /^1\s*0$/,
      /^2\s*7$/,
      /^3\s*0$/,
      /^4\s*60$/,
      /^5\s*50$/,
    ]);
  });

  test('the newest response from another day', async ({ page, db }) => {
    for (const r of db.adminResponses.pixel)
      r.submittedAt = new Date(
        Date.parse(r.submittedAt) - 24 * 3600_000,
      ).toISOString();
    await page.goto('/kelola/live/pixel');
    await expect(plaque(page)).toContainText(
      'orang sudah mengisi · terakhir Rab 7 Okt, 13.31 WIB',
    );
    await expect(rows(page).first()).toHaveText(
      /13525103\s*Farah Nabila\s*IF\s*Rab 7 Okt/,
    );
  });

  for (const [what, spec, title] of [
    [
      'count',
      'GET /api/form/:formId/responses/count',
      'Jumlah pengisi gagal dimuat.',
    ],
    [
      'rows',
      'GET /api/form/:formId/responses',
      'Pengisi terbaru gagal dimuat.',
    ],
    [
      'charts',
      'GET /api/form/:formId/analytics',
      'Analitik jawaban gagal dimuat.',
    ],
  ] as const) {
    test(`503 on the ${what}: that block alone fails, with its own Coba lagi`, async ({
      page,
      api,
    }, testInfo) => {
      api.on(spec, reply.status(503));
      await page.goto('/kelola/live/pixel');
      const failed = main(page).getByRole('alert').filter({ hasText: title });
      await expect(failed).toBeVisible();
      await expect(main(page).getByRole('alert')).toHaveCount(1);
      if (what !== 'count')
        await expect(plaque(page).locator('.t-figure-xl')).toHaveText('142');
      if (what !== 'rows') await expect(rows(page)).toHaveCount(5);
      if (what !== 'charts')
        await expect(main(page).locator('.g-hbars')).toHaveCount(2);
      if (what === 'count')
        await strictGates(page, testInfo, 'live-failed', lit(testInfo));
      api.on(spec, defaultHandlers[spec]);
      await failed.getByRole('button', { name: 'Coba lagi' }).click();
      await expect(main(page).getByRole('alert')).toHaveCount(0);
      await expect(plaque(page).locator('.t-figure-xl')).toHaveText('142');
      await expect(rows(page)).toHaveCount(5);
      await expect(main(page).locator('.g-hbars')).toHaveCount(2);
    });
  }

  test('offline: the banner with the last update, over what is on screen', async ({
    page,
    api,
  }) => {
    await page.goto('/kelola/live/pixel');
    await expect(rows(page)).toHaveCount(5);
    await api.setOffline(true);
    await expect(main(page).locator('.g-offline')).toBeVisible();
    await expect(main(page).locator('.g-offline')).toContainText('13.35');
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('142');
    await expect(rows(page)).toHaveCount(5);
    await expect(square(page)).toHaveCount(0);
    await api.setOffline(false);
  });

  test('a role taken away: no sign-out, the session is checked again, off to Layanan', async ({
    page,
    api,
    db,
  }) => {
    await page.goto('/kelola/live/pixel');
    await expect(rows(page)).toHaveCount(5);
    await socketReady(api);
    const checks = api.calls('GET /api/me').length;
    // An admin takes the role away; the next admin request answers 401.
    db.me!.roles = db.me!.roles.filter((r) => r !== 'admin');
    newResponse(api, db, { nim: '13525243', fullName: 'Pengisi Baru' });
    await expect(page).toHaveURL(/\/kelola$/);
    expect(api.calls('GET /api/me').length).toBeGreaterThan(checks);
    expect(
      api
        .calls('GET /api/form/:formId/responses/count')
        .some((c) => c.status === 401),
    ).toBe(true);
    await expect(page).not.toHaveURL(/\/login/);
    // Still signed in, with the tools left (Tambah acara Akademik).
    await expect(listLinks(page)).toHaveCount(1);
  });

  test.describe('Raka with admin only', () => {
    test.use({ roles: { only: ['admin'] } });

    test('losing admin, the last Kelola role: off to Layanan', async ({
      page,
      api,
      db,
    }) => {
      await page.goto('/kelola/live/pixel');
      await expect(rows(page)).toHaveCount(5);
      await socketReady(api);
      db.me!.roles = [];
      newResponse(api, db, { nim: '13525243', fullName: 'Pengisi Baru' });
      await expect(page).toHaveURL(/\/layanan$/);
      await expect(page).not.toHaveURL(/\/login/);
    });
  });

  test('an unknown form', async ({ page }, testInfo) => {
    await page.goto('/kelola/live/tidak-ada');
    await expect(main(page).getByText('Form tidak ditemukan')).toBeVisible();
    await strictGates(page, testInfo, 'live-not-found', lit(testInfo));
    await main(page).getByRole('link', { name: 'Ke Kelola' }).click();
    await expect(page).toHaveURL(/\/kelola$/);
  });
});

// ---------------------------------------------------------------- Export

test.describe('Export CSV', () => {
  test("every response, today's file, WIB times; Mengekspor… and one request set for a double press", async ({
    page,
    api,
  }) => {
    await page.goto('/kelola/live/pixel');
    await expect(rows(page)).toHaveCount(5);
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));
    api.on('GET /api/form/:formId/responses', async (req) => {
      if (req.query.get('limit') === '100') await held;
      return defaultHandlers['GET /api/form/:formId/responses'](req);
    });
    const button = main(page).getByRole('button', {
      name: /Export CSV|Mengekspor…/,
    });
    const download = page.waitForEvent('download');
    await button.click();
    await expect(button).toHaveText('Mengekspor…');
    await button.click({ force: true });
    release();
    const file = await download;
    // The stamp is WIB; the fixed clock keeps running from 13.35.
    expect(file.suggestedFilename()).toMatch(
      /^form-analisis-kondisi-pixel-responses-2026-10-08-133\d{3}\.csv$/,
    );
    const text = await readDownload(file);
    expect(text.startsWith('﻿No,NIM,Nama,Jurusan,Angkatan,')).toBe(true);
    const lines = text.slice(1).split('\n');
    expect(lines[0].endsWith(',Waktu Submit')).toBe(true);
    expect(lines).toHaveLength(143);
    expect(lines[1]).toMatch(
      /^1,13525103,Farah Nabila,IF,2025,.*,08-10-2026 13:31$/,
    );
    const big = api
      .calls('GET /api/form/:formId/responses')
      .filter((c) => c.query.includes('limit=100'));
    expect(big.map((c) => c.query)).toEqual([
      '?page=1&limit=100',
      '?page=2&limit=100',
    ]);
    await expect(
      page.getByText('Rekap 142 jawaban diunduh sebagai CSV.'),
    ).toBeVisible();
    await expect(button).toHaveText('Export CSV');
  });

  test('a failed page: an error toast that stays, and Coba lagi succeeds', async ({
    page,
    api,
  }) => {
    await page.goto('/kelola/live/pixel');
    await expect(rows(page)).toHaveCount(5);
    api.on('GET /api/form/:formId/responses', (req) =>
      req.query.get('page') === '2'
        ? reply.status(503)
        : defaultHandlers['GET /api/form/:formId/responses'](req),
    );
    await main(page).getByRole('button', { name: 'Export CSV' }).click();
    const toast = page
      .locator('.g-toasts [aria-live="assertive"] > *')
      .filter({ hasText: 'CSV gagal diunduh.' });
    await expect(toast).toBeVisible();
    await page.waitForTimeout(6000);
    await expect(toast).toBeVisible();
    api.on(
      'GET /api/form/:formId/responses',
      defaultHandlers['GET /api/form/:formId/responses'],
    );
    const download = page.waitForEvent('download');
    await toast.getByRole('button', { name: 'Coba lagi' }).click();
    const text = await readDownload(await download);
    expect(text.slice(1).split('\n')).toHaveLength(143);
    await expect(toast).toHaveCount(0);
  });
});

// ---------------------------------------------------------------- Rekap Form

test.describe('Rekap Form', () => {
  test('search, pages, the URL, and Export of the matches', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/kelola/live/pixel');
    await main(page).getByRole('link', { name: 'Semua' }).click();
    await expect(page).toHaveURL(/\/kelola\/live\/pixel\/rekap$/);
    await expect(main(page).getByText('142 hasil.')).toBeVisible();
    await expect(rows(page)).toHaveCount(20);
    await expect(rows(page).first()).toHaveText(
      /13525103\s*Farah Nabila\s*IF\s*2025\s*13\.31/,
    );
    await expect(main(page).getByText('1 / 8')).toBeVisible();
    await expect(
      main(page).getByRole('heading', { name: 'Form Analisis Kondisi PIXEL' }),
    ).toBeVisible();
    await strictGates(page, testInfo, 'rekap', lit(testInfo));

    // Page 2, then back.
    await main(page)
      .getByRole('button', { name: 'Halaman berikutnya' })
      .click();
    await expect(page).toHaveURL(/halaman=2/);
    await expect(main(page).getByText('2 / 8')).toBeVisible();
    await page.reload();
    await expect(main(page).getByText('2 / 8')).toBeVisible();
    await main(page)
      .getByRole('button', { name: 'Halaman sebelumnya' })
      .click();
    await expect(main(page).getByText('1 / 8')).toBeVisible();

    // One request after typing stops; only that answer shows.
    const searches = () =>
      api
        .calls('GET /api/form/:formId/responses')
        .filter((c) => c.query.includes('search='));
    await main(page)
      .getByRole('searchbox', { name: 'Cari nama atau NIM' })
      .pressSequentially('farah', { delay: 40 });
    await expect(main(page).getByText('1 hasil.')).toBeVisible();
    expect(
      searches().map((c) => Object.fromEntries(new URLSearchParams(c.query))),
    ).toEqual([{ page: '1', limit: '20', search: 'farah' }]);
    await expect(rows(page)).toHaveCount(1);
    await expect(page).toHaveURL(/q=farah/);
    await page.reload();
    await expect(main(page).getByText('1 hasil.')).toBeVisible();
    await expect(
      main(page).getByRole('searchbox', { name: 'Cari nama atau NIM' }),
    ).toHaveValue('farah');

    const download = page.waitForEvent('download');
    await main(page).getByRole('button', { name: 'Export CSV' }).click();
    const text = await readDownload(await download);
    const lines = text.slice(1).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^1,13525103,Farah Nabila,/);
    await expect(
      page.getByText('Rekap 1 jawaban diunduh sebagai CSV.'),
    ).toBeVisible();
  });

  test('no match', async ({ page }, testInfo) => {
    await page.goto('/kelola/live/pixel/rekap?q=zzz');
    await expect(main(page).getByText('0 hasil.')).toBeVisible();
    await expect(
      main(page).getByText('Tidak ada respon yang cocok.'),
    ).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Export CSV' }),
    ).toBeDisabled();
    await strictGates(page, testInfo, 'rekap-empty', lit(testInfo));
  });

  test('a page past the last goes to the last page (review P3-A m7)', async ({
    page,
  }) => {
    await page.goto('/kelola/live/pixel/rekap?halaman=99');
    await expect(page).toHaveURL(/halaman=8$/);
    await expect(main(page).getByText('8 / 8')).toBeVisible();
    await expect(main(page).getByText('142 hasil.')).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await expect(main(page).getByText('99 / 8')).toHaveCount(0);
    await expect(
      main(page).getByText('Tidak ada respon yang cocok.'),
    ).toHaveCount(0);
    // A search with one page: page 1, and its match shows.
    await page.goto('/kelola/live/pixel/rekap?q=farah&halaman=3');
    await expect(page).toHaveURL(/\/rekap\?q=farah$/);
    await expect(main(page).getByText('1 hasil.')).toBeVisible();
    await expect(rows(page)).toHaveCount(1);
    await expect(
      main(page).getByText('Tidak ada respon yang cocok.'),
    ).toHaveCount(0);
  });

  test('back from Rekap Form goes to the live page', async ({
    page,
  }, testInfo) => {
    await page.goto('/kelola/live/pixel/rekap');
    await expect(rows(page)).toHaveCount(20);
    if (touch(testInfo))
      await page
        .getByRole('button', { name: 'Kembali ke Live Counting' })
        .click();
    else
      await page
        .getByRole('navigation', { name: 'Jejak halaman' })
        .getByRole('link', { name: 'Live Counting' })
        .click();
    await expect(page).toHaveURL(/\/kelola\/live\/pixel$/);
  });
});

// ---------------------------------------------------------------- Data SPARTA Magang

const table = (page: Page) => main(page).locator('table.g-sparta-table');
const spartaRows = (page: Page) => main(page).locator('.g-sparta-rows > li');
/** The names shown, whichever layout shows them. */
async function namesShown(page: Page, testInfo: TestInfo) {
  return touch(testInfo)
    ? spartaRows(page).locator('.top > :first-child').allTextContents()
    : table(page).locator('tbody tr td:first-child').allTextContents();
}

test.describe('Data SPARTA Magang', () => {
  test('the table or labelled rows, every filter, search, the count and the URL', async ({
    page,
  }, testInfo) => {
    await page.goto('/kelola/sparta');
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
    // One tree (SPEC "responsive single trees"; review P3-A m2): the other layout's isn't in the page at all.
    if (touch(testInfo)) {
      await expect(table(page)).toHaveCount(0);
      await expect(spartaRows(page)).toHaveCount(3);
      await expect(spartaRows(page).first()).toContainText('Bima Santoso');
      await expect(spartaRows(page).first()).toContainText('Terkunci');
      await expect(spartaRows(page).first()).toContainText('NIM13525071');
    } else {
      await expect(table(page)).toBeVisible();
      await expect(spartaRows(page)).toHaveCount(0);
      await expect(table(page).locator('thead th')).toHaveText([
        'Nama',
        'NIM',
        'Jurusan',
        'Kelas',
        'Status',
        'Pilihan 1',
        'Pilihan 2',
        'Pilihan 3',
        'Pilihan 4',
      ]);
      await expect(table(page).locator('tbody tr').first()).toHaveText(
        /Bima Santoso\s*13525071\s*IF\s*IF K2\s*Terkunci\s*Akademik\s*Welfare\s*Competition and Community\s*Career Development/,
      );
    }
    // Nadia's partial draft: Draf, and "–" for the missing fourth priority.
    const nadiaText = touch(testInfo)
      ? spartaRows(page).nth(2)
      : table(page).locator('tbody tr').nth(2);
    await expect(nadiaText).toContainText('Nadia Putri');
    await expect(nadiaText).toContainText('Draf');
    await expect(nadiaText).toContainText('–');
    await strictGates(page, testInfo, 'sparta-table', lit(testInfo));

    // Status.
    await main(page).getByRole('radio', { name: 'Draf' }).check();
    await expect(main(page).getByText('1 pendaftar')).toBeVisible();
    expect(await namesShown(page, testInfo)).toEqual(['Nadia Putri']);
    await main(page).getByRole('radio', { name: 'Semua', exact: true }).check();
    // Division alone: any choice of it.
    await main(page)
      .getByLabel('Divisi', { exact: true })
      .selectOption({ label: 'Career Development · Career Development' });
    expect(await namesShown(page, testInfo)).toEqual([
      'Bima Santoso',
      'Tasya Amelia',
    ]);
    // Priority and division: that division at that priority.
    await main(page)
      .getByLabel('Pilihan', { exact: true })
      .selectOption({ label: 'Pilihan 3' });
    await expect(
      main(page).getByText('Tidak ada pendaftar yang cocok'),
    ).toBeVisible();
    await main(page)
      .getByLabel('Pilihan', { exact: true })
      .selectOption({ label: 'Pilihan 4' });
    await expect(main(page).getByText('2 pendaftar')).toBeVisible();
    await expect(page).toHaveURL(/divisi=div-cardev/);
    await expect(page).toHaveURL(/pilihan=4/);
    // Kept through a reload.
    await page.reload();
    await expect(main(page).getByText('2 pendaftar')).toBeVisible();
    await expect(main(page).getByLabel('Pilihan', { exact: true })).toHaveValue(
      '4',
    );
    // Priority alone.
    await main(page)
      .getByLabel('Divisi', { exact: true })
      .selectOption({ label: 'Semua divisi' });
    await expect(main(page).getByText('2 pendaftar')).toBeVisible();
    await main(page)
      .getByLabel('Pilihan', { exact: true })
      .selectOption({ label: 'Semua pilihan' });
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
    // Search by name and by NIM, any case.
    const search = main(page).getByRole('searchbox', {
      name: 'Cari nama atau NIM',
    });
    await search.fill('TASYA');
    expect(await namesShown(page, testInfo)).toEqual(['Tasya Amelia']);
    await search.fill('13525071');
    expect(await namesShown(page, testInfo)).toEqual(['Bima Santoso']);
    // The router writes a string of digits quoted (q=%2213525071%22), so it reads back as text.
    await expect(page).toHaveURL(/q=(%22)?13525071/);
    // Back from a submission keeps the filters.
    await (
      touch(testInfo)
        ? spartaRows(page).first().getByRole('link')
        : table(page).getByRole('link', { name: 'Bima Santoso' })
    ).click();
    await expect(page).toHaveURL(/\/kelola\/sparta\/sub-13525071$/);
    await page.goBack();
    // The router writes a string of digits quoted (q=%2213525071%22), so it reads back as text.
    await expect(page).toHaveURL(/q=(%22)?13525071/);
    await expect(main(page).getByText('1 pendaftar')).toBeVisible();
    // Nothing matching, then the filters cleared.
    await search.fill('zzz');
    await expect(
      main(page).getByText('Tidak ada pendaftar yang cocok'),
    ).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Export CSV' }),
    ).toBeDisabled();
    await strictGates(page, testInfo, 'sparta-no-match', lit(testInfo));
    await main(page).getByRole('button', { name: 'Hapus filter' }).click();
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
    // Regression (review P3-A M1): the search box is cleared too, and the next letters search afresh.
    await expect(search).toHaveValue('');
    await expect(page).not.toHaveURL(/q=/);
    await search.pressSequentially('tas');
    await expect(main(page).getByText('1 pendaftar')).toBeVisible();
    expect(await namesShown(page, testInfo)).toEqual(['Tasya Amelia']);
    // Opened from a link with a search, the box shows it.
    await page.goto('/kelola/sparta?q=bima');
    await expect(search).toHaveValue('bima');
    await expect(main(page).getByText('1 pendaftar')).toBeVisible();
  });

  test("the filters' labels line up (review P3-A m5)", async ({ page }) => {
    await page.goto('/kelola/sparta');
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
    const labels = main(page).locator('.g-sparta-filters .t-label');
    await expect(labels).toHaveText(['Divisi', 'Pilihan', 'Status']);
    const size = page.viewportSize()!;
    for (const width of [834, 1024, 1440]) {
      await page.setViewportSize({ width, height: size.height });
      await expect
        .poll(
          async () => {
            const tops = await labels.evaluateAll((els) =>
              els.map((el) => Math.round(el.getBoundingClientRect().top)),
            );
            return Math.max(...tops) - Math.min(...tops);
          },
          { message: `labels at ${width} px` },
        )
        .toBe(0);
    }
    await page.setViewportSize(size);
  });

  test('300 submissions: one tree, and typing a search keeps up (review P3-A m2)', async ({
    page,
    db,
  }, testInfo) => {
    const base = db.internshipSubmissions[0];
    db.internshipSubmissions = Array.from({ length: 300 }, (_, i) => ({
      ...base,
      id: `sub-${i}`,
      nim: `1352${String(i).padStart(4, '0')}`,
      fullName: `Pendaftar ${i + 1}`,
    }));
    await page.goto('/kelola/sparta');
    await expect(main(page).getByText('300 pendaftar')).toBeVisible();
    if (touch(testInfo)) {
      await expect(spartaRows(page)).toHaveCount(300);
      await expect(table(page)).toHaveCount(0);
    } else {
      await expect(table(page).locator('tbody tr')).toHaveCount(300);
      await expect(spartaRows(page)).toHaveCount(0);
    }
    // Typing keeps up on a phone-speed CPU (4× slowdown): the list filters from a deferred query and re-renders only
    // when the rows shown change, so most keystrokes cost no long main-thread task (over 50 ms, measured by the
    // browser). Before the fix each of the 12 keystrokes re-rendered both trees: 12 long tasks; after: 2 to 3.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => {
      const w = window as unknown as { __long: number[] };
      w.__long = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long.push(e.duration);
      }).observe({ type: 'longtask' });
    });
    const search = main(page).getByRole('searchbox', {
      name: 'Cari nama atau NIM',
    });
    await search.pressSequentially('pendaftar 29', { delay: 30 });
    await expect(search).toHaveValue('pendaftar 29');
    // "Pendaftar 29" and "Pendaftar 290" to "Pendaftar 299".
    await expect(main(page).getByText('11 pendaftar')).toBeVisible();
    const long = await page.evaluate(
      () => (window as unknown as { __long: number[] }).__long,
    );
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    expect(long.length, `long tasks: ${long.join(', ')}`).toBeLessThanOrEqual(
      6,
    );
    expect(await namesShown(page, testInfo)).toHaveLength(11);
  });

  test('Export of exactly the rows shown', async ({ page }) => {
    await page.goto('/kelola/sparta?status=terkunci');
    await expect(main(page).getByText('2 pendaftar')).toBeVisible();
    const download = page.waitForEvent('download');
    await main(page).getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
      /^internship-submissions-2026-10-08-06-3\d-\d\d\.csv$/,
    );
    const text = await readDownload(file);
    expect(text.startsWith('﻿Nama,NIM,Jurusan,Kelas,ID Line,Status,')).toBe(
      true,
    );
    const lines = text.slice(1).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(
      /^Bima Santoso,13525071,IF,IF K2,e2e\.bima,Terkunci,Panitia SPARTA 2025,,Welfare and Academics - Akademik,Kenapa kamu tertarik di Akademik\?: /,
    );
    expect(lines[2]).toMatch(/^Tasya Amelia,18225012,STI,/);
    await expect(
      page.getByText('Data 2 pendaftar diunduh sebagai CSV.'),
    ).toBeVisible();
  });

  test('Statistik pilihan: per department or division, first choice or all', async ({
    page,
  }) => {
    await page.goto('/kelola/sparta');
    const bars = main(page).locator('.g-hbars .g-hbar');
    await expect(bars).toHaveText([/^Welfare and Academics\s*3$/]);
    // "Semua pilihan" names only the Pilihan filter's option; the statistics count every choice as "Pilihan 1–4".
    await expect(
      main(page).getByRole('radio', { name: 'Semua pilihan' }),
    ).toHaveCount(0);
    await main(page).getByRole('radio', { name: 'Pilihan 1–4' }).check();
    await expect(bars).toHaveText([
      /^Welfare and Academics\s*6$/,
      /^Competition and Community\s*3$/,
      /^Career Development\s*2$/,
    ]);
    await main(page).getByRole('radio', { name: 'Per divisi' }).check();
    await expect(bars).toHaveText([
      /^Welfare and Academics · Akademik\s*3$/,
      /^Welfare and Academics · Welfare\s*3$/,
      /^Competition and Community · Competition and Community\s*3$/,
      /^Career Development · Career Development\s*2$/,
    ]);
    // Regression: at 320 px the long labels' column left the bars a few pixels wide; the label now sits above.
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: 320, height: size.height });
    await expect
      .poll(() =>
        bars
          .first()
          .locator('.trk')
          .evaluate((el) => el.clientWidth),
      )
      .toBeGreaterThan(150);
    await page.setViewportSize(size);
    // It counts what matches the status filter.
    await main(page).getByRole('radio', { name: 'Draf' }).check();
    await expect(bars).toHaveText([
      /Akademik\s*1$/,
      /Welfare\s*1$/,
      /Competition and Community\s*1$/,
    ]);
  });

  test('25 submissions load as two requests, at offset 0 and 20', async ({
    page,
    api,
    db,
  }) => {
    const base = db.internshipSubmissions[0];
    db.internshipSubmissions = Array.from({ length: 25 }, (_, i) => ({
      ...base,
      id: `sub-${i}`,
      nim: `135250${String(i).padStart(2, '0')}`,
      fullName: `Pendaftar ${i + 1}`,
    }));
    await page.goto('/kelola/sparta');
    await expect(main(page).getByText('25 pendaftar')).toBeVisible();
    expect(
      api.calls('GET /api/internship/submissions').map((c) => c.query),
    ).toEqual(['?offset=0', '?offset=20']);
  });

  test('none at all', async ({ page, db }, testInfo) => {
    db.internshipSubmissions = [];
    await page.goto('/kelola/sparta');
    await expect(main(page).getByText('Belum ada pendaftar')).toBeVisible();
    // One message (review P3-A m3): no statistics, toolbar, count or Export with nothing to act on.
    await expect(
      main(page).getByText('Belum ada data pilihan untuk ditampilkan.'),
    ).toHaveCount(0);
    await expect(main(page).getByRole('searchbox')).toHaveCount(0);
    await expect(main(page).getByRole('combobox')).toHaveCount(0);
    await expect(main(page).getByText('0 pendaftar')).toHaveCount(0);
    await expect(
      main(page).getByRole('button', { name: 'Export CSV' }),
    ).toHaveCount(0);
    await expect(
      main(page).getByRole('heading', { name: 'Statistik pilihan' }),
    ).toHaveCount(0);
    await strictGates(page, testInfo, 'sparta-empty', lit(testInfo));
  });

  test('503, then Coba lagi', async ({ page, api }) => {
    api.on('GET /api/internship/submissions', reply.status(503));
    await page.goto('/kelola/sparta');
    const failed = main(page)
      .getByRole('alert')
      .filter({ hasText: 'Data SPARTA gagal dimuat.' });
    await expect(failed).toBeVisible();
    api.on(
      'GET /api/internship/submissions',
      defaultHandlers['GET /api/internship/submissions'],
    );
    await failed.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
  });

  test('offline keeps the table under the banner', async ({ page, api }) => {
    await page.goto('/kelola/sparta');
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
    await api.setOffline(true);
    await expect(main(page).locator('.g-offline')).toBeVisible();
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
    await api.setOffline(false);
  });

  test("Bima's submission: four choices in order, their questions and answers", async ({
    page,
  }, testInfo) => {
    await page.goto('/kelola/sparta/sub-13525071');
    if (touch(testInfo))
      await expect(
        page.getByRole('heading', { name: 'Bima Santoso', level: 1 }),
      ).toBeVisible();
    else
      await expect(
        main(page).getByRole('heading', { name: 'Bima Santoso', level: 1 }),
      ).toBeVisible();
    await expect(main(page).getByText('13525071 · IF · IF K2')).toBeVisible();
    await expect(main(page).getByText('Terkunci')).toBeVisible();
    await expect(main(page).getByText('e2e.bima')).toBeVisible();
    await expect(main(page).getByText('Panitia SPARTA 2025')).toBeVisible();
    await expect(main(page).locator('.g-choice-card h3')).toHaveText([
      'Prioritas 1: Akademik',
      'Prioritas 2: Welfare',
      'Prioritas 3: Competition and Community',
      'Prioritas 4: Career Development',
    ]);
    await expect(main(page).locator('.g-choice-card').first()).toContainText(
      'Welfare and Academics',
    );
    await expect(main(page).locator('.g-choice-card').first()).toContainText(
      'Kenapa kamu tertarik di Akademik?',
    );
    await expect(main(page).locator('.g-choice-card').first()).toContainText(
      'Aku ingin bantu rekap jadwal ujian angkatan.',
    );
    await strictGates(page, testInfo, 'sparta-submission', lit(testInfo));
    if (!touch(testInfo))
      await expect(
        page.getByRole('navigation', { name: 'Jejak halaman' }),
      ).toHaveText(/Kelola\s*Data SPARTA Magang\s*Bima Santoso/);
  });

  test("Nadia's partial draft shows what it has, with –", async ({
    page,
    db,
  }) => {
    const nadia = db.internshipSubmissions[2];
    nadia.kelas = '';
    nadia.idLine = '';
    await page.goto('/kelola/sparta/sub-13525045');
    await expect(main(page).getByText('13525045 · IF · –')).toBeVisible();
    await expect(main(page).getByText('Draf')).toBeVisible();
    await expect(main(page).locator('.g-choice-card h3')).toHaveText([
      'Prioritas 1: Akademik',
      'Prioritas 2: Welfare',
      'Prioritas 3: Competition and Community',
    ]);
    await expect(main(page).locator('.g-choice-card dd').first()).toHaveText(
      '–',
    );
  });

  test('a division that no longer exists, and a file answer', async ({
    page,
    db,
  }) => {
    const bima = db.internshipSubmissions[0];
    bima.choices![3].divisionId = 'div-hilang';
    db.internshipDepartments[0].divisions![0].questions.push({
      id: 'dq9',
      label: 'Portofolio',
      type: 'file',
      required: false,
    });
    bima.choices![0].answers.push({
      questionId: 'dq9',
      answer: 'https://media.pips.test/sparta/portofolio.pdf',
    });
    await page.goto('/kelola/sparta/sub-13525071');
    await expect(
      main(page).getByText('Prioritas 4: Divisi tidak ditemukan'),
    ).toBeVisible();
    const file = main(page).getByRole('link', { name: /Lihat file/ });
    await expect(file).toHaveAttribute(
      'href',
      'https://media.pips.test/sparta/portofolio.pdf',
    );
    await expect(file).toHaveAttribute('target', '_blank');
  });

  // Review P3-A m1: a member's file answer is any text they saved. Only a file in the app's storage
  // (VITE_MEDIA_URL, https://media.pips.test in the harness) becomes a link; anything else is plain text.
  test("a file answer that isn't in the app's storage is plain text, never a link", async ({
    page,
    db,
  }) => {
    db.internshipDepartments[0].divisions![0].questions.push({
      id: 'dq9',
      label: 'Portofolio',
      type: 'file',
      required: false,
    });
    const answers = db.internshipSubmissions[0].choices![0].answers;
    answers.push({ questionId: 'dq9', answer: '' });
    for (const answer of [
      'javascript:alert(document.cookie)',
      ' JavaScript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '//evil.example/cv.pdf',
      'https://evil.example/login',
      'https://media.pips.test@evil.example/cv.pdf',
    ]) {
      answers[answers.length - 1].answer = answer;
      await page.goto('/kelola/sparta/sub-13525071');
      const card = main(page).locator('.g-choice-card').first();
      await expect(card.getByText('Portofolio')).toBeVisible();
      await expect(card.locator('dd').last()).toHaveText(answer.trim());
      await expect(
        main(page).getByRole('link', { name: /Lihat file/ }),
      ).toHaveCount(0);
      await expect(card.locator('a')).toHaveCount(0);
    }
  });

  test('an unknown submission', async ({ page }) => {
    await page.goto('/kelola/sparta/sub-tidak-ada');
    await expect(
      main(page).getByText('Pendaftar tidak ditemukan'),
    ).toBeVisible();
    await main(page)
      .getByRole('link', { name: 'Ke Data SPARTA Magang' })
      .click();
    await expect(page).toHaveURL(/\/kelola\/sparta$/);
  });
});
