/**
 * Testi Matkul and NIM Finder (P2-B). Phone, tablet and desktop, light and dark, with strict gates.
 *
 * T3 kept Testi Matkul's code search as an expected failure (today's list lowercased the query and compared it with
 * upper-case codes). The redesign fixes it; the journeys below must pass, and the `test.fail` is gone.
 */
import type { Page, TestInfo } from '@playwright/test';
import type { NimFinderResult } from '../../src/api/generated';
import { avatarUrl } from '../fixtures/api';
import { layoutOf } from '../support/app';
import { reply } from '../support/mock';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const courseRows = (page: Page) =>
  main(page).getByRole('link', { name: /^[A-Z]{2}\d{4} / });
const article = (page: Page, i: number, n: number) =>
  main(page).getByRole('article', { name: `Testimoni ${i} dari ${n}` });
const testiCalls = (api: { calls: (s: string) => unknown[] }) =>
  api.calls('GET /api/testimoni/course/:courseId').length;

/** The back control on touch layouts, or the breadcrumb trail on desktop. */
async function expectUpTo(page: Page, testInfo: TestInfo, title: string) {
  if (layoutOf(testInfo) === 'desktop')
    await expect(
      page
        .getByRole('navigation', { name: 'Jejak halaman' })
        .getByRole('link', { name: title }),
    ).toBeVisible();
  else
    await expect(
      page.getByRole('button', { name: `Kembali ke ${title}` }),
    ).toBeVisible();
}

test.describe('Testi Matkul by browsing', () => {
  test('IF → Semester 3 → IF2110, then paging with the ends disabled and focus kept', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/testi');
    await strictGates(page, testInfo, 'testi-start', 'Layanan');
    await main(page).getByRole('link', { name: 'Teknik Informatika' }).click();
    await expect(page).toHaveURL(/\/layanan\/testi\/teknik-informatika$/);
    await expect(page).toHaveTitle('Teknik Informatika · PIPS!');
    await strictAudit(page, testInfo, 'testi-programme');
    await expect(
      main(page).getByRole('link', { name: 'Mata Kuliah Pilihan' }),
    ).toBeVisible();
    await main(page).getByRole('link', { name: 'Semester 3' }).click();
    await expect(page).toHaveURL(/\/layanan\/testi\/teknik-informatika\/3$/);
    await expect(page).toHaveTitle('IF · Semester 3 · PIPS!');
    // Each course with its count; STI's courses aren't in IF's list.
    await expect(
      main(page).getByRole('link', {
        name: /^IF2110 Algoritma dan Pemrograman II\s*3 testimoni$/,
      }),
    ).toBeVisible();
    await expect(
      main(page).getByRole('link', {
        name: /^IF2120 Probabilitas dan Statistika\s*Belum ada testimoni$/,
      }),
    ).toBeVisible();
    await expect(courseRows(page)).toHaveCount(6);
    await expect(main(page).getByText('Matematika Diskret')).toHaveCount(0);
    await strictGates(page, testInfo, 'testi-list', 'Layanan');

    await main(page)
      .getByRole('link', { name: /^IF2110 / })
      .click();
    await expect(page).toHaveURL(/\/teknik-informatika\/3\/course-IF2110$/);
    await expect(page).toHaveTitle('IF2110 · PIPS!');
    await expectUpTo(page, testInfo, 'IF · Semester 3');
    await expect(main(page).getByText('IF2110 · 3 SKS')).toBeVisible();
    await expect(
      main(page).getByRole('heading', { name: 'Algoritma dan Pemrograman II' }),
    ).toBeVisible();
    await expect(article(page, 1, 3)).toBeVisible();
    // Anonymous author: "Anonim" with "?".
    await expect(article(page, 1, 3)).toContainText('Anonim');
    await expect(
      article(page, 1, 3).getByRole('heading', { level: 3 }),
    ).toHaveText(['Overview', 'Tugas', 'Review Dosen']);
    await expect(main(page).getByText('1 / 3')).toBeVisible();
    await strictGates(page, testInfo, 'testi-course', 'Layanan');

    const prev = main(page).getByRole('button', {
      name: 'Testimoni sebelumnya',
    });
    const next = main(page).getByRole('button', {
      name: 'Testimoni berikutnya',
    });
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    // The ends are aria-disabled (still focusable), so pressing them does nothing; Playwright needs `force`.
    await prev.click({ force: true });
    await expect(article(page, 1, 3)).toBeVisible();
    await next.click();
    await expect(article(page, 2, 3)).toBeVisible();
    await expect(next).toBeFocused();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(article(page, 2, 3)).toContainText('Fikri, IF 2023');
    await page.keyboard.press('Enter');
    await expect(article(page, 3, 3)).toBeVisible();
    await expect(next).toBeFocused();
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await next.click({ force: true });
    await expect(article(page, 3, 3)).toBeVisible();
    await prev.click();
    await expect(article(page, 2, 3)).toBeVisible();
    await expect(prev).toBeFocused();
    // Paging replaced the entry: Back leaves the course in one step.
    await page.goBack();
    await expect(page).toHaveURL(/\/layanan\/testi\/teknik-informatika\/3$/);
  });

  test('an STI course shows Kesan, Tantangan and Saran', async ({ page }) => {
    await page.goto(
      '/layanan/testi/sistem-dan-teknologi-informasi/3/course-II2110',
    );
    await expect(
      main(page)
        .getByRole('article', { name: /^Testimoni 1 dari/ })
        .getByRole('heading', { level: 3 }),
    ).toHaveText(['Kesan', 'Tantangan', 'Saran']);
  });

  test('a course with no testimonials says how they are gathered, and still links its Ding Dong', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/testi/teknik-informatika/3/course-IF2120');
    await expect(main(page).getByText('Belum ada testimoni')).toBeVisible();
    await expect(
      main(page).getByText(
        'Testimoni dikumpulkan divisi Akademik tiap akhir semester.',
      ),
    ).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: /Testimoni/ }),
    ).toHaveCount(0);
    await expect(
      main(page).getByRole('link', { name: /^Buka Ding Dong IF2120/ }),
    ).toBeVisible();
    await strictAudit(page, testInfo, 'testi-course-empty');
  });

  test('Mata Kuliah Umum skips the semester step', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/testi');
    await main(page).getByRole('link', { name: 'Mata Kuliah Umum' }).click();
    await expect(page).toHaveURL(/\/layanan\/testi\/mata-kuliah-umum\/other$/);
    await expect(page).toHaveTitle('Mata Kuliah Umum · PIPS!');
    await expect(
      main(page).getByRole('link', { name: /^DP3011 Berpikir Desain/ }),
    ).toBeVisible();
    await expectUpTo(page, testInfo, 'Testi Matkul');
    // The programme page alone leads to the same list.
    await page.goto('/layanan/testi/mata-kuliah-umum');
    await expect(page).toHaveURL(/\/layanan\/testi\/mata-kuliah-umum\/other$/);
  });

  test('Buka Ding Dong opens the folder in a new tab, or says a course has none', async ({
    page,
  }) => {
    await page.goto('/layanan/testi/teknik-informatika/3/course-IF2110');
    const folder = main(page).getByRole('link', {
      name: 'Buka Ding Dong IF2110 (situs luar, tab baru)',
    });
    await expect(folder).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/e2e-IF2110',
    );
    await expect(folder).toHaveAttribute('target', '_blank');
    await expect(folder).toHaveAttribute('rel', /noopener/);
    await page.goto('/layanan/testi/teknik-informatika/other/course-IF4010');
    await main(page)
      .getByRole('button', { name: 'Buka Ding Dong IF4010' })
      .click();
    await expect(
      page.getByText('Folder Ding Dong untuk IF4010 belum tersedia.'),
    ).toBeVisible();
  });

  test('a deep link opens the course at its testimonial; a page out of range shows the last', async ({
    page,
  }) => {
    await page.goto('/layanan/testi/teknik-informatika/3/course-IF2110?page=2');
    await expect(article(page, 2, 3)).toBeVisible();
    await page.goto('/layanan/testi/teknik-informatika/3/course-IF2110?page=9');
    await expect(article(page, 3, 3)).toBeVisible();
  });

  test('an unknown course or programme says so, with the way back to Testi Matkul', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/testi/teknik-informatika/3/course-NOPE');
    await expect(
      main(page).getByText('Mata kuliah tidak ditemukan'),
    ).toBeVisible();
    await strictAudit(page, testInfo, 'testi-not-found');
    await main(page)
      .getByRole('link', { name: 'Kembali ke Testi Matkul' })
      .click();
    await expect(page).toHaveURL(/\/layanan\/testi$/);
    await page.goto('/layanan/testi/arsitektur');
    await expect(
      main(page).getByText('Mata kuliah tidak ditemukan'),
    ).toBeVisible();
  });

  test('Back from a course page keeps the list’s search', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/testi/teknik-informatika/3');
    const box = main(page).getByRole('searchbox', { name: 'Cari mata kuliah' });
    await box.fill('sistem');
    await expect(courseRows(page)).toHaveCount(1);
    await expect(page).toHaveURL(/\?q=sistem$/);
    await courseRows(page).click();
    await expect(page).toHaveURL(/course-IF2130$/);
    if (layoutOf(testInfo) === 'desktop') await page.goBack();
    else
      await page
        .getByRole('button', { name: 'Kembali ke IF · Semester 3' })
        .click();
    await expect(page).toHaveURL(/\/teknik-informatika\/3\?q=sistem$/);
    await expect(box).toHaveValue('sistem');
    await expect(courseRows(page)).toHaveCount(1);
  });
});

test.describe('Testi Matkul by course code', () => {
  test('regression: the start screen finds a code in lower and upper case; Enter changes nothing', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/testi');
    const box = main(page).getByRole('searchbox', { name: 'Cari mata kuliah' });
    await expect(box).toHaveAttribute(
      'placeholder',
      'Cari kode atau nama mata kuliah',
    );
    for (const q of ['if2110', 'IF2110']) {
      await box.fill(q);
      await expect(main(page).getByRole('status')).toHaveText('1 mata kuliah');
      await expect(courseRows(page)).toHaveCount(1);
      await expect(
        main(page).getByRole('link', {
          name: /^IF2110 Algoritma dan Pemrograman II\s*3 testimoni$/,
        }),
      ).toBeVisible();
    }
    const url = page.url();
    await box.press('Enter');
    await expect(page).toHaveURL(url);
    await expect(courseRows(page)).toHaveCount(1);
    await expect(box).toBeFocused();
    await strictGates(page, testInfo, 'testi-search', 'Layanan');
  });

  test('regression: inside a course list reached by today’s old path, a code finds its course', async ({
    page,
  }) => {
    // The path T3's expected failure used, through P0-B's redirect.
    await page.goto('/home/testimoni/teknik-informatika/3');
    await expect(page).toHaveURL(/\/layanan\/testi\/teknik-informatika\/3$/);
    await expect(courseRows(page)).toHaveCount(6);
    const box = main(page).getByRole('searchbox', { name: 'Cari mata kuliah' });
    await expect(box).toHaveAttribute('placeholder', 'Cari kode atau nama');
    await box.fill('IF2130');
    await expect(courseRows(page)).toHaveCount(1);
    await expect(
      main(page).getByRole('link', { name: /^IF2130 Sistem Operasi/ }),
    ).toBeVisible();
    await box.fill('if2130');
    await expect(courseRows(page)).toHaveCount(1);
  });

  test('no match says so, in both searches', async ({ page }) => {
    await page.goto('/layanan/testi');
    await main(page)
      .getByRole('searchbox', { name: 'Cari mata kuliah' })
      .fill('zzz');
    await expect(main(page).getByText('Tidak ada mata kuliah')).toBeVisible();
    await expect(
      main(page).getByText('Coba kode atau nama lain.'),
    ).toBeVisible();
    await expect(main(page).getByRole('status')).toHaveText('0 mata kuliah');
    await page.goto('/layanan/testi/teknik-informatika/4');
    await main(page)
      .getByRole('searchbox', { name: 'Cari mata kuliah' })
      .fill('zzz');
    await expect(
      main(page).getByText('Coba kata lain atau semester lain.'),
    ).toBeVisible();
  });

  test('typing "a" counts testimonials only for the rows on screen', async ({
    page,
    api,
  }) => {
    await page.goto('/layanan/testi');
    await main(page)
      .getByRole('searchbox', { name: 'Cari mata kuliah' })
      .pressSequentially('a', { delay: 30 });
    await expect.poll(() => courseRows(page).count()).toBeGreaterThan(20);
    // Let typing settle and the visible rows count.
    await expect
      .poll(() =>
        main(page)
          .getByText(/ testimoni$/)
          .count(),
      )
      .toBeGreaterThan(0);
    await page.waitForTimeout(800);
    const onScreen = await courseRows(page).evaluateAll(
      (els) =>
        els.filter((e) => {
          const r = e.getBoundingClientRect();
          // Edge-inclusive, as IntersectionObserver counts a row touching the window's edge as on screen.
          return r.bottom >= 0 && r.top <= window.innerHeight;
        }).length,
    );
    const total = await courseRows(page).count();
    expect(onScreen).toBeLessThan(total);
    expect(testiCalls(api)).toBeGreaterThan(0);
    expect(
      testiCalls(api),
      `requests: ${api
        .calls('GET /api/testimoni/course/:courseId')
        .map((c) => c.path.split('/').pop())
        .join(', ')}`,
    ).toBeLessThanOrEqual(onScreen);
  });
});

/** NIM Finder's results in the API's old order (names Z–A), with only the four public fields. */
function zToA(
  members: { fullName: string; nim: string; major: string }[],
  search: string,
): NimFinderResult[] {
  const q = search.toLowerCase();
  return members
    .filter((m) => m.fullName.toLowerCase().includes(q) || m.nim.includes(q))
    .sort((a, b) => b.fullName.localeCompare(a.fullName))
    .map(({ fullName, nim, major }) => ({
      fullName,
      nim,
      major: major as NimFinderResult['major'],
      picture: null,
    }));
}

test.describe('NIM Finder', () => {
  test('under 3 characters asks nothing; "rak" finds 2, names A–Z although the API sends them Z–A', async ({
    page,
    api,
    db,
  }, testInfo) => {
    api.on('GET /api/user/nim', ({ query }) =>
      zToA(db.members, query.get('search') ?? ''),
    );
    await page.goto('/layanan/nim');
    const box = main(page).getByRole('searchbox', {
      name: 'Cari nama atau NIM',
    });
    await expect(box).toHaveAttribute('placeholder', 'Ketik nama atau NIM');
    const status = main(page).getByRole('status');
    await expect(status).toHaveText(
      'Ketik minimal 3 huruf nama atau angka NIM.',
    );
    await box.fill('ra');
    await page.waitForTimeout(900);
    expect(api.calls('GET /api/user/nim')).toHaveLength(0);
    await box.fill('rak');
    await expect(status).toHaveText('2 hasil. Pilih untuk menyalin NIM.');
    const rows = main(page).getByRole('button', { name: /^Salin NIM / });
    await expect(rows).toHaveText([
      /Raka Pratama\s*Teknik Informatika\s*13524087/,
      /Rakai Prasetyo\s*Sistem dan Teknologi Informasi\s*18225019/,
    ]);
    await expect(page).toHaveURL(/\/layanan\/nim\?q=rak$/);
    await strictGates(page, testInfo, 'nim', 'Layanan');
  });

  test('a row shows the member’s photo when it loads, and their initials otherwise', async ({
    page,
    api,
  }, testInfo) => {
    // Dev 1's decision (P2-B round 2): the photo through the Garis Avatar, initials when there's none or it fails.
    api.on('GET /api/user/nim', () => [
      {
        fullName: 'Raka Pratama',
        nim: '13524087',
        major: 'IF',
        picture: avatarUrl('13524087'),
      },
      {
        fullName: 'Rakai Prasetyo',
        nim: '18225019',
        major: 'STI',
        picture: '/__e2e__/avatar/hilang.png',
      },
      { fullName: 'Raka Wijaya', nim: '13523001', major: 'IF', picture: null },
    ]);
    await page.goto('/layanan/nim?q=rak');
    const row = (nim: string) =>
      main(page).getByRole('button', {
        name: new RegExp(`^Salin NIM ${nim},`),
      });
    const photo = row('13524087').locator('img');
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(photo).toHaveAttribute('alt', '');
    // A photo that fails to load leaves the initials; no photo at all shows them too.
    await expect(row('18225019').locator('img')).toHaveCount(0);
    await expect(row('18225019')).toContainText('RP');
    await expect(row('13523001').locator('img')).toHaveCount(0);
    await expect(row('13523001')).toContainText('RW');
    await strictAudit(page, testInfo, 'nim-photos');
  });

  test('at the API’s cap of 30 the count reads "30+ hasil"', async ({
    page,
    api,
  }) => {
    // Dev 1's decision (P2-B round 2): 30 is P0-D's cap, not the total, so the count says there may be more.
    api.on('GET /api/user/nim', () =>
      Array.from({ length: 30 }, (_, i) => ({
        fullName: `Anggota ${String(i + 1).padStart(2, '0')}`,
        nim: `135240${String(i + 1).padStart(2, '0')}`,
        major: 'IF' as const,
        picture: null,
      })),
    );
    await page.goto('/layanan/nim?q=135');
    await expect(main(page).getByRole('status')).toHaveText(
      '30+ hasil. Pilih untuk menyalin NIM.',
    );
    await expect(
      main(page).getByRole('button', { name: /^Salin NIM / }),
    ).toHaveCount(30);
  });

  test('a row copies its NIM and says so', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/layanan/nim?q=tasya');
    await main(page)
      .getByRole('button', { name: 'Salin NIM 18225012, Tasya Amelia' })
      .click();
    await expect(page.getByText('NIM 18225012 disalin.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      '18225012',
    );
  });

  test('a failed copy says so', async ({ page, context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('blocked')) },
      });
    });
    await page.goto('/layanan/nim?q=tasya');
    await main(page)
      .getByRole('button', { name: 'Salin NIM 18225012, Tasya Amelia' })
      .click();
    await expect(
      page.getByText('NIM 18225012 gagal disalin. Coba lagi.'),
    ).toBeVisible();
  });

  test('finds by NIM; no match says so with the query as typed', async ({
    page,
    api,
  }) => {
    await page.goto('/layanan/nim');
    const box = main(page).getByRole('searchbox', {
      name: 'Cari nama atau NIM',
    });
    await box.fill('18225012');
    await expect(
      main(page).getByRole('button', {
        name: 'Salin NIM 18225012, Tasya Amelia',
      }),
    ).toBeVisible();
    await box.fill('Zzzz');
    await expect(main(page).getByRole('status')).toHaveText(
      'Tidak ada anggota dengan nama atau NIM “Zzzz”.',
    );
    expect(
      api
        .calls('GET /api/user/nim')
        .map((c) => new URLSearchParams(c.query).get('search')),
    ).toEqual(['18225012', 'Zzzz']);
  });

  test('a 503 says the search failed, and Coba lagi recovers', async ({
    page,
    api,
    db,
  }, testInfo) => {
    let fail = true;
    api.on('GET /api/user/nim', ({ query }) =>
      fail ? reply.status(503) : zToA(db.members, query.get('search') ?? ''),
    );
    await page.goto('/layanan/nim?q=rak');
    await expect(main(page).getByText('Pencarian gagal.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(main(page)).not.toContainText('503');
    await strictAudit(page, testInfo, 'nim-error');
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(main(page).getByRole('status')).toHaveText(
      '2 hasil. Pilih untuk menyalin NIM.',
    );
  });

  test('a link opens it with the query filled in', async ({ page, api }) => {
    await page.goto('/layanan/nim?q=rak');
    await expect(
      main(page).getByRole('searchbox', { name: 'Cari nama atau NIM' }),
    ).toHaveValue('rak');
    await expect(main(page).getByRole('status')).toHaveText(
      '2 hasil. Pilih untuk menyalin NIM.',
    );
    expect(api.calls('GET /api/user/nim')).toHaveLength(1);
  });

  test('regression: fast typing sends one request, for the final query', async ({
    page,
    api,
  }) => {
    await page.goto('/layanan/nim');
    await main(page)
      .getByRole('searchbox', { name: 'Cari nama atau NIM' })
      .pressSequentially('rakai p', { delay: 60 });
    await expect(main(page).getByRole('status')).toHaveText(
      '1 hasil. Pilih untuk menyalin NIM.',
    );
    await page.waitForTimeout(800);
    expect(
      api
        .calls('GET /api/user/nim')
        .map((c) => new URLSearchParams(c.query).get('search')),
    ).toEqual(['rakai p']);
  });
});
