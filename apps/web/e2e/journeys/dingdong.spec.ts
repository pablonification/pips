/**
 * Ding Dong (P2-B): this semester's course folders. Phone, tablet and desktop, light and dark, with strict gates.
 */
import type { Page, TestInfo } from '@playwright/test';
import { layoutOf } from '../support/app';
import { reply } from '../support/mock';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const folders = (page: Page) =>
  main(page).getByRole('link', { name: /\(situs luar, tab baru\)$/ });

/** The page's name where the layout shows it: the top bar (with back) on touch, the head and trail on desktop. */
async function expectPlace(page: Page, testInfo: TestInfo) {
  await expect(page).toHaveTitle('Ding Dong · PIPS!');
  if (layoutOf(testInfo) === 'desktop') {
    const crumbs = page.getByRole('navigation', { name: 'Jejak halaman' });
    await expect(crumbs.getByRole('link', { name: 'Layanan' })).toBeVisible();
    await expect(crumbs.getByText('Ding Dong')).toHaveAttribute(
      'aria-current',
      'page',
    );
  } else {
    await expect(
      page.getByRole('button', { name: 'Kembali ke Layanan' }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole('heading', { name: 'Ding Dong', level: 1 }),
  ).toBeVisible();
}

test.describe('Ding Dong', () => {
  test('lists this semester’s course folders, each opening Google Drive in a new tab', async ({
    page,
    db,
  }, testInfo) => {
    await page.goto('/layanan/dingdong');
    await expect(
      main(page).getByText(
        'Folder Google Drive berisi materi, soal, dan catatan untuk mata kuliah yang kamu atur semester ini.',
      ),
    ).toBeVisible();
    await expect(folders(page)).toHaveCount(6);
    // In code order, each named by its code and full name, then where it leads.
    const names = await folders(page).evaluateAll((els) =>
      els.map((e) => e.textContent?.replace(/\s+/g, ' ').trim()),
    );
    expect(names.map((n) => n?.slice(0, 6))).toEqual([
      'IF2110',
      'IF2120',
      'IF2123',
      'IF2130',
      'IF2150',
      'IF2180',
    ]);
    const if2110 = main(page).getByRole('link', {
      name: /^IF2110\s*Algoritma dan Pemrograman II\s*\(situs luar, tab baru\)$/,
    });
    await expect(if2110).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/e2e-IF2110',
    );
    await expect(if2110).toHaveAttribute('target', '_blank');
    await expect(if2110).toHaveAttribute('rel', /noopener/);
    // Atur mata kuliah is a link to Mata kuliahku.
    await expect(
      main(page).getByRole('link', { name: 'Atur mata kuliah' }),
    ).toHaveAttribute('href', '/profil/matkul');
    // Today's header (name, email, semester) and desktop schedule column are gone.
    await expect(main(page)).not.toContainText(db.me!.email);
    await expectPlace(page, testInfo);
    await strictGates(page, testInfo, 'dingdong', 'Layanan');
  });

  test('a course without a folder stays in the list, says so, and explains when chosen', async ({
    page,
    db,
  }) => {
    const if4010 = db.courses.find((c) => c.code === 'IF4010')!;
    expect(if4010.dingdongUrl).toBeNull();
    db.myCourses = [
      ...db.myCourses,
      { ...db.myCourses[0], courseId: if4010.id, course: if4010 },
    ];
    await page.goto('/layanan/dingdong');
    const row = main(page).getByRole('button', { name: /^IF4010/ });
    await expect(row).toHaveAttribute('aria-disabled', 'true');
    await expect(row).toContainText('Belum ada folder');
    await expect(folders(page)).toHaveCount(6);
    // aria-disabled, not disabled: it still answers, so the member learns why (Playwright needs `force`).
    await row.click({ force: true });
    await expect(
      page.getByText('Folder Ding Dong untuk IF4010 belum tersedia.'),
    ).toBeVisible();
    // It stays focusable, so the keyboard reaches it too.
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('Folder Ding Dong untuk IF4010 belum tersedia.'),
    ).toHaveCount(2);
  });

  test('no courses yet: the title alone, and the gold Atur mata kuliah leads to Mata kuliahku', async ({
    page,
    db,
  }, testInfo) => {
    db.myCourses = [];
    await page.goto('/layanan/dingdong');
    await expect(main(page).getByText('Belum ada mata kuliah')).toBeVisible();
    // One way to set them, not two: the text link under the list isn't shown.
    const atur = main(page).getByRole('link', { name: 'Atur mata kuliah' });
    await expect(atur).toHaveCount(1);
    await strictAudit(page, testInfo, 'dingdong-empty');
    await atur.click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
  });

  test('loading shows rows being loaded', async ({ page, api }) => {
    api.on('GET /api/course/take/current', reply.hang());
    await page.goto('/layanan/dingdong');
    await expect(
      main(page).getByRole('status', { name: 'Memuat mata kuliahmu…' }),
    ).toBeVisible();
    await expect(folders(page)).toHaveCount(0);
  });

  test('a 503 says what failed, without the API’s text, and Coba lagi recovers', async ({
    page,
    api,
    db,
  }, testInfo) => {
    let fail = true;
    api.on('GET /api/course/take/current', () =>
      fail ? reply.status(503) : db.myCourses,
    );
    await page.goto('/layanan/dingdong');
    await expect(
      main(page).getByText('Mata kuliahmu gagal dimuat.'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(main(page)).not.toContainText('503');
    await strictAudit(page, testInfo, 'dingdong-error');
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(folders(page)).toHaveCount(6);
  });

  test('offline: the kept list under the offline banner', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/layanan/dingdong');
    await expect(folders(page)).toHaveCount(6);
    await page.waitForLoadState('networkidle');
    await api.setOffline(true);
    await expect(
      main(page).getByText(/^Offline · diperbarui \d{2}\.\d{2}$/),
    ).toBeVisible();
    await expect(folders(page)).toHaveCount(6);
    await strictAudit(page, testInfo, 'dingdong-offline');
    await api.setOffline(false);
    await expect(main(page).getByText(/^Offline/)).toHaveCount(0);
  });
});
