/**
 * Profil › Notifikasi and the push module (P1-C): this device's card in every state, the prompt (the only place
 * that asks for permission), the test notification, and a switch per category.
 */
import { devices, type Page } from '@playwright/test';
import { reply } from '../support/mock';
import {
  answerPermission,
  E2E_SUBSCRIPTION,
  pushDevice,
} from '../support/push';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const prompt = (page: Page) =>
  page.getByRole('dialog', { name: 'Nyalakan notifikasi?' });
const main = (page: Page) => page.getByRole('main');
const toastText = (page: Page, text: string) =>
  page.locator('.g-toast').filter({ hasText: text });
const sw = (page: Page, name: string) =>
  main(page).getByRole('switch', { name });

test.describe('the device card', () => {
  test('Belum aktif → Nanti saja asks nothing → Nyalakan asks once, subscribes, registers → Aktif with a test notification', async ({
    page,
    api,
    db,
  }, testInfo) => {
    api.on('POST /api/push/register', writes.registerPush);
    await page.goto('/profil/notifikasi');
    await expect(
      main(page).getByText('Notifikasi belum menyala di perangkat ini'),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        'Tanpa ini, pengumuman baru, pengingat H-1, dan balasan Curhat tidak akan sampai.',
      ),
    ).toBeVisible();
    await strictGates(page, testInfo, 'notifikasi-belum', 'Profil');

    const open = main(page).getByRole('button', {
      name: 'Nyalakan notifikasi',
    });
    await open.click();
    await expect(prompt(page)).toBeVisible();
    await expect(prompt(page)).toContainText(
      'Pengumuman baru, pengingat H-1, dan balasan Curhat akan sampai ke perangkat ini.',
    );
    await expect(prompt(page)).toContainText(
      'Di iPhone, pasang PIPS! ke layar utama dulu.',
    );
    await strictAudit(page, testInfo, 'notifikasi-prompt');
    await prompt(page).getByRole('button', { name: 'Nanti saja' }).click();
    await expect(prompt(page)).toBeHidden();
    await expect(
      toastText(page, 'Notifikasi tetap mati. Nyalakan kapan saja di Profil.'),
    ).toBeVisible();
    await expect(open).toBeFocused();
    expect((await pushDevice(page)).asks).toBe(0);
    expect(api.calls('POST /api/push/register')).toHaveLength(0);

    await open.click();
    await prompt(page).getByRole('button', { name: 'Nyalakan' }).click();
    await expect(
      toastText(page, 'Notifikasi menyala di perangkat ini.'),
    ).toBeVisible();
    const device = await pushDevice(page);
    expect(device.asks).toBe(1);
    expect(device.subscribes).toEqual([
      { userVisibleOnly: true, applicationServerKey: 'e2e-vapid-public-key' },
    ]);
    expect(api.calls('POST /api/push/register').map((c) => c.body)).toEqual([
      E2E_SUBSCRIPTION,
    ]);
    expect(db.pushSubscriptions).toEqual([E2E_SUBSCRIPTION]);
    await expect(
      main(page).getByText('Notifikasi menyala di perangkat ini'),
    ).toBeVisible();
    // The button that opened the prompt is gone: focus lands on the page's title, not nowhere.
    await expect(page.locator(':focus')).toHaveCount(1);

    await main(page)
      .getByRole('button', { name: 'Kirim notifikasi uji' })
      .click();
    await expect(
      toastText(page, 'Notifikasi uji terkirim ke perangkat ini.'),
    ).toBeVisible();
    expect((await pushDevice(page)).shown).toEqual([
      {
        title: 'Notifikasi uji',
        body: 'Pengumuman baru, pengingat H-1, dan balasan Curhat akan muncul seperti ini.',
        tag: 'pips-uji',
      },
    ]);
    await strictGates(page, testInfo, 'notifikasi-aktif', 'Profil');

    // It stays on after a reload: the state is the device's, read again.
    await page.reload();
    await expect(
      main(page).getByRole('button', { name: 'Kirim notifikasi uji' }),
    ).toBeVisible();
  });

  test('denied in the browser → Diblokir, saying how to fix it; nothing registered', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/profil/notifikasi');
    await answerPermission(page, 'denied');
    await main(page)
      .getByRole('button', { name: 'Nyalakan notifikasi' })
      .click();
    await prompt(page).getByRole('button', { name: 'Nyalakan' }).click();
    await expect(prompt(page)).toBeHidden();
    await expect(
      main(page).getByText('Notifikasi diblokir di perangkat ini'),
    ).toBeVisible();
    await expect(
      main(page).getByText(/Izinkan lagi lewat ikon di samping alamat situs/),
    ).toBeVisible();
    await expect(
      toastText(page, 'Notifikasi diblokir di browser ini.'),
    ).toBeVisible();
    expect(api.calls('POST /api/push/register')).toHaveLength(0);
    await strictGates(page, testInfo, 'notifikasi-diblokir', 'Profil');
  });

  test.describe('blocked from the start', () => {
    test.use({ push: 'blocked' });
    test('opens on Diblokir and asks nothing', async ({ page }) => {
      await page.goto('/profil/notifikasi');
      await expect(
        main(page).getByText('Notifikasi diblokir di perangkat ini'),
      ).toBeVisible();
      await expect(
        main(page).getByRole('button', { name: 'Nyalakan notifikasi' }),
      ).toHaveCount(0);
      expect((await pushDevice(page)).asks).toBe(0);
    });
  });

  test('a failed registration says so with Coba lagi, which registers without asking again', async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on('POST /api/push/register', (req) =>
      fail ? reply.status(503) : writes.registerPush(req),
    );
    await page.goto('/profil/notifikasi');
    await main(page)
      .getByRole('button', { name: 'Nyalakan notifikasi' })
      .click();
    await prompt(page).getByRole('button', { name: 'Nyalakan' }).click();
    const error = toastText(
      page,
      'Notifikasi belum menyala. Periksa koneksimu, lalu coba lagi.',
    );
    await expect(error).toBeVisible();
    await expect(
      main(page).getByText('Notifikasi belum menyala di perangkat ini'),
    ).toBeVisible();
    // The server doesn't know this device, so it isn't left subscribed.
    expect((await pushDevice(page)).subscribed).toBe(false);
    fail = false;
    await error.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(
      toastText(page, 'Notifikasi menyala di perangkat ini.'),
    ).toBeVisible();
    expect(api.calls('POST /api/push/register')).toHaveLength(2);
    expect((await pushDevice(page)).asks).toBe(1);
    await expect(
      main(page).getByText('Notifikasi menyala di perangkat ini'),
    ).toBeVisible();
  });

  test.describe('Raka', () => {
    test.use({ persona: 'pengurus' });
    test('a device already on shows Aktif', async ({ page }) => {
      await page.goto('/profil/notifikasi');
      await expect(
        main(page).getByText('Notifikasi menyala di perangkat ini'),
      ).toBeVisible();
    });
  });

  test.describe('iPhone outside the installed app @phone-only', () => {
    test.use({
      installed: false,
      userAgent: devices['iPhone 15'].userAgent,
    });
    test('needs the installed app, and Pasang PIPS! shows the iPhone steps', async ({
      page,
    }, testInfo) => {
      await page.goto('/profil/notifikasi');
      await expect(
        main(page).getByText('Pasang PIPS! dulu untuk menyalakan notifikasi'),
      ).toBeVisible();
      await expect(
        main(page).getByRole('button', { name: 'Nyalakan notifikasi' }),
      ).toHaveCount(0);
      await strictAudit(page, testInfo, 'notifikasi-perlu-pasang');
      await main(page).getByRole('button', { name: 'Pasang PIPS!' }).click();
      const sheet = page.getByRole('dialog', { name: 'Pasang PIPS!' });
      await expect(sheet.getByRole('listitem')).toHaveText([
        /1\. Ketuk Bagikan di bilah bawah Safari\./,
        /2\. Pilih Tambahkan ke Layar Utama\./,
        /3\. Ketuk Tambah, lalu buka PIPS! dari layar utama\./,
      ]);
      expect((await pushDevice(page)).asks).toBe(0);
    });

    test('regression: the prompt opened from elsewhere (Beranda, search) offers Pasang PIPS!, not only Tutup', async ({
      page,
    }) => {
      // The shell's test page opens the prompt as Beranda's row and search do (P1-A).
      await page.goto('/dev/shell');
      await page
        .getByRole('button', { name: 'Buka prompt notifikasi' })
        .click();
      const prompt = page.getByRole('dialog', { name: 'Nyalakan notifikasi?' });
      await expect(prompt).toContainText(
        'Di iPhone, notifikasi hanya sampai lewat PIPS! yang terpasang di layar utama.',
      );
      await expect(
        prompt.getByRole('button', { name: 'Nyalakan' }),
      ).toHaveCount(0);
      await prompt.getByRole('button', { name: 'Pasang PIPS!' }).click();
      await expect(prompt).toHaveCount(0);
      const sheet = page.getByRole('dialog', { name: 'Pasang PIPS!' });
      await expect(sheet.getByRole('listitem')).toHaveCount(3);
      expect((await pushDevice(page)).asks).toBe(0);
    });
  });

  test.describe('a browser without web push', () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript(() => {
        delete (window as { PushManager?: unknown }).PushManager;
      });
    });
    test('says so and offers nothing to press', async ({ page }) => {
      await page.goto('/profil/notifikasi');
      await expect(
        main(page).getByText('Browser ini tidak mendukung notifikasi'),
      ).toBeVisible();
      await expect(main(page).getByRole('button')).toHaveCount(0);
    });
  });
});

test.describe('Kategori pengumuman', () => {
  test('one switch per category in the API’s order; Lomba mutes and unmutes; Himpunan is locked', async ({
    page,
    api,
  }) => {
    api.on('POST /api/unsubscribe/category', writes.muteCategory);
    api.on('DELETE /api/unsubscribe/category', writes.unmuteCategory);
    await page.goto('/profil/notifikasi');
    await expect(main(page).getByRole('switch')).toHaveCount(6);
    const names = await main(page)
      .getByRole('switch')
      .evaluateAll((els) =>
        els
          .map((el) => el.getAttribute('aria-labelledby'))
          .map((id) => document.getElementById(id!)!.textContent),
      );
    expect(names).toEqual([
      'Akademik',
      'Himpunan',
      'Lomba',
      'Beasiswa',
      'Karier',
      'Umum',
    ]);
    await expect(main(page)).toContainText(
      'Termasuk pengingat H-1 acara mata kuliah',
    );
    await expect(sw(page, 'Himpunan')).toHaveAccessibleDescription(
      'Wajib dari HMIF, tidak bisa dimatikan',
    );

    await sw(page, 'Lomba').click();
    await expect(sw(page, 'Lomba')).toHaveAttribute('aria-checked', 'false');
    expect(api.calls('POST /api/unsubscribe/category')[0].body).toEqual({
      categoryId: 'lomba',
    });
    await sw(page, 'Lomba').click();
    await expect(sw(page, 'Lomba')).toHaveAttribute('aria-checked', 'true');
    expect(api.calls('DELETE /api/unsubscribe/category')[0].body).toEqual({
      categoryId: 'lomba',
    });
    // Survives a reload: it was the server's state.
    await sw(page, 'Karier').click();
    await expect(sw(page, 'Karier')).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(sw(page, 'Karier')).toHaveAttribute('aria-checked', 'false');

    // aria-disabled, not disabled: it stays reachable so it can say why (Playwright would wait for it to enable).
    await sw(page, 'Himpunan').click({ force: true });
    await expect(sw(page, 'Himpunan')).toHaveAttribute('aria-checked', 'true');
    await expect(sw(page, 'Himpunan')).toHaveAttribute('aria-disabled', 'true');
    await expect(
      toastText(
        page,
        'Kategori Himpunan wajib dari HMIF dan tidak bisa dimatikan.',
      ),
    ).toBeVisible();
    expect(
      api
        .calls('POST /api/unsubscribe/category')
        .filter(
          (c) => (c.body as { categoryId: string }).categoryId === 'himpunan',
        ),
    ).toHaveLength(0);
  });

  test('a failed mute puts the switch back and says so', async ({
    page,
    api,
  }) => {
    api.on('POST /api/unsubscribe/category', reply.status(503));
    await page.goto('/profil/notifikasi');
    await sw(page, 'Beasiswa').click();
    await expect(
      toastText(
        page,
        'Notifikasi Beasiswa gagal diubah. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect(sw(page, 'Beasiswa')).toHaveAttribute('aria-checked', 'true');
  });

  test('regression: a failed mute puts back only its own switch, not one changed meanwhile', async ({
    page,
    api,
    db,
  }) => {
    let failBeasiswa!: () => void;
    const held = new Promise<void>((r) => (failBeasiswa = r));
    api.on('POST /api/unsubscribe/category', async (req) => {
      if ((req.body as { categoryId: string }).categoryId === 'beasiswa') {
        await held;
        return reply.status(503);
      }
      return writes.muteCategory(req);
    });
    await page.goto('/profil/notifikasi');
    await sw(page, 'Beasiswa').click();
    await sw(page, 'Karier').click();
    await expect.poll(() => db.mutedCategoryIds).toContain('karier');
    failBeasiswa();
    await expect(
      toastText(
        page,
        'Notifikasi Beasiswa gagal diubah. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect(sw(page, 'Beasiswa')).toHaveAttribute('aria-checked', 'true');
    await expect(sw(page, 'Karier')).toHaveAttribute('aria-checked', 'false');
  });

  test('a failed load shows Coba lagi beside the list, which recovers', async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on('GET /api/category', ({ db }) =>
      fail ? reply.status(503) : { categories: db.categories },
    );
    await page.goto('/profil/notifikasi');
    const retry = main(page).getByRole('button', { name: 'Coba lagi' });
    // Server errors are retried three times first (1, 2, 4 s).
    await expect(retry).toBeVisible({ timeout: 15_000 });
    await expect(
      main(page).getByText('Bagian ini gagal dimuat.'),
    ).toBeVisible();
    fail = false;
    await retry.click();
    await expect(main(page).getByRole('switch')).toHaveCount(6);
  });
});
