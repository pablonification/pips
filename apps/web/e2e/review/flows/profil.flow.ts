/** Profil (P1-C): profil, matkul, notifikasi. */
import { devices, type Page } from '@playwright/test';
import { answerPermission, pushDevice } from '../../support/push';
import * as writes from '../../support/writes';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');
const card = (page: Page, name: string, nim: string) =>
  main(page).getByRole('figure', { name: `Kartu anggota HMIF: ${name}, NIM ${nim}` });
const toast = (page: Page, text: string) => page.locator('.g-toast').filter({ hasText: text });
const facts = (page: Page) =>
  main(page)
    .locator('.g-facts-list li')
    .evaluateAll((lis) => lis.map((li) => [...li.children].map((c) => (c.textContent ?? '').trim())));

flow('profil', 'nadia', {}, async ({ page, f }) => {
  await f.step('The member card: status, name, NIM, IF’25 · PIXEL, the official logo', async () => {
    await f.open('/profil');
    const c = card(page, 'Nadia Putri', '13525045');
    await expect(c).toContainText('Anggota Biasa');
    await expect(c).toContainText('IF’25 · PIXEL');
    await expect(c.locator('img')).toHaveAttribute('src', '/logo/hmif.png');
    await f.gate('profil-nadia');
    await f.hold();
  });
  await f.step('Informasi akun, folded until opened', async () => {
    await main(page).getByText('Informasi akun').click();
    await expect
      .poll(() => facts(page))
      .toEqual([
        ['Email', '13525045@std.stei.itb.ac.id'],
        ['Program', 'Teknik Informatika'],
        ['Kampus', 'Ganesha'],
        ['Semester', '3 · Ganjil 2026/2027'],
      ]);
    await f.hold();
  });
  await f.step('The settings rows, and Keluar centred', async () => {
    await expect(main(page).getByRole('link', { name: /^Mata kuliahku 6 mata kuliah · 18 SKS$/ })).toBeVisible();
    await expect(main(page).getByRole('link', { name: /^Notifikasi\s*Belum menyala di perangkat ini$/ })).toBeVisible();
    await expect(main(page).getByRole('button', { name: 'Pasang PIPS!' })).toBeVisible();
    const keluar = main(page).getByRole('button', { name: 'Keluar' });
    await keluar.scrollIntoViewIfNeeded();
    await expect(keluar).toBeVisible();
    await f.hold();
  });
  await f.step('Kredit', async () => {
    await main(page).getByRole('link', { name: 'Kredit' }).click();
    await expect(page).toHaveURL(/\/profil\/kredit$/);
    await expect(main(page).getByText('PIPS! dibuat dan dirawat oleh HMIF ITB.')).toBeVisible();
    await f.gate('kredit');
    await f.hold();
  });
});

flow('profil', 'raka', {}, async ({ page, f }) => {
  await f.step('Raka’s card; his groups under Informasi akun', async () => {
    await f.open('/profil');
    await expect(card(page, 'Raka Pratama', '13524087')).toBeVisible();
    await main(page).getByText('Informasi akun').click();
    await expect.poll(async () => (await facts(page)).find(([k]) => k === 'Grup')?.[1]).toBe(
      'Welfare and Academics, Akademik, DE, Admin',
    );
    await f.gate('profil-raka');
    await f.hold();
  });
  await f.step('This device is on; no Kelola entry in Profil (D1)', async () => {
    await expect(main(page).getByRole('link', { name: /^Notifikasi/ })).toContainText('Menyala');
    await expect(main(page).getByRole('link', { name: /^Kelola/ })).toHaveCount(0);
    await f.hold();
  });
});

flow('matkul', 'nadia', {}, async ({ page, f, api }) => {
  api.on('DELETE /api/course/take/batch', writes.dropCourses);
  api.on('PUT /api/course/take/batch', writes.takeCourses);
  const codes = () => main(page).locator('.g-course .code').evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  const sks = () => main(page).locator('.g-sum-row .num').textContent();
  const search = main(page).getByRole('searchbox', { name: 'Cari mata kuliah' });
  await f.step('The semester, six courses, 18 SKS', async () => {
    await f.open('/profil/matkul');
    await expect(main(page).getByText('Semester 3 · Ganjil 2026/2027')).toBeVisible();
    await expect.poll(codes).toEqual(['IF2110', 'IF2120', 'IF2123', 'IF2130', 'IF2150', 'IF2180']);
    expect(await sks()).toBe('18');
    await f.gate('matkul');
  });
  await f.step('"Dipakai untuk apa?" (courses reset each semester)', async () => {
    await main(page).locator('details').getByText('Dipakai untuk apa?').click();
    await expect(main(page).getByText(/^Mata kuliah menentukan isi Ding Dong/)).toBeVisible();
    await f.hold();
  });
  await f.step('Remove IF2180: 16 SKS at once', async () => {
    await main(page).getByRole('button', { name: /^Hapus IF2180 / }).click();
    await expect.poll(codes).not.toContain('IF2180');
    expect(await sks()).toBe('16');
    await expect(toast(page, 'IF2180 dihapus dari mata kuliahmu.')).toBeVisible();
    await f.hold();
  });
  await f.step('Urungkan puts it back', async () => {
    await toast(page, 'IF2180 dihapus dari mata kuliahmu.').getByRole('button', { name: 'Urungkan' }).click();
    await expect.poll(codes).toContain('IF2180');
    expect(await sks()).toBe('18');
    await f.hold();
  });
  await f.step('Tambah mata kuliah: "IF2211", K2; Enter doesn’t reload', async () => {
    await main(page).getByRole('link', { name: 'Tambah mata kuliah' }).click();
    await f.type(search, 'IF2211');
    await expect(main(page).getByText('Strategi Algoritma')).toBeVisible();
    const url = page.url();
    await search.press('Enter');
    await expect(page).toHaveURL(url);
    await main(page).getByRole('radiogroup', { name: 'Kelas IF2211' }).getByRole('radio', { name: 'K2' }).click();
    await expect(page.getByRole('button', { name: /^Tambahkan/ }).locator('visible=true')).toHaveText(/Tambahkan \(1\)/);
    await f.gate('matkul-tambah');
    await f.hold();
  });
  await f.step('Tambahkan: back with 7 courses and 21 SKS', async () => {
    await page.getByRole('button', { name: /^Tambahkan/ }).locator('visible=true').click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await expect(toast(page, '1 mata kuliah ditambahkan. Ding Dong dan Kalender ikut diperbarui.')).toBeVisible();
    await expect.poll(codes).toHaveLength(7);
    await expect.poll(sks).toBe('21');
    await f.hold();
  });
});

const prompt = (page: Page) => page.getByRole('dialog', { name: 'Nyalakan notifikasi?' });
const sw = (page: Page, name: string) => main(page).getByRole('switch', { name });

flow('notifikasi', 'nadia', {}, async ({ page, f, api }) => {
  api.on('POST /api/push/register', writes.registerPush);
  api.on('POST /api/unsubscribe/category', writes.muteCategory);
  api.on('DELETE /api/unsubscribe/category', writes.unmuteCategory);
  await f.step('Belum aktif on this device', async () => {
    await f.open('/profil/notifikasi');
    await expect(main(page).getByText('Notifikasi belum menyala di perangkat ini')).toBeVisible();
    await f.gate('notifikasi-belum');
  });
  await f.step('The explainer before the browser asks', async () => {
    await main(page).getByRole('button', { name: 'Nyalakan notifikasi' }).click();
    await expect(prompt(page)).toContainText(
      'Pengumuman baru, pengingat H-1, dan balasan Curhat akan sampai ke perangkat ini.',
    );
    await f.gate('notifikasi-prompt');
    await f.hold();
  });
  await f.step('Allowed: Aktif', async () => {
    await prompt(page).getByRole('button', { name: 'Nyalakan' }).click();
    await expect(toast(page, 'Notifikasi menyala di perangkat ini.')).toBeVisible();
    await expect(main(page).getByText('Notifikasi menyala di perangkat ini')).toBeVisible();
    expect((await pushDevice(page)).asks).toBe(1);
    await f.hold();
  });
  await f.step('A test notification', async () => {
    await main(page).getByRole('button', { name: 'Kirim notifikasi uji' }).click();
    await expect(toast(page, 'Notifikasi uji terkirim ke perangkat ini.')).toBeVisible();
    expect((await pushDevice(page)).shown).toHaveLength(1);
    await f.gate('notifikasi-aktif');
    await f.hold();
  });
  await f.step('Lomba off and on again; muting stops only the push', async () => {
    await sw(page, 'Lomba').scrollIntoViewIfNeeded();
    await sw(page, 'Lomba').click();
    await expect(sw(page, 'Lomba')).toHaveAttribute('aria-checked', 'false');
    await f.hold();
    await sw(page, 'Lomba').click();
    await expect(sw(page, 'Lomba')).toHaveAttribute('aria-checked', 'true');
    expect(api.calls('DELETE /api/unsubscribe/category')).toHaveLength(1);
  });
  await f.step('Himpunan is required, and says why', async () => {
    await expect(sw(page, 'Himpunan')).toHaveAccessibleDescription('Wajib dari HMIF, tidak bisa dimatikan');
    await sw(page, 'Himpunan').click({ force: true });
    await expect(sw(page, 'Himpunan')).toHaveAttribute('aria-checked', 'true');
    await expect(toast(page, 'Kategori Himpunan wajib dari HMIF dan tidak bisa dimatikan.')).toBeVisible();
    await f.hold();
  });
});

flow('notifikasi', 'blocked', {}, async ({ page, f, api }) => {
  await f.step('Nyalakan, and the browser refuses', async () => {
    await f.open('/profil/notifikasi');
    await answerPermission(page, 'denied');
    await main(page).getByRole('button', { name: 'Nyalakan notifikasi' }).click();
    await prompt(page).getByRole('button', { name: 'Nyalakan' }).click();
    await expect(toast(page, 'Notifikasi diblokir di browser ini.')).toBeVisible();
  });
  await f.step('Diblokir, with how to fix it', async () => {
    await expect(main(page).getByText('Notifikasi diblokir di perangkat ini')).toBeVisible();
    await expect(main(page).getByText(/Izinkan lagi lewat ikon di samping alamat situs/)).toBeVisible();
    expect(api.calls('POST /api/push/register')).toHaveLength(0);
    await f.gate('notifikasi-diblokir');
    await f.hold();
  });
});

flow('notifikasi', 'iphone', { installed: false, userAgent: devices['iPhone 15'].userAgent }, async ({ page, f }) => {
  await f.step('An iPhone browser: web push needs the installed app', async () => {
    await f.open('/profil/notifikasi');
    await expect(main(page).getByText('Pasang PIPS! dulu untuk menyalakan notifikasi')).toBeVisible();
    await expect(main(page).getByRole('button', { name: 'Nyalakan notifikasi' })).toHaveCount(0);
    await f.gate('notifikasi-perlu-pasang');
    await f.hold();
  });
  await f.step('Pasang PIPS! shows the iPhone steps', async () => {
    await main(page).getByRole('button', { name: 'Pasang PIPS!' }).click();
    await expect(page.getByRole('dialog', { name: 'Pasang PIPS!' }).getByRole('listitem')).toHaveCount(3);
    await f.hold();
  });
});
