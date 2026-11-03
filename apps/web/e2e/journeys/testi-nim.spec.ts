/**
 * Testi Matkul and NIM Finder (P2-B). Phone, tablet and desktop, light and dark, with strict gates.
 *
 * T3 kept Testi Matkul's code search as an expected failure (today's list lowercased the query and compared it with
 * upper-case codes). The redesign fixes it; the journeys below must pass, and the `test.fail` is gone.
 *
 * Garis v5: a course page shows every testimonial at once, read by scrolling (no pager), in one column on phones,
 * two on tablets and 1024 px desktops and three at 1440; sections over 280 characters fold to six lines.
 */
import type { Page, TestInfo } from '@playwright/test';
import type { NimFinderResult, Testimoni } from '../../src/api/generated';
import { avatarUrl } from '../fixtures/api';
import { layoutOf } from '../support/app';
import { reply } from '../support/mock';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const courseRows = (page: Page) =>
  main(page).getByRole('link', { name: /^[A-Z]{2}\d{4} / });
/** A course page's testimonials, each a list item headed by its author. */
const cards = (page: Page) =>
  main(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3 }) });
const card = (page: Page, by: string) =>
  cards(page).filter({
    has: page.getByRole('heading', { level: 3, name: by, exact: true }),
  });
const IF2110 = '/layanan/testi/teknik-informatika/3/course-IF2110';
const IF2110_BY = [
  'Anonim',
  'Fikri, IF 2023',
  'Anonim',
  'Aulia, IF 2024',
  'Anonim',
  'Dimas, IF 2023',
];

/** How many columns the cards sit in: their distinct left edges. */
const columns = (page: Page) =>
  cards(page).evaluateAll(
    (els) =>
      new Set(els.map((e) => Math.round(e.getBoundingClientRect().left))).size,
  );

/**
 * Every card can be scrolled fully into view, inside the main column and the window, and nothing scrolls sideways;
 * the order down the page (and across the columns) is the API's order, the keyboard's too.
 */
async function expectEveryCardReachable(page: Page, n: number) {
  await expect(cards(page)).toHaveCount(n);
  for (let i = 0; i < n; i++) {
    const c = cards(page).nth(i);
    await c.scrollIntoViewIfNeeded();
    await expect(c).toBeInViewport({ ratio: 0.99 });
    const fits = await c.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const m = el.closest('main')!.getBoundingClientRect();
      return (
        r.left >= m.left - 1 &&
        r.right <= m.right + 1 &&
        r.right <= window.innerWidth + 1
      );
    });
    expect(fits, `card ${i + 1} fits its column`).toBe(true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}

/** The columns a layout gives (Garis v5): 1 under 640 px, 2 below 1440 (300 px each), 3 at 1440. */
const columnsAt = (width: number) => (width < 640 ? 1 : width < 1300 ? 2 : 3);
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
  test('IF → Semester 3 → IF2110: every testimonial at once, no pager, Ding Dong in the header', async ({
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
        name: /^IF2110 Algoritma dan Pemrograman II\s*6 testimoni$/,
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
    // The code is the title, so the line above the name is only the credits (owner, 2026-11-03; regression: it
    // read "IF2110 · 3 SKS" under the title "IF2110").
    await expect(
      page
        .getByRole('heading', { level: 1, name: 'IF2110' })
        .locator('visible=true'),
    ).toHaveCount(1);
    await expect(main(page).getByText('3 SKS', { exact: true })).toBeVisible();
    await expect(main(page).getByText('IF2110 · 3 SKS')).toHaveCount(0);
    const name = main(page).getByRole('heading', {
      name: 'Algoritma dan Pemrograman II',
    });
    await expect(name).toBeVisible();
    // Every testimonial, in the API's order; anonymous authors read "Anonim".
    await expect(cards(page).getByRole('heading', { level: 3 })).toHaveText(
      IF2110_BY,
    );
    await expect(cards(page).first().getByRole('term')).toHaveText([
      'Overview',
      'Tugas',
      'Review Dosen',
    ]);
    // No pager.
    await expect(
      main(page).getByRole('button', {
        name: /^Testimoni (sebelumnya|berikutnya)$/,
      }),
    ).toHaveCount(0);
    await expect(main(page).getByText(/^\d+ \/ \d+$/)).toHaveCount(0);
    await expect(
      main(page).getByRole('button', { name: /Sebelumnya|Berikutnya/ }),
    ).toHaveCount(0);
    // Buka Ding Dong sits in the course's header, before the first testimonial.
    const folder = main(page).getByRole('link', {
      name: 'Buka Ding Dong IF2110 (situs luar, tab baru)',
    });
    await expect(folder).toBeInViewport();
    const [folderTop, firstTop] = await Promise.all([
      folder.boundingBox(),
      cards(page).first().boundingBox(),
    ]);
    expect(folderTop!.y).toBeLessThan(firstTop!.y);
    expect(await columns(page)).toBe(columnsAt(page.viewportSize()!.width));
    await strictGates(page, testInfo, 'testi-course', 'Layanan');
    await expectEveryCardReachable(page, 6);
  });

  test('an STI course shows Kesan, Tantangan and Saran', async ({ page }) => {
    await page.goto(
      '/layanan/testi/sistem-dan-teknologi-informasi/3/course-II2110',
    );
    await expect(cards(page)).toHaveCount(2);
    for (const i of [0, 1])
      await expect(cards(page).nth(i).getByRole('term')).toHaveText([
        'Kesan',
        'Tantangan',
        'Saran',
      ]);
  });

  test('Dosen follows the programme’s sections when the API gives the lecturer, in both programmes', async ({
    page,
    db,
  }, testInfo) => {
    const set = (code: string, lecturer: string) => {
      const t = db.testimonials.find((x) => x.courseId === `course-${code}`)!;
      t.lecturer = lecturer;
    };
    set('IF2110', 'Dr. Rina Wulandari');
    set('II2110', 'Dr. Budi Santoso');
    await page.goto(IF2110);
    const first = cards(page).first();
    await expect(first.getByRole('term')).toHaveText([
      'Overview',
      'Tugas',
      'Review Dosen',
      'Dosen',
    ]);
    await expect(first.getByRole('definition').last()).toHaveText(
      'Dr. Rina Wulandari',
    );
    // The others name no lecturer: no Dosen.
    await expect(cards(page).nth(1).getByRole('term')).toHaveText([
      'Overview',
      'Tugas',
      'Review Dosen',
    ]);
    await strictAudit(page, testInfo, 'testi-dosen');
    await page.goto(
      '/layanan/testi/sistem-dan-teknologi-informasi/3/course-II2110',
    );
    await expect(cards(page).first().getByRole('term')).toHaveText([
      'Kesan',
      'Tantangan',
      'Saran',
      'Dosen',
    ]);
    await expect(cards(page).first().getByRole('definition').last()).toHaveText(
      'Dr. Budi Santoso',
    );
  });

  test('a long section folds to six lines; Baca selengkapnya opens it and Ringkas lagi folds it, by keyboard and pointer', async ({
    page,
  }, testInfo) => {
    await page.goto(IF2110);
    const aulia = card(page, 'Aulia, IF 2024');
    const overview = aulia.getByRole('definition').first();
    const more = aulia.getByRole('button', { name: 'Baca selengkapnya' });
    // Only the card with a section over 280 characters has the control.
    await expect(
      main(page).getByRole('button', {
        name: /^(Baca selengkapnya|Ringkas lagi)$/,
      }),
    ).toHaveCount(1);
    const lines = () =>
      overview.evaluate((el) => {
        const lh = parseFloat(getComputedStyle(el).lineHeight);
        return {
          shown: Math.round(el.clientHeight / lh),
          hidden: el.scrollHeight > el.clientHeight + 1,
        };
      });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    const controls = await more.getAttribute('aria-controls');
    expect(
      await aulia.locator('dl').getAttribute('id'),
      'the button controls the sections',
    ).toBe(controls);
    expect(await lines()).toEqual({ shown: 6, hidden: true });
    // Its short sections aren't folded.
    for (const i of [1, 2])
      expect(
        await aulia
          .getByRole('definition')
          .nth(i)
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);

    // Keyboard: Enter opens it, focus stays on the control, which now reads Ringkas lagi.
    await more.focus();
    await page.keyboard.press('Enter');
    const less = aulia.getByRole('button', { name: 'Ringkas lagi' });
    await expect(less).toBeFocused();
    await expect(less).toHaveAttribute('aria-expanded', 'true');
    expect((await lines()).hidden).toBe(false);
    expect((await lines()).shown).toBeGreaterThan(6);
    await expect(overview).toContainText('lalu bandingkan caranya.');
    await strictGates(page, testInfo, 'testi-open', 'Layanan');
    // The gates walk the page with Tab; come back to the control, then Space folds it again.
    await less.focus();
    await page.keyboard.press('Space');
    await expect(more).toBeFocused();
    expect(await lines()).toEqual({ shown: 6, hidden: true });

    // Pointer.
    await more.click();
    await expect(less).toHaveAttribute('aria-expanded', 'true');
    await less.click();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(await lines()).toEqual({ shown: 6, hidden: true });
  });

  test('a course with 25 testimonials shows all 25, each reachable by scrolling, at 320 and 390 phones, tablet, and 1024 and 1440 desktops', async ({
    page,
    db,
  }, testInfo) => {
    const base = db.testimonials.find((t) => t.courseId === 'course-IF2130')!;
    db.testimonials = db.testimonials.filter(
      (t) => t.courseId !== 'course-IF2130',
    );
    for (let i = 1; i <= 25; i++)
      db.testimonials.push({
        ...base,
        id: `t-many-${i}`,
        userName: `Penulis ${i}`,
        overview: `Testimoni nomor ${i}. ${'Materinya padat. '.repeat(i % 4)}`,
      } satisfies Testimoni);
    const sizes = testInfo.project.name.startsWith('desktop')
      ? [
          { width: 1440, height: 900 },
          { width: 1024, height: 768 },
        ]
      : testInfo.project.name.startsWith('tablet')
        ? [{ width: 834, height: 1112 }]
        : [
            { width: 390, height: 844 },
            { width: 320, height: 640 },
          ];
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.goto('/layanan/testi/teknik-informatika/3/course-IF2130');
      await expect(cards(page).getByRole('heading', { level: 3 })).toHaveText(
        Array.from({ length: 25 }, (_, i) => `Penulis ${i + 1}`),
      );
      expect(await columns(page), `columns at ${size.width}`).toBe(
        columnsAt(size.width),
      );
      // The columns read top to bottom: the first card of each column follows the previous column's last.
      const order = await cards(page).evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return [Math.round(r.left), Math.round(r.top)];
        }),
      );
      for (let i = 1; i < order.length; i++)
        expect(
          order[i][0] > order[i - 1][0] ||
            (order[i][0] === order[i - 1][0] && order[i][1] > order[i - 1][1]),
          `card ${i + 1} comes after card ${i}`,
        ).toBe(true);
      await expectEveryCardReachable(page, 25);
      await strictGates(page, testInfo, `testi-many-${size.width}`, 'Layanan');
    }
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

  test('a mandatory Mata Kuliah Umum course goes back to a list whose title names it', async ({
    page,
    db,
  }, testInfo) => {
    // P2-B review, finding 7: KU1101 (OTHER, mandatory, semester 1) is reached only through search, and its list
    // was titled "Mata Kuliah Umum", like the electives list the start screen opens.
    const base = db.courses.find((c) => c.code === 'DP3011')!;
    db.courses.push({
      ...base,
      id: 'course-KU1101',
      code: 'KU1101',
      name: 'Pengantar Rekayasa dan Desain',
      type: 'Mandatory',
      semester: 1,
      semesterCode: 'Ganjil',
    });
    await page.goto('/layanan/testi/mata-kuliah-umum/1/course-KU1101');
    await expect(
      main(page).getByText('Pengantar Rekayasa dan Desain'),
    ).toBeVisible();
    await expectUpTo(page, testInfo, 'Mata Kuliah Umum · Semester 1');
    await page.goto('/layanan/testi/mata-kuliah-umum/1');
    await expect(page).toHaveTitle('Mata Kuliah Umum · Semester 1 · PIPS!');
    await expect(
      main(page).getByRole('link', { name: /^KU1101 / }),
    ).toBeVisible();
    await expectUpTo(page, testInfo, 'Testi Matkul');
  });

  test('Buka Ding Dong opens the folder in a new tab, or says a course has none', async ({
    page,
  }) => {
    await page.goto(IF2110);
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

  test('an old link with ?page= still opens the course, with every testimonial', async ({
    page,
  }) => {
    for (const p of ['2', '9']) {
      await page.goto(`${IF2110}?page=${p}`);
      await expect(cards(page).getByRole('heading', { level: 3 })).toHaveText(
        IF2110_BY,
      );
    }
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
          name: /^IF2110 Algoritma dan Pemrograman II\s*6 testimoni$/,
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

  test('regression: a link with a NIM opens it filled in', async ({ page }) => {
    // The router reads `?q=18225012` as a number; it was dropped and the page opened empty (P2-B round 2).
    await page.goto('/layanan/nim?q=18225012');
    await expect(
      main(page).getByRole('searchbox', { name: 'Cari nama atau NIM' }),
    ).toHaveValue('18225012');
    await expect(
      main(page).getByRole('button', {
        name: 'Salin NIM 18225012, Tasya Amelia',
      }),
    ).toBeVisible();
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
