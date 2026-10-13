/**
 * Pasang PIPS! (P1-C; a toast in the prototype, built from Garis components): opened from Profil, it offers the way
 * this device installs PIPS!: Chrome's own prompt on Android, the steps on an iPhone, Chrome or Safari from LINE.
 */
import type { Page } from '@playwright/test';
import { installPrompts, stubInstallPrompt, UA } from '../support/device';
import { strictAudit } from '../support/strict';
import { expect, test } from '../support/test';

const sheet = (page: Page) =>
  page.getByRole('dialog', { name: 'Pasang PIPS!' });
const open = async (page: Page) => {
  await page.goto('/profil');
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Pasang PIPS!' })
    .click();
  await expect(sheet(page)).toBeVisible();
};

test.describe('Android Chrome', () => {
  test.use({ userAgent: UA.androidChrome, installed: false });

  test('Pasang PIPS! calls Chrome’s prompt, then says it is installed', async ({
    page,
    context,
  }, testInfo) => {
    await stubInstallPrompt(context, 'accepted');
    await open(page);
    await strictAudit(page, testInfo, 'pasang-android');
    await sheet(page).getByRole('button', { name: 'Pasang PIPS!' }).click();
    await expect(sheet(page)).toBeHidden();
    expect(await installPrompts(page)).toBe(1);
    await expect(
      page
        .locator('.g-toast')
        .filter({ hasText: 'PIPS! terpasang di perangkat ini.' }),
    ).toBeVisible();
    // Installed now: the sheet says so instead of offering it again.
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Pasang PIPS!' })
      .click();
    await expect(sheet(page)).toContainText(
      'PIPS! sudah terpasang di perangkat ini.',
    );
  });

  test('without Chrome’s prompt yet, it points to Chrome’s menu', async ({
    page,
  }) => {
    await open(page);
    await expect(sheet(page)).toContainText(
      'Buka menu Chrome di pojok kanan atas, lalu pilih Tambahkan ke layar utama.',
    );
    await expect(
      sheet(page).getByRole('button', { name: 'Pasang PIPS!' }),
    ).toHaveCount(0);
  });
});

test.describe('iPhone Safari', () => {
  test.use({ userAgent: UA.iphone, installed: false });

  test('the numbered steps Bagikan → Tambahkan ke Layar Utama', async ({
    page,
  }, testInfo) => {
    await open(page);
    const steps = sheet(page).getByRole('listitem');
    await expect(steps).toHaveText([
      '1. Ketuk Bagikan di bilah bawah Safari.',
      '2. Pilih Tambahkan ke Layar Utama.',
      '3. Ketuk Tambah, lalu buka PIPS! dari layar utama.',
    ]);
    await strictAudit(page, testInfo, 'pasang-iphone');
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(
      page.getByRole('main').getByRole('button', { name: 'Pasang PIPS!' }),
    ).toBeFocused();
  });
});

test.describe('LINE’s in-app browser', () => {
  test.use({ userAgent: UA.line, installed: false });

  test('says to open PIPS! in Chrome or Safari first', async ({
    page,
  }, testInfo) => {
    await open(page);
    await expect(sheet(page)).toContainText(
      'Browser di dalam LINE tidak bisa memasang aplikasi. Buka PIPS! di Chrome atau Safari dulu',
    );
    await expect(sheet(page).getByRole('listitem')).toHaveCount(0);
    await strictAudit(page, testInfo, 'pasang-line');
  });
});

test('the installed app says it is installed', async ({ page }) => {
  await open(page);
  await expect(sheet(page)).toContainText(
    'PIPS! sudah terpasang di perangkat ini.',
  );
});
