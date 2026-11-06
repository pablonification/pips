/**
 * Profil › Mata kuliahku and Tambah mata kuliah (P1-C): the list and Jumlah SKS, removing with Urungkan, the empty,
 * error and offline states, searching the catalogue, picking courses (one toggle per row; Garis v5 has no class) and
 * adding them.
 */
import type { Page } from '@playwright/test';
import { layoutOf } from '../support/app';
import { reply } from '../support/mock';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const main = (page: Page) => page.getByRole('main');
const toastText = (page: Page, text: string) =>
  page.locator('.g-toast').filter({ hasText: text });
const removeBtn = (page: Page, code: string) =>
  main(page).getByRole('button', { name: new RegExp(`^Hapus ${code} `) });
const codes = (page: Page) =>
  main(page)
    .locator('.g-course .code')
    .evaluateAll((els) => els.map((e) => e.textContent?.trim()));
const sks = (page: Page) => main(page).locator('.g-sum-row .num').textContent();
/** Tambahkan: the top bar on phones and tablets, the page head on desktop. */
const addButton = (page: Page) =>
  page.getByRole('button', { name: /^Tambahkan/ }).locator('visible=true');
const search = (page: Page) =>
  main(page).getByRole('searchbox', { name: 'Cari mata kuliah' });
/** A catalogue row: one toggle button named by its code and name (no class picker in v5). */
const row = (page: Page, code: string) =>
  main(page).getByRole('button', { name: new RegExp(`^${code} `) });
/** Nothing about a class anywhere on the page (Garis v5). */
async function noClass(page: Page) {
  await expect(main(page).getByText(/\bKelas\b/)).toHaveCount(0);
  await expect(main(page).getByText(/^K[123]$/)).toHaveCount(0);
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
}

test.describe('Mata kuliahku', () => {
  test('the semester, the list and Jumlah SKS 18; Dipakai untuk apa? folded', async ({
    page,
  }, testInfo) => {
    await page.goto('/profil/matkul');
    await expect(
      main(page).getByText('Semester 3 · Ganjil 2026/2027'),
    ).toBeVisible();
    await expect
      .poll(() => codes(page))
      .toEqual(['IF2110', 'IF2120', 'IF2123', 'IF2130', 'IF2150', 'IF2180']);
    await expect(
      main(page).getByText('Algoritma dan Pemrograman II'),
    ).toBeVisible();
    // v5: no "Kelas 0x" pill on a course row.
    await noClass(page);
    expect(await sks(page)).toBe('18');
    const why = main(page).locator('details');
    await expect(why).not.toHaveAttribute('open', '');
    await why.getByText('Dipakai untuk apa?').click();
    await expect(
      main(page).getByText(
        'Mata kuliah menentukan isi Ding Dong, acara Akademik di Kalender beserta pengingat H-1, dan notifikasi pengumuman untuk mata kuliahmu. Atur ulang tiap semester.',
      ),
    ).toBeVisible();
    await expect(page).toHaveTitle('Mata kuliahku · PIPS!');
    await strictGates(page, testInfo, 'matkul', 'Profil');
  });

  test('remove IF2180 → 5 courses and 16 SKS at once → Urungkan puts it back, with the class it had', async ({
    page,
    api,
    db,
  }) => {
    // A row added before v5 still has its class on the server: Urungkan keeps it.
    db.myCourses.find((c) => c.courseId === 'course-IF2180')!.class = 3;
    api.on('DELETE /api/course/take/batch', writes.dropCourses);
    api.on('PUT /api/course/take/batch', writes.takeCourses);
    await page.goto('/profil/matkul');
    await removeBtn(page, 'IF2180').click();
    await expect.poll(() => codes(page)).not.toContain('IF2180');
    expect(await sks(page)).toBe('16');
    // IF2180 was the last row: focus moves to Tambah mata kuliah, as the prototype's `rm-course` (review m1).
    await expect(
      main(page).getByRole('link', { name: 'Tambah mata kuliah' }),
    ).toBeFocused();
    const toast = toastText(page, 'IF2180 dihapus dari mata kuliahmu.');
    await expect(toast).toBeVisible();
    expect(api.calls('DELETE /api/course/take/batch')[0].body).toEqual({
      courseIds: ['course-IF2180'],
    });

    await toast.getByRole('button', { name: 'Urungkan' }).click();
    await expect.poll(() => codes(page)).toContain('IF2180');
    expect(await sks(page)).toBe('18');
    expect(api.calls('PUT /api/course/take/batch')[0].body).toEqual([
      { courseId: 'course-IF2180', class: 3 },
    ]);
  });

  test('removing the middle course focuses the next one', async ({
    page,
    api,
  }) => {
    api.on('DELETE /api/course/take/batch', writes.dropCourses);
    await page.goto('/profil/matkul');
    await removeBtn(page, 'IF2123').click();
    await expect(removeBtn(page, 'IF2130')).toBeFocused();
  });

  test('a failed remove puts the row back and says so', async ({
    page,
    api,
  }) => {
    api.on('DELETE /api/course/take/batch', reply.status(500));
    await page.goto('/profil/matkul');
    await removeBtn(page, 'IF2120').click();
    await expect(
      toastText(
        page,
        'IF2120 gagal dihapus. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect.poll(() => codes(page)).toContain('IF2120');
    expect(await sks(page)).toBe('18');
  });

  test('regression: a failed remove brings back only its own row, not one removed meanwhile', async ({
    page,
    api,
    db,
  }) => {
    let failIF2120!: () => void;
    const held = new Promise<void>((r) => (failIF2120 = r));
    api.on('DELETE /api/course/take/batch', async (req) => {
      const { courseIds } = req.body as { courseIds: string[] };
      if (courseIds.includes('course-IF2120')) {
        await held;
        return reply.status(500);
      }
      return writes.dropCourses(req);
    });
    await page.goto('/profil/matkul');
    await removeBtn(page, 'IF2120').click();
    await removeBtn(page, 'IF2150').click();
    await expect
      .poll(() => api.calls('DELETE /api/course/take/batch').length)
      .toBe(2);
    // IF2150's removal is done on the server before IF2120's fails.
    await expect
      .poll(() => db.myCourses.map((c) => c.courseId))
      .not.toContain('course-IF2150');
    await expect.poll(() => codes(page)).not.toContain('IF2120');
    failIF2120();
    await expect(
      toastText(
        page,
        'IF2120 gagal dihapus. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect.poll(() => codes(page)).toContain('IF2120');
    await expect
      .poll(() => codes(page))
      .toEqual(['IF2110', 'IF2120', 'IF2123', 'IF2130', 'IF2180']);
    expect(await sks(page)).toBe('14');
  });

  test('regression: the toast with Urungkan shows before the server answers; Urungkan then waits for the removal', async ({
    page,
    api,
  }) => {
    let answer!: () => void;
    const held = new Promise<void>((r) => (answer = r));
    api.on('DELETE /api/course/take/batch', async (req) => {
      await held;
      return writes.dropCourses(req);
    });
    api.on('PUT /api/course/take/batch', writes.takeCourses);
    await page.goto('/profil/matkul');
    await removeBtn(page, 'IF2130').click();
    const toast = toastText(page, 'IF2130 dihapus dari mata kuliahmu.');
    await expect(toast).toBeVisible();
    expect(api.calls('DELETE /api/course/take/batch')).toHaveLength(1);
    await toast.getByRole('button', { name: 'Urungkan' }).click();
    await expect.poll(() => codes(page)).toContain('IF2130');
    // Nothing is put back on the server until the removal has answered.
    await page.waitForTimeout(300);
    expect(api.calls('PUT /api/course/take/batch')).toHaveLength(0);
    answer();
    await expect
      .poll(() => api.calls('PUT /api/course/take/batch').map((c) => c.body))
      .toEqual([[{ courseId: 'course-IF2130', class: 1 }]]);
    await expect.poll(() => codes(page)).toContain('IF2130');
    expect(await sks(page)).toBe('18');
  });

  test('regression: when a removal fails after its toast showed, the error toast replaces it', async ({
    page,
    api,
  }) => {
    let answer!: () => void;
    const held = new Promise<void>((r) => (answer = r));
    api.on('DELETE /api/course/take/batch', async () => {
      await held;
      return reply.status(500);
    });
    await page.goto('/profil/matkul');
    await removeBtn(page, 'IF2130').click();
    const toast = toastText(page, 'IF2130 dihapus dari mata kuliahmu.');
    await expect(toast).toBeVisible();
    answer();
    await expect(
      toastText(
        page,
        'IF2130 gagal dihapus. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect(toast).toHaveCount(0);
    await expect.poll(() => codes(page)).toContain('IF2130');
    expect(api.calls('PUT /api/course/take/batch')).toHaveLength(0);
  });

  test('no courses: the empty state with the explanation open', async ({
    page,
    db,
  }, testInfo) => {
    db.myCourses = [];
    await page.goto('/profil/matkul');
    await expect(
      main(page).getByText('Belum ada mata kuliah semester ini'),
    ).toBeVisible();
    await expect(main(page).locator('details')).toHaveAttribute('open', '');
    await expect(
      main(page).getByText(/^Mata kuliah menentukan isi Ding Dong/),
    ).toBeVisible();
    await expect(main(page).getByText('Jumlah SKS')).toHaveCount(0);
    await expect(
      main(page).getByRole('link', { name: 'Tambah mata kuliah' }),
    ).toBeVisible();
    await strictAudit(page, testInfo, 'matkul-empty');
  });

  test('removing the last course empties the list, opens the explanation and focuses Tambah mata kuliah', async ({
    page,
    api,
    db,
  }) => {
    db.myCourses = db.myCourses.slice(0, 1);
    api.on('DELETE /api/course/take/batch', writes.dropCourses);
    await page.goto('/profil/matkul');
    await removeBtn(page, 'IF2110').click();
    await expect(
      main(page).getByText('Belum ada mata kuliah semester ini'),
    ).toBeVisible();
    await expect(
      main(page).getByRole('link', { name: 'Tambah mata kuliah' }),
    ).toBeFocused();
  });

  test('a 503 says so with Coba lagi, which recovers', async ({
    page,
    api,
    db,
  }, testInfo) => {
    let fail = true;
    api.on('GET /api/course/take/current', () =>
      fail ? reply.status(503) : db.myCourses,
    );
    await page.goto('/profil/matkul');
    await expect(
      main(page).getByText('Mata kuliahmu gagal dimuat.'),
    ).toBeVisible({
      timeout: 15_000,
    });
    // Never the API's own text.
    await expect(main(page)).not.toContainText('e2e: HTTP 503');
    await strictAudit(page, testInfo, 'matkul-error');
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect.poll(() => codes(page)).toHaveLength(6);
  });

  test('offline: the kept list under the offline banner', async ({
    page,
    api,
  }) => {
    await page.goto('/profil/matkul');
    await expect.poll(() => codes(page)).toHaveLength(6);
    await page.waitForLoadState('networkidle');
    await api.setOffline(true);
    await expect(main(page).getByText(/^Offline · diperbarui/)).toBeVisible();
    await expect.poll(() => codes(page)).toHaveLength(6);
    await api.setOffline(false);
  });

  test('Tambah mata kuliah opens the catalogue', async ({ page }) => {
    await page.goto('/profil/matkul');
    await main(page).getByRole('link', { name: 'Tambah mata kuliah' }).click();
    await expect(page).toHaveURL(/\/profil\/matkul\/tambah$/);
    await expect(search(page)).toBeVisible();
  });
});

test.describe('Tambah mata kuliah', () => {
  test('“IF2211”, tap its row → Tambahkan (1) → back with 7 courses, 21 SKS and the toast; no class sent', async ({
    page,
    api,
  }, testInfo) => {
    api.on('PUT /api/course/take/batch', writes.takeCourses);
    await page.goto('/profil/matkul');
    await main(page).getByRole('link', { name: 'Tambah mata kuliah' }).click();
    await expect(search(page)).toHaveAttribute(
      'placeholder',
      'Cari kode atau nama, misalnya IF2211',
    );
    // This semester's courses aren't offered.
    await expect(row(page, 'IF2180')).toHaveCount(0);
    await noClass(page);
    await search(page).fill('IF2211');
    await expect(main(page).getByText('Strategi Algoritma')).toBeVisible();
    await expect(main(page).locator('.g-course')).toHaveCount(1);
    await strictGates(page, testInfo, 'matkul-tambah', 'Profil');

    await expect(row(page, 'IF2211')).toHaveAttribute('aria-pressed', 'false');
    await row(page, 'IF2211').click();
    await expect(row(page, 'IF2211')).toHaveAttribute('aria-pressed', 'true');
    // Focus stays on the tapped row.
    await expect(row(page, 'IF2211')).toBeFocused();
    await noClass(page);
    await expect(addButton(page)).toHaveText(/Tambahkan \(1\)/);
    await expect(addButton(page)).not.toHaveAttribute('aria-disabled', 'true');
    // Desktop: in the page head; phones and tablets: in the top bar.
    if (layoutOf(testInfo) === 'desktop')
      await expect(
        main(page).getByRole('button', { name: /^Tambahkan/ }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole('banner').getByRole('button', { name: /^Tambahkan/ }),
      ).toBeVisible();
    await addButton(page).click();

    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await expect(
      toastText(
        page,
        '1 mata kuliah ditambahkan. Ding Dong dan Kalender ikut diperbarui.',
      ),
    ).toBeVisible();
    expect(api.calls('PUT /api/course/take/batch')[0].body).toEqual([
      { courseId: 'course-IF2211' },
    ]);
    await expect.poll(() => codes(page)).toHaveLength(7);
    await expect.poll(() => sks(page)).toBe('21');
    await noClass(page);
  });

  test.describe('on the real clock', () => {
    // Regression (2026-11-03, the real app on real data): the toast store called setTimeout as its own method, which
    // browsers refuse ("Illegal invocation"). Every success toast threw, so Tambahkan saved the courses but stayed on
    // "Menambahkan…" and never went back. The harness's fake clock hid it; these journeys run without it.
    test.use({ now: null });

    test('regression: Tambahkan saves, says so and goes back to Mata kuliahku', async ({
      page,
      api,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      api.on('PUT /api/course/take/batch', writes.takeCourses);
      await page.goto('/profil/matkul');
      await main(page)
        .getByRole('link', { name: 'Tambah mata kuliah' })
        .click();
      await search(page).fill('IF2211');
      await row(page, 'IF2211').click();
      await addButton(page).click();
      await expect(page).toHaveURL(/\/profil\/matkul$/);
      await expect(
        toastText(
          page,
          '1 mata kuliah ditambahkan. Ding Dong dan Kalender ikut diperbarui.',
        ),
      ).toBeVisible();
      await expect.poll(() => codes(page)).toHaveLength(7);
      expect(errors).toEqual([]);
    });

    test('regression: removing a course shows Urungkan, which puts it back', async ({
      page,
      api,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      api.on('DELETE /api/course/take/batch', writes.dropCourses);
      api.on('PUT /api/course/take/batch', writes.takeCourses);
      await page.goto('/profil/matkul');
      await removeBtn(page, 'IF2180').click();
      await expect.poll(() => codes(page)).toHaveLength(5);
      const undo = page
        .locator('.g-toast')
        .getByRole('button', { name: 'Urungkan' });
      await expect(undo).toBeVisible();
      await undo.click();
      await expect.poll(() => codes(page)).toHaveLength(6);
      expect(errors).toEqual([]);
    });
  });

  test('regression: Tambahkan goes back to Mata kuliahku, so Back then leaves for Profil, not an empty Tambah mata kuliah', async ({
    page,
    api,
  }, testInfo) => {
    api.on('PUT /api/course/take/batch', writes.takeCourses);
    await page.goto('/profil');
    await main(page)
      .getByRole('link', { name: /^Mata kuliahku/ })
      .click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await main(page).getByRole('link', { name: 'Tambah mata kuliah' }).click();
    await search(page).fill('IF2211');
    await row(page, 'IF2211').click();
    await addButton(page).click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await expect.poll(() => codes(page)).toHaveLength(7);
    if (layoutOf(testInfo) !== 'desktop')
      await expect(
        page.getByRole('banner').getByRole('button', { name: /^Kembali ke / }),
      ).toHaveAccessibleName('Kembali ke Profil');
    await page.goBack();
    await expect(page).toHaveURL(/\/profil$/);
  });

  test('regression: opened directly, Tambahkan replaces it with Mata kuliahku', async ({
    page,
    api,
  }, testInfo) => {
    api.on('PUT /api/course/take/batch', writes.takeCourses);
    await page.goto('/profil');
    await page.goto('/profil/matkul/tambah');
    await search(page).fill('IF2211');
    await row(page, 'IF2211').click();
    await addButton(page).click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await expect.poll(() => codes(page)).toHaveLength(7);
    if (layoutOf(testInfo) !== 'desktop')
      await expect(
        page.getByRole('banner').getByRole('button', { name: /^Kembali ke / }),
      ).toHaveAccessibleName('Kembali ke Profil');
    // The browser's back leaves Mata kuliahku for the page before Tambah mata kuliah.
    await page.goBack();
    await expect(page).toHaveURL(/\/profil$/);
  });

  test('tapping a picked row drops it; with no picks Tambahkan only says what to do', async ({
    page,
    api,
  }) => {
    await page.goto('/profil/matkul/tambah');
    await search(page).fill('IF2211');
    const pick = row(page, 'IF2211');
    await pick.click();
    await expect(addButton(page)).toHaveText(/\(1\)/);
    await pick.click();
    await expect(pick).toHaveAttribute('aria-pressed', 'false');
    await expect(pick).toBeFocused();
    await expect(addButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(addButton(page)).not.toHaveText(/\(/);
    // aria-disabled, not disabled: it still answers a press with the hint (Playwright waits for neither, so force).
    await addButton(page).click({ force: true });
    await expect(
      toastText(page, 'Pilih mata kuliah yang mau kamu tambahkan.'),
    ).toBeVisible();
    expect(api.writes).toEqual([]);
    await expect(page).toHaveURL(/\/profil\/matkul\/tambah$/);
  });

  test('no results says so with the words typed', async ({ page }) => {
    await page.goto('/profil/matkul/tambah');
    await search(page).fill('zzz');
    await expect(
      main(page).getByText('Tidak ada mata kuliah untuk “zzz”.'),
    ).toBeVisible();
  });

  test('regression: Enter neither reloads nor submits, and picks survive a new search', async ({
    page,
    api,
  }) => {
    await page.goto('/profil/matkul/tambah');
    await search(page).fill('IF2211');
    await row(page, 'IF2211').click();
    // A marker that a reload would wipe.
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });
    const navigations: string[] = [];
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) navigations.push(f.url());
    });
    await search(page).press('Enter');
    await search(page).fill('basis');
    await search(page).press('Enter');
    await expect(main(page).getByText('Sistem Basis Data')).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { __noReload?: boolean }).__noReload,
      ),
    ).toBe(true);
    expect(navigations).toEqual([]);
    expect(api.writes).toEqual([]);
    await expect(addButton(page)).toHaveText(/\(1\)/);
    await search(page).fill('IF2211');
    await expect(row(page, 'IF2211')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a failed add keeps the picks and says so', async ({ page, api }) => {
    api.on('PUT /api/course/take/batch', reply.status(500));
    await page.goto('/profil/matkul/tambah');
    await search(page).fill('IF2211');
    await row(page, 'IF2211').click();
    await addButton(page).click();
    await expect(
      toastText(
        page,
        'Mata kuliah gagal ditambahkan. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/profil\/matkul\/tambah$/);
    await expect(addButton(page)).toHaveText(/\(1\)/);
  });

  // Regression (web-robust 1): an add the API never answered stayed on "Menambahkan…" until the browser gave up.
  test('an add with no answer: after the time limit, the picks stay and it says so', async ({
    page,
    api,
  }) => {
    api.on('PUT /api/course/take/batch', reply.hang());
    await page.goto('/profil/matkul/tambah');
    await search(page).fill('IF2211');
    await row(page, 'IF2211').click();
    await addButton(page).click();
    await expect
      .poll(() => api.calls('PUT /api/course/take/batch').length)
      .toBe(1);
    await expect(
      page
        .getByRole('button', { name: 'Menambahkan…' })
        .locator('visible=true'),
    ).toBeVisible();
    await page.clock.runFor(26_000);
    await expect(
      toastText(
        page,
        'Mata kuliah gagal ditambahkan. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/profil\/matkul\/tambah$/);
    await expect(addButton(page)).toHaveText(/\(1\)/);
  });

  test('v5: remove, undo, then pick two by row (drop and pick again) → Tambahkan (2); Jumlah SKS follows; saved with no class', async ({
    page,
    api,
    db,
  }, testInfo) => {
    api.on('DELETE /api/course/take/batch', writes.dropCourses);
    api.on('PUT /api/course/take/batch', writes.takeCourses);
    await page.goto('/profil/matkul');
    await expect.poll(() => sks(page)).toBe('18');
    await removeBtn(page, 'IF2180').click();
    await expect.poll(() => sks(page)).toBe('16');
    await toastText(page, 'IF2180 dihapus dari mata kuliahmu.')
      .getByRole('button', { name: 'Urungkan' })
      .click();
    await expect.poll(() => sks(page)).toBe('18');
    await expect
      .poll(() => api.calls('PUT /api/course/take/batch').length)
      .toBe(1);

    await main(page).getByRole('link', { name: 'Tambah mata kuliah' }).click();
    await search(page).fill('IF22');
    await expect(row(page, 'IF2224')).toBeVisible();
    await noClass(page);
    // Each row is one toggle with a box at its end; a picked row's box shows the check.
    const box = (code: string) => row(page, code).locator('.g-pick-box');
    await expect(box('IF2211').locator('svg')).toHaveCount(1);
    expect(await box('IF2211').evaluate((e) => getComputedStyle(e).color)).toBe(
      'rgba(0, 0, 0, 0)',
    );
    await row(page, 'IF2211').click();
    await row(page, 'IF2224').click();
    await expect(addButton(page)).toHaveText(/Tambahkan \(2\)/);
    expect(
      await box('IF2211').evaluate((e) => getComputedStyle(e).color),
    ).not.toBe('rgba(0, 0, 0, 0)');
    await row(page, 'IF2211').click();
    await expect(addButton(page)).toHaveText(/Tambahkan \(1\)/);
    await row(page, 'IF2211').click();
    await expect(addButton(page)).toHaveText(/Tambahkan \(2\)/);
    await strictAudit(page, testInfo, 'matkul-tambah-picked');
    await addButton(page).click();

    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await expect(
      toastText(
        page,
        '2 mata kuliah ditambahkan. Ding Dong dan Kalender ikut diperbarui.',
      ),
    ).toBeVisible();
    expect(api.calls('PUT /api/course/take/batch')[1].body).toEqual([
      { courseId: 'course-IF2224' },
      { courseId: 'course-IF2211' },
    ]);
    // Stored with the API's default class; nothing shows it.
    expect(
      db.myCourses
        .filter((c) => ['course-IF2211', 'course-IF2224'].includes(c.courseId))
        .map((c) => c.class),
    ).toEqual([1, 1]);
    await expect.poll(() => codes(page)).toHaveLength(8);
    await expect.poll(() => sks(page)).toBe('25');
    await noClass(page);
  });

  test('a failed catalogue says so with Coba lagi, which recovers', async ({
    page,
    api,
    db,
  }) => {
    let fail = true;
    api.on('GET /api/course', () =>
      fail ? reply.status(500) : { courses: db.courses },
    );
    await page.goto('/profil/matkul/tambah');
    await expect(
      main(page).getByText('Daftar mata kuliah gagal dimuat.'),
    ).toBeVisible({ timeout: 15_000 });
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(main(page).getByText('Strategi Algoritma')).toBeVisible();
  });

  test('when your own courses failed to load too, Coba lagi reads both again and the list comes back', async ({
    page,
    api,
    db,
  }) => {
    // Regression: Coba lagi re-read only the catalogue, so a failed read of the member's courses kept the skeleton
    // up for good (found by qa/errors.spec.ts once it waited for loading to end, 2026-11-03).
    let fail = true;
    api.on('GET /api/course', () =>
      fail ? reply.status(500) : { courses: db.courses },
    );
    api.on('GET /api/course/take/current', () =>
      fail ? reply.status(500) : db.myCourses,
    );
    await page.goto('/profil/matkul/tambah');
    await expect(
      main(page).getByText('Daftar mata kuliah gagal dimuat.'),
    ).toBeVisible({ timeout: 15_000 });
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(main(page).getByText('Strategi Algoritma')).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Coba lagi' }),
    ).toHaveCount(0);
  });
});
