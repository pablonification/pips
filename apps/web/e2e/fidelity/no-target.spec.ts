/**
 * P1-C's screens and states with no locked target (OPEN-QUESTIONS D2, D3, D5): captured in every layout and theme
 * for the owner, next to the nearest locked screen. Runs only with E2E_NO_TARGET_DIR set (the fidelity report skips
 * it):
 *
 *   E2E_NO_TARGET_DIR=../../../ops/redesign/proposals/P1-C pnpm exec playwright test -c e2e e2e/fidelity/no-target.spec.ts \
 *     --project=fidelity-phone-light --project=fidelity-phone-dark --project=fidelity-tablet-light \
 *     --project=fidelity-tablet-dark --project=fidelity-desk-light --project=fidelity-desk-dark
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { stableScreenshot } from '../support/capture';
import { stubInstallPrompt, UA } from '../support/device';
import { fakeGoogle, googleRequests } from '../support/google';
import { reply } from '../support/mock';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const dir = process.env.E2E_NO_TARGET_DIR;
test.skip(
  !dir,
  'Set E2E_NO_TARGET_DIR to capture the screens with no locked target.',
);
test.use({ platform: 'Linux x86_64' });

const main = (page: Page) => page.getByRole('main');

async function shot(page: Page, name: string, ready: Locator) {
  await expect(ready).toBeVisible({ timeout: 15_000 });
  const [, layout, theme] = /^fidelity-(\w+)-(\w+)$/.exec(
    test.info().project.name,
  )!;
  mkdirSync(dir!, { recursive: true });
  writeFileSync(
    path.join(dir!, `${layout}-${name}-${theme}.png`),
    await stableScreenshot(page),
  );
}

async function googleReady(page: Page) {
  await expect
    .poll(async () => (await googleRequests(page)).clients.length)
    .toBe(1);
}

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test('sign-in, then its 401 and retry errors', async ({ page, api }) => {
    await fakeGoogle(page.context());
    await page.goto('/login');
    await googleReady(page);
    await shot(
      page,
      'masuk',
      page.getByRole('button', { name: 'Masuk dengan Google' }),
    );
    api.on('POST /api/auth/login/accesstoken', writes.loginNotAMember);
    await page.getByRole('button', { name: 'Masuk dengan Google' }).click();
    await shot(page, 'masuk-401', page.getByRole('alert'));
    api.on('POST /api/auth/login/accesstoken', writes.loginServerError);
    await page.getByRole('button', { name: 'Masuk dengan Google' }).click();
    await shot(
      page,
      'masuk-gagal',
      page.getByRole('button', { name: 'Coba lagi' }),
    );
  });
});

test.describe('a new member, not installed', () => {
  test.use({ installed: false });

  test('first run', async ({ page, db }) => {
    db.myCourses = [];
    await page.goto('/mulai');
    await shot(
      page,
      'mulai',
      main(page).getByText('Ding Dong dan acara Akademik masih kosong.'),
    );
  });
});

test('Kredit', async ({ page }) => {
  await page.goto('/profil/kredit');
  await shot(
    page,
    'kredit',
    main(page).getByText('PIPS! dibuat dan dirawat oleh HMIF ITB.'),
  );
});

test('Kredit fails', async ({ page, api }) => {
  api.on('GET /api/markdown/credits', reply.status(500));
  await page.goto('/profil/kredit');
  await shot(
    page,
    'kredit-gagal',
    main(page).getByRole('button', { name: 'Coba lagi' }),
  );
});

test('Keluar', async ({ page }) => {
  await page.goto('/profil');
  await main(page).getByText('6 mata kuliah · 18 SKS').waitFor();
  await main(page)
    .getByRole('button', { name: 'Keluar' })
    .evaluate((b: HTMLElement) => b.click());
  await shot(
    page,
    'keluar',
    page.getByRole('alertdialog', { name: 'Keluar dari PIPS!?' }),
  );
});

test('Mata kuliahku empty, failed and offline', async ({ page, api, db }) => {
  const kept = db.myCourses;
  db.myCourses = [];
  await page.goto('/profil/matkul');
  await shot(
    page,
    'matkul-kosong',
    main(page).getByText('Belum ada mata kuliah semester ini'),
  );
  db.myCourses = kept;
  api.on('GET /api/course/take/current', reply.status(503));
  await page.goto('/profil/matkul');
  await shot(
    page,
    'matkul-gagal',
    main(page).getByRole('button', { name: 'Coba lagi' }),
  );
});

test('Mata kuliahku offline', async ({ page, api }) => {
  await page.goto('/profil/matkul');
  await expect(main(page).getByText('Jumlah SKS')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await api.setOffline(true);
  await shot(
    page,
    'matkul-offline',
    main(page).getByText(/^Offline · diperbarui/),
  );
  await api.setOffline(false);
});

test('Profil with a failed count', async ({ page, api }) => {
  api.on('GET /api/course/take/current', reply.status(503));
  await page.goto('/profil');
  await shot(
    page,
    'profil-gagal',
    main(page).getByRole('button', { name: 'Coba lagi' }),
  );
});

test.describe('Notifikasi blocked', () => {
  test.use({ push: 'blocked' });
  test('Diblokir', async ({ page }) => {
    await page.goto('/profil/notifikasi');
    await shot(
      page,
      'notif-diblokir',
      main(page).getByText('Notifikasi diblokir di perangkat ini'),
    );
  });
});

test.describe('iPhone outside the installed app', () => {
  test.use({ installed: false, userAgent: UA.iphone });
  test('needs the installed app; Pasang PIPS! with its steps', async ({
    page,
  }) => {
    await page.goto('/profil/notifikasi');
    await shot(
      page,
      'notif-perlu-pasang',
      main(page).getByText('Pasang PIPS! dulu untuk menyalakan notifikasi'),
    );
    await page.goto('/profil');
    await main(page).getByText('6 mata kuliah · 18 SKS').waitFor();
    await main(page)
      .getByRole('button', { name: 'Pasang PIPS!' })
      .evaluate((b: HTMLElement) => b.click());
    await shot(
      page,
      'pasang-iphone',
      page.getByRole('dialog', { name: 'Pasang PIPS!' }),
    );
  });
});

test.describe('a browser without web push', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      delete (window as { PushManager?: unknown }).PushManager;
    });
  });
  test('unsupported', async ({ page }) => {
    await page.goto('/profil/notifikasi');
    await shot(
      page,
      'notif-tidak-didukung',
      main(page).getByText('Browser ini tidak mendukung notifikasi'),
    );
  });
});

test.describe('Android Chrome', () => {
  test.use({ installed: false, userAgent: UA.androidChrome });
  test('Pasang PIPS! with Chrome’s prompt', async ({ page, context }) => {
    await stubInstallPrompt(context);
    await page.goto('/profil');
    await main(page).getByText('6 mata kuliah · 18 SKS').waitFor();
    await main(page)
      .getByRole('button', { name: 'Pasang PIPS!' })
      .evaluate((b: HTMLElement) => b.click());
    await shot(
      page,
      'pasang-android',
      page.getByRole('dialog', { name: 'Pasang PIPS!' }),
    );
  });
});

test.describe('LINE', () => {
  test.use({ installed: false, userAgent: UA.line });
  test('Pasang PIPS! from LINE’s browser', async ({ page }) => {
    await page.goto('/profil');
    await main(page).getByText('6 mata kuliah · 18 SKS').waitFor();
    await main(page)
      .getByRole('button', { name: 'Pasang PIPS!' })
      .evaluate((b: HTMLElement) => b.click());
    await shot(
      page,
      'pasang-line',
      page.getByRole('dialog', { name: 'Pasang PIPS!' }),
    );
  });
});
