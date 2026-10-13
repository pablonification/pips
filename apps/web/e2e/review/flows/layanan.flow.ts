/** Layanan and its services (P1-C, P2-B): layanan, dingdong, testi-browse, testi-search, nim-finder, info-lomba. */
import type { Page } from '@playwright/test';
import type { Competition } from '../../../src/api/generated';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');
const row = (page: Page, name: RegExp) =>
  main(page).getByRole('link', { name });
const groupTitles = (page: Page) =>
  main(page).getByRole('heading', { level: 2 }).allTextContents();
const courseRows = (page: Page) =>
  main(page).getByRole('link', { name: /^[A-Z]{2}\d{4} / });
const article = (page: Page, i: number, n: number) =>
  main(page).getByRole('article', { name: `Testimoni ${i} dari ${n}` });

/** Stand in for other sites, so a new tab never leaves this machine. */
async function stubOutside(page: Page, pattern: string, title: string) {
  await page.context().route(pattern, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<title>${title}</title><p>${title}</p>`,
    }),
  );
}

flow('layanan', 'nadia', {}, async ({ page, f }) => {
  await f.step('Four groups, members’ names, one line each', async () => {
    await f.open('/layanan');
    await expect
      .poll(() => groupTitles(page))
      .toEqual(['Kuliah', 'Teman dan himpunan', 'Kesempatan', 'Administrasi']);
    await expect(row(page, /^Ding Dong/)).toContainText(
      'Folder materi mata kuliahmu semester ini',
    );
    await expect(main(page).getByText('Kelola')).toHaveCount(0);
    await f.gate('layanan-nadia');
  });
  await f.step('Badges: Curhat’s new message, Form’s open form', async () => {
    await expect(row(page, /^Curhat Yuk!/)).toHaveAccessibleName(
      /1 pesan baru/,
    );
    await expect(row(page, /^Form/)).toContainText('1 belum diisi');
    await f.hold();
  });
  await f.step(
    'External services are marked and open in a new tab; PIPS! stays',
    async () => {
      const beasiswa = row(page, /^Beasiswa/);
      await beasiswa.scrollIntoViewIfNeeded();
      await expect(beasiswa).toHaveAccessibleName(/\(situs luar, tab baru\)$/);
      await expect(beasiswa).toHaveAttribute(
        'href',
        'https://s.hmif.dev/MadingBeasiswa',
      );
      await stubOutside(page, 'https://s.hmif.dev/**', 'Mading Beasiswa');
      const [tab] = await Promise.all([
        page.context().waitForEvent('page'),
        beasiswa.click(),
      ]);
      await expect(tab).toHaveURL('https://s.hmif.dev/MadingBeasiswa');
      await tab.close();
      await expect(page).toHaveURL(/\/layanan$/);
      await f.hold();
    },
  );
});

flow('layanan', 'raka', { push: 'on' }, async ({ page, f }) => {
  await f.step(
    'Raka’s Layanan: Kelola last, with his three tools',
    async () => {
      await f.open('/layanan');
      await expect
        .poll(() => groupTitles(page))
        .toEqual([
          'Kuliah',
          'Teman dan himpunan',
          'Kesempatan',
          'Administrasi',
          'Kelola',
        ]);
      const kelola = main(page).getByRole('heading', {
        level: 2,
        name: 'Kelola',
      });
      await kelola.scrollIntoViewIfNeeded();
      expect(
        (await main(page).locator('.g-svc-row .t-sub').allTextContents()).slice(
          -3,
        ),
      ).toEqual([
        'Live Counting & Rekap Form',
        'Data SPARTA Magang',
        'Tambah acara Akademik',
      ]);
      await f.gate('layanan-raka');
      await f.hold();
    },
  );
});

flow('dingdong', 'nadia', {}, async ({ page, f, db }) => {
  const folders = main(page).getByRole('link', {
    name: /\(situs luar, tab baru\)$/,
  });
  const if4010 = db.courses.find((c) => c.code === 'IF4010')!;
  db.myCourses = [
    ...db.myCourses,
    { ...db.myCourses[0], courseId: if4010.id, course: if4010 },
  ];
  await f.step('Nadia’s courses this semester, with full names', async () => {
    await f.open('/layanan/dingdong');
    await expect(folders).toHaveCount(6);
    await expect(
      main(page).getByRole('link', {
        name: /^IF2110\s*Algoritma dan Pemrograman II\s*\(situs luar, tab baru\)$/,
      }),
    ).toBeVisible();
    await f.gate('dingdong');
  });
  await f.step('A folder opens Google Drive in a new tab', async () => {
    await stubOutside(page, 'https://drive.google.com/**', 'Google Drive');
    const [tab] = await Promise.all([
      page.context().waitForEvent('page'),
      main(page)
        .getByRole('link', { name: /^IF2110/ })
        .click(),
    ]);
    await expect(tab).toHaveURL(
      'https://drive.google.com/drive/folders/e2e-IF2110',
    );
    await tab.close();
    await expect(page).toHaveURL(/\/layanan\/dingdong$/);
  });
  await f.step('IF4010: "Belum ada folder", and a toast says so', async () => {
    const r = main(page).getByRole('button', { name: /^IF4010/ });
    await r.scrollIntoViewIfNeeded();
    await expect(r).toContainText('Belum ada folder');
    await r.click({ force: true });
    await expect(
      page.getByText('Folder Ding Dong untuk IF4010 belum tersedia.'),
    ).toBeVisible();
    await f.hold();
  });
  await f.step('With no courses: Atur mata kuliah', async () => {
    db.myCourses = [];
    await page.reload();
    await expect(main(page).getByText('Belum ada mata kuliah')).toBeVisible();
    await f.gate('dingdong-empty');
    await f.hold();
    await main(page).getByRole('link', { name: 'Atur mata kuliah' }).click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await f.hold();
  });
});

flow('testi-browse', 'nadia', {}, async ({ page, f }) => {
  await f.step('Testi Matkul: Teknik Informatika', async () => {
    await f.open('/layanan/testi');
    await f.gate('testi-start');
    await main(page).getByRole('link', { name: 'Teknik Informatika' }).click();
    await expect(page).toHaveURL(/\/layanan\/testi\/teknik-informatika$/);
  });
  await f.step('Semester 3: each course with its count', async () => {
    await main(page).getByRole('link', { name: 'Semester 3' }).click();
    await expect(page).toHaveTitle('IF · Semester 3 · PIPS!');
    await expect(
      main(page).getByRole('link', {
        name: /^IF2110 Algoritma dan Pemrograman II\s*3 testimoni$/,
      }),
    ).toBeVisible();
    await expect(courseRows(page)).toHaveCount(6);
    await f.gate('testi-list');
  });
  await f.step('IF2110: Overview, Tugas, Review Dosen, 1 / 3', async () => {
    await main(page)
      .getByRole('link', { name: /^IF2110 / })
      .click();
    await expect(article(page, 1, 3)).toBeVisible();
    await expect(
      article(page, 1, 3).getByRole('heading', { level: 3 }),
    ).toHaveText(['Overview', 'Tugas', 'Review Dosen']);
    await expect(main(page).getByText('1 / 3')).toBeVisible();
    await f.gate('testi-course');
  });
  await f.step('The pager: 2 / 3', async () => {
    await main(page)
      .getByRole('button', { name: 'Testimoni berikutnya' })
      .click();
    await expect(article(page, 2, 3)).toBeVisible();
    await expect(main(page).getByText('2 / 3')).toBeVisible();
    await f.hold();
  });
  await f.step('Buka Ding Dong', async () => {
    const folder = main(page).getByRole('link', {
      name: 'Buka Ding Dong IF2110 (situs luar, tab baru)',
    });
    await folder.scrollIntoViewIfNeeded();
    await expect(folder).toHaveAttribute('target', '_blank');
    await f.hold();
  });
  await f.step('An STI course: Kesan, Tantangan, Saran (II2110)', async () => {
    await page.goto(
      '/layanan/testi/sistem-dan-teknologi-informasi/3/course-II2110',
    );
    await expect(
      main(page)
        .getByRole('article', { name: /^Testimoni 1 dari/ })
        .getByRole('heading', { level: 3 }),
    ).toHaveText(['Kesan', 'Tantangan', 'Saran']);
    await f.hold();
  });
  await f.step('A course with none (IF2120): the Akademik note', async () => {
    await page.goto('/layanan/testi/teknik-informatika/3/course-IF2120');
    await expect(main(page).getByText('Belum ada testimoni')).toBeVisible();
    await expect(
      main(page).getByText(
        'Testimoni dikumpulkan divisi Akademik tiap akhir semester.',
      ),
    ).toBeVisible();
    await f.gate('testi-course-empty');
    await f.hold();
  });
});

flow('testi-search', 'nadia', {}, async ({ page, f }) => {
  const box = main(page).getByRole('searchbox', { name: 'Cari mata kuliah' });
  await f.step(
    '"if2110" from the start finds IF2110 (today’s app couldn’t)',
    async () => {
      await f.open('/layanan/testi');
      await f.type(box, 'if2110');
      await expect(main(page).getByRole('status')).toHaveText('1 mata kuliah');
      await expect(
        main(page).getByRole('link', {
          name: /^IF2110 Algoritma dan Pemrograman II\s*3 testimoni$/,
        }),
      ).toBeVisible();
      await f.gate('testi-search');
      await f.hold();
    },
  );
  await f.step('Inside a course list: "sistem"', async () => {
    await page.goto('/layanan/testi/teknik-informatika/3');
    await f.type(box, 'sistem');
    await expect(courseRows(page)).toHaveCount(1);
    await expect(page).toHaveURL(/\?q=sistem$/);
    await f.hold();
  });
  await f.step('No match says so', async () => {
    await f.type(box, 'zzz');
    await expect(
      main(page).getByText('Coba kata lain atau semester lain.'),
    ).toBeVisible();
    await f.gate('testi-search-empty');
    await f.hold();
  });
});

flow('nim-finder', 'nadia', {}, async ({ page, f }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const box = main(page).getByRole('searchbox', { name: 'Cari nama atau NIM' });
  const status = main(page).getByRole('status');
  await f.step('Under 3 characters nothing is searched', async () => {
    await f.open('/layanan/nim');
    await expect(status).toHaveText(
      'Ketik minimal 3 huruf nama atau angka NIM.',
    );
    await f.type(box, 'ra');
    await expect(status).toHaveText(
      'Ketik minimal 3 huruf nama atau angka NIM.',
    );
    await f.gate('nim-start');
  });
  await f.step('"rak": 2 results', async () => {
    await f.type(box, 'rak');
    await expect(status).toHaveText('2 hasil. Pilih untuk menyalin NIM.');
    await expect(
      main(page).getByRole('button', { name: /^Salin NIM / }),
    ).toHaveCount(2);
    await f.gate('nim');
    await f.hold();
  });
  await f.step('An exact NIM comes first', async () => {
    await f.type(box, '13524087');
    await expect(
      main(page)
        .getByRole('button', { name: /^Salin NIM / })
        .first(),
    ).toHaveAccessibleName(/^Salin NIM 13524087, Raka Pratama/);
    await f.hold();
  });
  await f.step('Copying a NIM: the toast', async () => {
    await main(page)
      .getByRole('button', { name: /^Salin NIM 13524087/ })
      .click();
    await expect(page.getByText('NIM 13524087 disalin.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      '13524087',
    );
    await f.hold();
  });
  await f.step('No match says so', async () => {
    await f.type(box, 'Zzzz');
    await expect(status).toHaveText(
      'Tidak ada anggota dengan nama atau NIM “Zzzz”.',
    );
    await f.gate('nim-empty');
    await f.hold();
  });
});

flow('info-lomba', 'nadia', {}, async ({ page, f, db }) => {
  // 12 competitions (the brief's override): today's four, one closing within 3 days, and seven later ones.
  // Free ones, so "Rp150.000" stays Find IT!'s alone.
  const base = db.competitions.find((c) => !c.price) ?? db.competitions[0];
  const extra = (id: string, name: string, close: string): Competition => ({
    ...base,
    id,
    name,
    registrationDeadline: close,
    registrationUrl: `https://example.org/e2e/${id}/daftar`,
    sourceUrl: `https://example.org/e2e/${id}`,
    medias: [],
  });
  db.competitions = [
    ...db.competitions,
    extra('s1', 'Lomba Segera', '2026-10-11T16:59:00Z'),
    ...Array.from({ length: 7 }, (_, i) =>
      extra(
        `m${i + 1}`,
        `Lomba ${String(i + 1).padStart(2, '0')}`,
        `2026-11-${String(i + 1).padStart(2, '0')}T16:59:00Z`,
      ),
    ),
  ];
  const names = () =>
    main(page).getByRole('heading', { level: 2 }).allTextContents();
  await f.step(
    'Soonest deadline first; within 3 days the line turns red',
    async () => {
      await f.open('/layanan/lomba');
      await expect.poll(async () => (await names()).length).toBe(10);
      expect((await names())[0]).toBe('Lomba Segera');
      await expect(main(page).getByText('Tutup Min 11 Okt, 23.59')).toHaveClass(
        /\burgent\b/,
      );
      await f.gate('lomba');
      await f.hold();
    },
  );
  await f.step('The fee: "Gratis" and "Rp150.000"', async () => {
    const paid = main(page).getByText('Rp150.000').first();
    await paid.scrollIntoViewIfNeeded();
    await expect(paid).toBeVisible();
    await expect(main(page).getByText('Gratis').first()).toBeVisible();
    await f.hold();
  });
  await f.step('Daftar and Sumber open in a new tab', async () => {
    const daftar = main(page).getByRole('link', {
      name: 'Daftar COMPFEST 18: Capture The Flag (situs luar, tab baru)',
    });
    await expect(daftar).toHaveAttribute('target', '_blank');
    await expect(
      main(page).getByRole('link', {
        name: 'Sumber Gemastik XIX (situs luar, tab baru)',
      }),
    ).toHaveAttribute('target', '_blank');
    await stubOutside(page, 'https://example.org/**', 'Pendaftaran');
    const [tab] = await Promise.all([
      page.context().waitForEvent('page'),
      daftar.click(),
    ]);
    await expect(tab).toHaveURL('https://example.org/e2e/l2/daftar');
    await tab.close();
  });
  await f.step('Scrolling to the end loads the second page', async () => {
    const more = main(page).getByRole('button', { name: 'Muat lagi' });
    await more.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await names()).length).toBe(12);
    await expect(more).toHaveCount(0);
    await f.hold();
  });
  await f.step('Muat lagi does the same, from the keyboard', async () => {
    // Nothing loads by itself now: only the button can.
    await page.addInitScript(() => {
      window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;
    });
    await page.reload();
    await expect.poll(async () => (await names()).length).toBe(10);
    const more = main(page).getByRole('button', { name: 'Muat lagi' });
    await more.focus();
    await f.hold();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await names()).length).toBe(12);
    await expect(
      main(page).getByRole('heading', { level: 2, name: (await names())[10] }),
    ).toBeFocused();
    await f.hold();
  });
});
