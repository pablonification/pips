/**
 * Profil (P1-C): the member card, Informasi akun, the setting rows, Tampilan, Keluar and Kredit, for Nadia and Raka.
 * Replaces profile.spec.ts (today's English settings); its checks live on here and in matkul.spec.ts and
 * notifikasi.spec.ts.
 */
import type { Page } from '@playwright/test';
import { layoutOf } from '../support/app';
import { reply } from '../support/mock';
import { E2E_SUBSCRIPTION, pushDevice } from '../support/push';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const main = (page: Page) => page.getByRole('main');
const card = (page: Page, name: string, nim: string) =>
  main(page).getByRole('figure', {
    name: `Kartu anggota HMIF: ${name}, NIM ${nim}`,
  });
const confirm = (page: Page) =>
  page.getByRole('alertdialog', { name: 'Keluar dari PIPS!?' });
const toastText = (page: Page, text: string) =>
  page.locator('.g-toast').filter({ hasText: text });
const facts = (page: Page) =>
  main(page)
    .locator('.g-facts-list li')
    .evaluateAll((lis) =>
      lis.map((li) =>
        [...li.children].map((c) => (c.textContent ?? '').trim()),
      ),
    );

test.describe('Nadia', () => {
  test('the card, Informasi akun without Grup, the rows and Keluar centred', async ({
    page,
  }, testInfo) => {
    await page.goto('/profil');
    const c = card(page, 'Nadia Putri', '13525045');
    await expect(c).toBeVisible();
    await expect(c).toContainText('Anggota Biasa');
    await expect(c).toContainText('Nadia Putri');
    await expect(c).toContainText('13525045');
    await expect(c).toContainText('Teknik Informatika');
    await expect(c).toContainText('IF’25 · PIXEL');
    // The official logo, whole, on its ink plate.
    const logo = c.locator('img');
    await expect(logo).toHaveAttribute('src', '/logo/hmif.png');
    expect((await logo.boundingBox())!.width).toBeGreaterThanOrEqual(72);

    // Informasi akun is folded, and repeats nothing from the card.
    const info = main(page).getByText('Informasi akun');
    await info.click();
    await expect
      .poll(() => facts(page))
      .toEqual([
        ['Email', '13525045@std.stei.itb.ac.id'],
        ['Program', 'Teknik Informatika'],
        ['Kampus', 'Ganesha'],
        ['Semester', '3 · Ganjil 2026/2027'],
      ]);

    const row = (name: RegExp) => main(page).getByRole('link', { name });
    await expect(row(/^Mata kuliahku 6 mata kuliah · 18 SKS$/)).toBeVisible();
    await expect(
      row(/^Notifikasi\s*Belum menyala di perangkat ini$/),
    ).toBeVisible();
    await expect(row(/^Kredit$/)).toHaveAttribute('href', '/profil/kredit');
    await expect(
      main(page).getByRole('button', { name: 'Pasang PIPS!' }),
    ).toBeVisible();
    await expect(
      main(page).getByRole('group', { name: 'Tampilan aplikasi' }),
    ).toBeVisible();

    // Keluar is centred in its column (the ghost button's own 4 px offset is the prototype's too).
    const keluar = main(page).getByRole('button', { name: 'Keluar' });
    const k = (await keluar.boundingBox())!;
    const column = (await keluar.locator('..').boundingBox())!;
    expect(
      Math.abs(k.x + k.width / 2 - (column.x + column.width / 2)),
    ).toBeLessThan(6);
    // Desktop: card and Informasi akun on the left, the rows on the right (`.prof-grid`).
    const box = (await c.boundingBox())!;
    const rows = (await row(/^Kredit$/).boundingBox())!;
    if (layoutOf(testInfo) === 'desktop')
      expect(rows.x).toBeGreaterThan(box.x + box.width);
    else expect(rows.y).toBeGreaterThan(box.y + box.height);

    await strictGates(page, testInfo, 'profil-nadia', 'Profil');
  });

  test('the rows open their pages', async ({ page }) => {
    await page.goto('/profil');
    await main(page)
      .getByRole('link', { name: /^Mata kuliahku/ })
      .click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await page.goBack();
    await main(page)
      .getByRole('link', { name: /^Notifikasi/ })
      .click();
    await expect(page).toHaveURL(/\/profil\/notifikasi$/);
    await page.goBack();
    await main(page).getByRole('link', { name: 'Kredit' }).click();
    await expect(page).toHaveURL(/\/profil\/kredit$/);
    await expect(page).toHaveTitle('Kredit · PIPS!');
  });

  test('loading: the card at once from the cached member, the counts fill in', async ({
    page,
    api,
  }) => {
    api.on('GET /api/course/take/current', reply.hang());
    await page.goto('/profil');
    await expect(card(page, 'Nadia Putri', '13525045')).toBeVisible();
    await expect(
      main(page).getByRole('link', { name: /^Mata kuliahku/ }),
    ).not.toContainText('mata kuliah ·');
  });

  test('a failed count says so with Coba lagi beside the rows, which recovers', async ({
    page,
    api,
    db,
  }, testInfo) => {
    let fail = true;
    api.on('GET /api/course/take/current', () =>
      fail ? reply.status(503) : db.myCourses,
    );
    await page.goto('/profil');
    const retry = main(page).getByRole('button', { name: 'Coba lagi' });
    await expect(retry).toBeVisible({ timeout: 15_000 });
    await expect(main(page)).toContainText('Bagian ini gagal dimuat.');
    await strictAudit(page, testInfo, 'profil-error');
    fail = false;
    await retry.click();
    await expect(
      main(page).getByRole('link', { name: /6 mata kuliah · 18 SKS/ }),
    ).toBeVisible();
    await expect(retry).toBeHidden();
  });

  test('offline: what was kept, under the offline banner', async ({
    page,
    api,
  }) => {
    await page.goto('/profil');
    await expect(
      main(page).getByRole('link', { name: /6 mata kuliah · 18 SKS/ }),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    await api.setOffline(true);
    await expect(main(page).getByText(/^Offline · diperbarui/)).toBeVisible();
    await expect(card(page, 'Nadia Putri', '13525045')).toBeVisible();
    await expect(
      main(page).getByRole('link', { name: /6 mata kuliah · 18 SKS/ }),
    ).toBeVisible();
    await api.setOffline(false);
  });

  test('regression: offline, the banner gives the time of the last data that loaded, never just “now”', async ({
    page,
    api,
  }) => {
    // The courses never load; the rest of the page did, at 13.35.
    api.on('GET /api/course/take/current', reply.status(503));
    await page.goto('/profil');
    await expect(
      main(page).getByRole('button', { name: 'Coba lagi' }),
    ).toBeVisible();
    await page.clock.fastForward('20:00');
    await api.setOffline(true);
    await expect(
      main(page).getByText('Offline · diperbarui 13.35'),
    ).toBeVisible();
    await api.setOffline(false);
  });
});

test.describe('Raka', () => {
  test.use({ persona: 'pengurus' });

  test('his card, Grup with his groups, this device on, and no Kelola entry in Profil', async ({
    page,
  }, testInfo) => {
    await page.goto('/profil');
    const c = card(page, 'Raka Pratama', '13524087');
    await expect(c).toContainText('IF’24');
    await expect(c).not.toContainText('IF’24 ·');
    await main(page).getByText('Informasi akun').click();
    await expect
      .poll(() => facts(page))
      .toEqual([
        ['Email', '13524087@std.stei.itb.ac.id'],
        ['Program', 'Teknik Informatika'],
        ['Kampus', 'Ganesha'],
        ['Semester', '5 · Ganjil 2026/2027'],
        ['Grup', 'Welfare and Academics, Akademik, DE, Admin'],
      ]);
    await expect(
      main(page).getByRole('link', {
        name: /^Notifikasi\s*Menyala di perangkat ini$/,
      }),
    ).toBeVisible();
    // Kelola stays where the prototype puts it: last in Layanan, not in Profil (OPEN-QUESTIONS D1).
    await expect(main(page).getByText('Kelola')).toHaveCount(0);
    await strictGates(page, testInfo, 'profil-raka', 'Profil');
  });

  test('regression: Grup shows no role keys while the group names load, nor after they fail', async ({
    page,
    api,
  }) => {
    let fail = false;
    let answer!: () => void;
    const held = new Promise<void>((r) => (answer = r));
    api.on('GET /api/auth/groups', async ({ db }) => {
      await held;
      return fail ? reply.status(503) : db.groups;
    });
    await page.goto('/profil');
    await main(page).getByText('Informasi akun').click();
    await expect.poll(() => facts(page)).toHaveLength(4);
    await expect(main(page)).not.toContainText('welfarenakademik');
    fail = true;
    answer();
    await expect(
      main(page).getByRole('button', { name: 'Coba lagi' }),
    ).toBeVisible();
    expect((await facts(page)).map(([k]) => k)).not.toContain('Grup');
    await expect(main(page)).not.toContainText('welfarenakademik');
  });

  test('Keluar: unlinks this device, then signs out and lands on sign-in, never asking for permission', async ({
    page,
    api,
    db,
  }, testInfo) => {
    api.on('PUT /api/push/logout', writes.logoutPush);
    api.on('POST /api/logout', writes.logout);
    db.pushSubscriptions = [E2E_SUBSCRIPTION];
    await page.goto('/profil');
    const keluar = main(page).getByRole('button', { name: 'Keluar' });
    await keluar.click();
    await expect(confirm(page)).toBeVisible();
    await expect(confirm(page)).toContainText(
      'Kamu perlu masuk lagi dengan email mahasiswa (NIM@std.stei.itb.ac.id). Notifikasi di perangkat ini berhenti sampai kamu masuk lagi.',
    );
    await expect(
      confirm(page).getByRole('button', { name: 'Batal' }),
    ).toBeFocused();
    await strictAudit(page, testInfo, 'keluar-confirm');
    await confirm(page).getByRole('button', { name: 'Keluar' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('button', { name: 'Masuk dengan Google' }),
    ).toBeVisible();
    // The order: the device first (it needs no session), then the session.
    const order = api.writes.map((w) => `${w.method} ${w.path}`);
    expect(order).toEqual(['PUT /api/push/logout', 'POST /api/logout']);
    expect(api.calls('PUT /api/push/logout')[0].body).toEqual({
      endpoint: E2E_SUBSCRIPTION.endpoint,
    });
    expect(db.pushSubscriptions).toEqual([]);
    // Regression (SPEC "Removals"): sign-out never asks for notification permission.
    expect((await pushDevice(page)).asks).toBe(0);
    // Nothing of Raka stays on the device: "user" is the signed-out marker.
    expect(
      await page.evaluate(() => [
        localStorage.getItem('user'),
        localStorage.getItem('userAcademic'),
      ]),
    ).toEqual(['null', null]);
  });

  test('a failed sign-out keeps the session, links the device again, and offers Coba lagi', async ({
    page,
    api,
    db,
  }) => {
    api.on('PUT /api/push/logout', writes.logoutPush);
    api.on('POST /api/push/register', writes.registerPush);
    let fail = true;
    api.on('POST /api/logout', (req) =>
      fail ? reply.status(500) : writes.logout(req),
    );
    db.pushSubscriptions = [E2E_SUBSCRIPTION];
    await page.goto('/profil');
    await main(page).getByRole('button', { name: 'Keluar' }).click();
    await confirm(page).getByRole('button', { name: 'Keluar' }).click();
    const error = toastText(
      page,
      'Gagal keluar. Periksa koneksimu, lalu coba lagi.',
    );
    await expect(error).toBeVisible();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(card(page, 'Raka Pratama', '13524087')).toBeVisible();
    // Regression: the device was unlinked before the failed sign-out; it is linked again.
    await expect.poll(() => db.pushSubscriptions).toEqual([E2E_SUBSCRIPTION]);
    expect(api.calls('POST /api/push/register').map((c) => c.body)).toEqual([
      E2E_SUBSCRIPTION,
    ]);
    expect((await pushDevice(page)).asks).toBe(0);

    fail = false;
    await error.getByRole('button', { name: 'Coba lagi' }).click();
    await confirm(page).getByRole('button', { name: 'Keluar' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('regression: when the device can’t be unlinked, Keluar still signs out and ends the browser’s subscription', async ({
    page,
    api,
    db,
  }) => {
    api.on('PUT /api/push/logout', reply.status(500));
    api.on('POST /api/logout', writes.logout);
    db.pushSubscriptions = [E2E_SUBSCRIPTION];
    await page.goto('/profil');
    await main(page).getByRole('button', { name: 'Keluar' }).click();
    await confirm(page).getByRole('button', { name: 'Keluar' }).click();
    await expect(page).toHaveURL(/\/login$/);
    const order = api.writes.map((w) => `${w.method} ${w.path}`);
    expect(order).toEqual(['PUT /api/push/logout', 'POST /api/logout']);
    // Notifications stop on this device all the same: the browser's subscription is gone.
    expect((await pushDevice(page)).subscribed).toBe(false);
    expect((await pushDevice(page)).asks).toBe(0);
  });

  test('when both the unlink and the sign-out fail, the session stays and the device subscribes and links again', async ({
    page,
    api,
    db,
  }) => {
    api.on('PUT /api/push/logout', reply.status(500));
    api.on('POST /api/logout', reply.status(500));
    api.on('POST /api/push/register', writes.registerPush);
    db.pushSubscriptions = [];
    await page.goto('/profil');
    await main(page).getByRole('button', { name: 'Keluar' }).click();
    await confirm(page).getByRole('button', { name: 'Keluar' }).click();
    await expect(
      toastText(page, 'Gagal keluar. Periksa koneksimu, lalu coba lagi.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/profil$/);
    await expect.poll(() => db.pushSubscriptions).toEqual([E2E_SUBSCRIPTION]);
    expect((await pushDevice(page)).subscribed).toBe(true);
    expect((await pushDevice(page)).asks).toBe(0);
  });
});

test('Keluar: Batal and Escape keep you signed in, with focus back on Keluar', async ({
  page,
  api,
}) => {
  await page.goto('/profil');
  const keluar = main(page).getByRole('button', { name: 'Keluar' });
  await keluar.click();
  await confirm(page).getByRole('button', { name: 'Batal' }).click();
  await expect(confirm(page)).toBeHidden();
  await expect(keluar).toBeFocused();
  await keluar.click();
  await expect(confirm(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirm(page)).toBeHidden();
  await expect(keluar).toBeFocused();
  expect(api.writes).toEqual([]);
  await expect(page).toHaveURL(/\/profil$/);
});

test('Keluar: a sheet on phones, a centred panel on tablets, a small dialog on desktop', async ({
  page,
}, testInfo) => {
  await page.goto('/profil');
  await main(page).getByRole('button', { name: 'Keluar' }).click();
  const box = (await confirm(page).boundingBox())!;
  const vp = page.viewportSize()!;
  const layout = layoutOf(testInfo);
  if (layout === 'phone') {
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(
      vp.height - 1,
    );
    expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
  } else {
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
    expect(box.y + box.height).toBeLessThan(vp.height - 8);
    if (layout === 'desktop') expect(box.width).toBeLessThanOrEqual(480);
  }
});

test('Tampilan: Sistem, Terang and Gelap set the theme and its colours, and persist', async ({
  page,
}, testInfo) => {
  const dark = testInfo.project.name.includes('dark');
  await page.goto('/profil');
  const seg = main(page).getByRole('group', { name: 'Tampilan aplikasi' });
  const state = () =>
    page.evaluate(() => ({
      dark: document.documentElement.classList.contains('dark'),
      scheme: getComputedStyle(document.documentElement).colorScheme,
      themeColor: document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content'),
      stored: localStorage.getItem('pips:theme'),
    }));
  await expect(seg.getByRole('radio', { name: 'Sistem' })).toBeChecked();
  expect((await state()).dark).toBe(dark);

  await seg.getByText('Gelap').click();
  await expect.poll(state).toEqual({
    dark: true,
    scheme: 'dark',
    themeColor: '#0A0907',
    stored: 'dark',
  });
  await seg.getByText('Terang').click();
  await expect.poll(state).toEqual({
    dark: false,
    scheme: 'light',
    themeColor: '#FCFBF8',
    stored: 'light',
  });
  await page.reload();
  await expect(seg.getByRole('radio', { name: 'Terang' })).toBeChecked();
  expect((await state()).dark).toBe(false);

  await seg.getByText('Sistem').click();
  await expect.poll(async () => (await state()).stored).toBe(null);
  expect((await state()).dark).toBe(dark);
});

test.describe('Kredit', () => {
  test('renders the server’s credits in Garis type', async ({
    page,
  }, testInfo) => {
    await page.goto('/profil/kredit');
    await expect(
      main(page).getByText('PIPS! dibuat dan dirawat oleh HMIF ITB.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'kredit', 'Profil');
  });

  test('a failed load says so with Coba lagi, which recovers', async ({
    page,
    api,
    db,
  }) => {
    let fail = true;
    api.on('GET /api/markdown/credits', () =>
      fail ? reply.status(500) : db.credits,
    );
    await page.goto('/profil/kredit');
    await expect(main(page).getByText('Kredit gagal dimuat.')).toBeVisible({
      timeout: 15_000,
    });
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(
      main(page).getByText('PIPS! dibuat dan dirawat oleh HMIF ITB.'),
    ).toBeVisible();
  });
});
