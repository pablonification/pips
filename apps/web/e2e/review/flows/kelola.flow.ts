/** Kelola (P3-A; managing competitions and testimonials P3-B): kelola, live-counting, sparta-data, kelola-lomba, kelola-testi. */
import type { Page } from '@playwright/test';
import { navLink } from '../../support/app';
import { dialog, toastText } from '../../support/manage';
import * as writes from '../../support/writes';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');
const listLinks = (page: Page) => main(page).getByRole('list').getByRole('link');
const plaque = (page: Page) => main(page).locator('.g-live-plaque');
const rows = (page: Page) => main(page).locator('li.g-resp');

flow('kelola', 'raka', {}, async ({ page, f, layout }) => {
  await f.step(layout === 'desktop' ? 'Kelola from the sidebar' : 'Kelola, last in Layanan', async () => {
    await f.open('/layanan');
    if (layout === 'desktop') {
      await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: /^Kelola/ }).click();
    } else {
      const heading = main(page).getByRole('heading', { name: 'Kelola' });
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
      await f.hold();
      await page.goto('/kelola');
    }
    await expect(page).toHaveURL(/\/kelola$/);
  });
  await f.step('Only the tools his roles allow: three', async () => {
    await expect(listLinks(page)).toHaveCount(3);
    await expect(listLinks(page).nth(0)).toHaveAccessibleName(/^Live Counting & Rekap Form/);
    await expect(listLinks(page).nth(1)).toHaveAccessibleName(/^Data SPARTA Magang/);
    await expect(listLinks(page).nth(2)).toHaveAccessibleName(/^Tambah acara Akademik/);
    await f.gate('kelola');
    await f.hold();
  });
});

flow('kelola', 'nadia', {}, async ({ page, f, api, layout }) => {
  await f.step('Nadia: no Kelola in Layanan or the navigation', async () => {
    await f.open('/layanan');
    await expect(main(page).getByRole('heading', { name: 'Kuliah' })).toBeVisible();
    await expect(main(page).getByRole('heading', { name: 'Kelola' })).toHaveCount(0);
    if (layout === 'desktop')
      await expect(
        page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: /^Kelola/ }),
      ).toHaveCount(0);
    await f.hold();
  });
  await f.step('Opening /kelola sends her to Layanan, with no admin request', async () => {
    await page.goto('/kelola');
    await expect(page).toHaveURL(/\/layanan$/);
    await expect(navLink(page, 'Layanan')).toBeVisible();
    expect(api.calls('GET /api/form/admin/list')).toHaveLength(0);
    await f.hold();
  });
});

flow('live-counting', 'raka', {}, async ({ page, f, api, db }) => {
  const socketReady = () =>
    expect
      .poll(() => [...api.socket.sessions.values()].some((s) => s.connected && s.rooms.has('form-admin:pixel')), {
        timeout: 20_000,
      })
      .toBe(true);
  await f.step('Live Counting: 142 have filled the PIXEL form', async () => {
    await f.open('/kelola/live');
    await expect(page).toHaveURL(/\/kelola\/live\/pixel$/);
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('142');
    await expect(rows(page)).toHaveCount(5);
    await f.gate('live');
  });
  await f.step('Someone sends it: 143, with the new name on top', async () => {
    await socketReady();
    db.adminResponses.pixel.unshift({
      id: 'resp-13525243',
      userId: 'user-13525243',
      major: 'STI',
      angkatan: 2025,
      answers: [],
      submittedAt: '2026-10-08T06:32:00.000Z',
      nim: '13525243',
      fullName: 'Pengisi Baru',
    });
    api.socket.emit(
      'form:new-response',
      { total: db.adminResponses.pixel.length, nim: '13525243', fullName: 'Pengisi Baru', submittedAt: '2026-10-08T06:32:00.000Z' },
      (s) => s.rooms.has('form-admin:pixel'),
    );
    await expect(plaque(page).locator('.t-figure-xl')).toHaveText('143');
    await expect(rows(page).first()).toHaveText(/13525243\s*Pengisi Baru\s*STI\s*13\.32/);
    await f.hold();
  });
  await f.step('The per-question charts', async () => {
    const charts = main(page).locator('.g-hbars');
    await charts.first().scrollIntoViewIfNeeded();
    await expect(charts).toHaveCount(2);
    await expect(charts.nth(0).locator('.g-hbar')).toHaveText([/IF\s*96/, /STI\s*46/]);
    await f.hold();
  });
  await f.step('Export CSV', async () => {
    const download = page.waitForEvent('download');
    await main(page).getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^form-analisis-kondisi-pixel-responses-2026-10-08-.*\.csv$/);
    await expect(page.getByText(/^Rekap 14\d jawaban diunduh sebagai CSV\.$/)).toBeVisible();
    await f.hold();
  });
  await f.step('Semua: Rekap Form, with its search and pager', async () => {
    await main(page).getByRole('link', { name: 'Semua' }).click();
    await expect(page).toHaveURL(/\/kelola\/live\/pixel\/rekap$/);
    await expect(main(page).getByText('1 / 8')).toBeVisible();
    await f.gate('rekap');
    await main(page).getByRole('button', { name: 'Halaman berikutnya' }).click();
    await expect(main(page).getByText('2 / 8')).toBeVisible();
    await f.type(main(page).getByRole('searchbox', { name: 'Cari nama atau NIM' }), 'farah');
    await expect(main(page).getByText('1 hasil.')).toBeVisible();
    await f.hold();
  });
  await f.step('With two forms open, the forms list (D8)', async () => {
    db.adminForms.push({
      ...db.adminForms[0],
      id: 'kesan',
      slug: 'kesan',
      title: 'Form Kesan Welcoming Party',
      opensAt: '2026-10-01T06:00:00.000Z',
      closesAt: '2026-10-07T16:59:00.000Z',
      order: 1,
    });
    db.formDetails.kesan = { ...db.formDetails.pixel, ...db.adminForms[1] };
    db.adminResponses.kesan = [];
    db.formAnalytics.kesan = { totalResponses: 0, questions: [] };
    await page.goto('/kelola/live');
    await expect(listLinks(page)).toHaveCount(2);
    await expect(listLinks(page).nth(1)).toHaveAccessibleName('Form Kesan Welcoming Party Ditutup Rab 7 Okt, 23.59');
    await f.gate('kelola-forms');
    await f.hold();
  });
});

flow('sparta-data', 'raka', {}, async ({ page, f, layout }) => {
  const touch = layout !== 'desktop';
  const table = main(page).locator('table.g-sparta-table');
  const spartaRows = main(page).locator('.g-sparta-rows > li');
  const names = () =>
    touch
      ? spartaRows.locator('.top > :first-child').allTextContents()
      : table.locator('tbody tr td:first-child').allTextContents();
  const search = main(page).getByRole('searchbox', { name: 'Cari nama atau NIM' });
  await f.step(touch ? 'Data SPARTA Magang: labelled rows on a touch screen' : 'Data SPARTA Magang: the table', async () => {
    await f.open('/kelola/sparta');
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
    if (touch) await expect(spartaRows).toHaveCount(3);
    else await expect(table).toBeVisible();
    await f.gate('sparta-table');
    await f.hold();
  });
  await f.step('Search by name, then by NIM', async () => {
    await f.type(search, 'TASYA');
    await expect.poll(names).toEqual(['Tasya Amelia']);
    await f.hold();
    await f.type(search, '13525071');
    await expect.poll(names).toEqual(['Bima Santoso']);
    await f.hold();
    await search.fill('');
    await expect(main(page).getByText('3 pendaftar')).toBeVisible();
  });
  await f.step('Filters: Draf; then Career Development at Pilihan 4', async () => {
    await main(page).getByRole('radio', { name: 'Draf' }).check();
    await expect(main(page).getByText('1 pendaftar')).toBeVisible();
    await f.hold();
    await main(page).getByRole('radio', { name: 'Semua', exact: true }).check();
    await main(page).getByLabel('Divisi', { exact: true }).selectOption({ label: 'Career Development · Career Development' });
    await main(page).getByLabel('Pilihan', { exact: true }).selectOption({ label: 'Pilihan 4' });
    await expect(main(page).getByText('2 pendaftar')).toBeVisible();
    await f.hold();
  });
  await f.step('Export CSV of exactly the rows shown', async () => {
    const download = page.waitForEvent('download');
    await main(page).getByRole('button', { name: 'Export CSV' }).click();
    expect((await download).suggestedFilename()).toMatch(/^internship-submissions-2026-10-08-.*\.csv$/);
    await expect(page.getByText('Data 2 pendaftar diunduh sebagai CSV.')).toBeVisible();
    await f.hold();
  });
  await f.step('Bima’s submission: four choices in order, with their answers', async () => {
    await (touch
      ? spartaRows.filter({ hasText: 'Bima Santoso' }).getByRole('link')
      : table.getByRole('link', { name: 'Bima Santoso' })
    ).click();
    await expect(page).toHaveURL(/\/kelola\/sparta\/sub-13525071$/);
    await expect(main(page).locator('.g-choice-card h3')).toHaveText([
      'Prioritas 1: Akademik',
      'Prioritas 2: Welfare',
      'Prioritas 3: Competition and Community',
      'Prioritas 4: Career Development',
    ]);
    await f.gate('sparta-submission');
    await f.hold();
  });
});

flow('kelola-lomba', 'cnc', { roles: ['cnc'] }, async ({ page, f, api }) => {
  api.on('POST /api/competitions', writes.createCompetition);
  api.on('PUT /api/competitions/:id', writes.updateCompetition);
  api.on('DELETE /api/competitions/:competitionId', writes.deleteCompetition);
  const names = () => main(page).getByRole('heading', { level: 2 }).allTextContents();
  const add = dialog(page, 'Tambah lomba');
  await f.step('Info Lomba with Tambah lomba, for cnc only', async () => {
    await f.open('/layanan/lomba');
    await expect.poll(names).toHaveLength(4);
    await page.getByRole('button', { name: 'Tambah lomba' }).locator('visible=true').click();
    await expect(add).toBeVisible();
    await expect(add.getByLabel('Nama lomba')).toBeFocused();
    await f.gate('tambah-lomba');
  });
  await f.step('Focus stays inside; it fits the screen', async () => {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    const box = (await add.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  });
  await f.step('Escape closes it', async () => {
    await page.keyboard.press('Escape');
    await expect(add).toBeHidden();
    await page.getByRole('button', { name: 'Tambah lomba' }).locator('visible=true').click();
    await expect(add).toBeVisible();
  });
  await f.step('Tambahkan empty: each error', async () => {
    await add.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(add.getByText('Tulis minimal 3 huruf.')).toHaveCount(2);
    await expect(add.getByText('Isi tanggal dan jamnya.')).toBeVisible();
    await expect(add.getByLabel('Nama lomba')).toBeFocused();
    await f.gate('tambah-lomba-errors');
    await f.hold();
  });
  await f.step('Hology 8, closing Sabtu 10 Oktober: saved, first by its deadline', async () => {
    await f.type(add.getByLabel('Nama lomba'), 'Hology 8');
    await f.type(add.getByLabel('Penyelenggara'), 'Universitas Brawijaya');
    await add.getByRole('checkbox', { name: 'UI/UX' }).click();
    await add.getByLabel('Tanggal pendaftaran ditutup').fill('2026-10-10');
    await f.type(add.getByLabel('Tautan pendaftaran'), 'hology.ub.ac.id/daftar');
    await f.type(add.getByLabel('Tautan sumber'), 'https://instagram.com/hology');
    await add.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(add).toBeHidden();
    await expect(toastText(page, 'Lomba ditambahkan.')).toBeVisible();
    await expect.poll(async () => (await names())[0]).toBe('Hology 8');
    await f.hold();
  });
  await f.step('Ubah lomba: Gemastik XIX’s organiser', async () => {
    await main(page).getByRole('button', { name: 'Opsi untuk Gemastik XIX' }).click();
    await page.getByRole('menuitem', { name: 'Ubah lomba' }).click();
    const d = dialog(page, 'Ubah lomba');
    await expect(d.getByLabel('Nama lomba')).toHaveValue('Gemastik XIX');
    await f.type(d.getByLabel('Penyelenggara'), 'Puspresnas Kemdiktisaintek');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect(d).toBeHidden();
    await expect(toastText(page, 'Lomba diperbarui.')).toBeVisible();
    expect(api.calls('PUT /api/competitions/:id')[0].body).toEqual({ organizer: 'Puspresnas Kemdiktisaintek' });
    await f.hold();
  });
  await f.step('Hapus lomba, confirmed', async () => {
    await main(page).getByRole('button', { name: 'Opsi untuk Gemastik XIX' }).click();
    await page.getByRole('menuitem', { name: 'Hapus lomba' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Hapus lomba ini?' });
    await expect(
      confirm.getByText('Gemastik XIX hilang dari Info Lomba untuk semua anggota. Ini tidak bisa diurungkan.'),
    ).toBeVisible();
    await f.gate('hapus-lomba');
    await f.hold();
    await confirm.getByRole('button', { name: 'Hapus' }).click();
    await expect(toastText(page, 'Lomba dihapus.')).toBeVisible();
    await expect.poll(names).not.toContain('Gemastik XIX');
    await f.hold();
  });
});

flow('kelola-testi', 'raka', {}, async ({ page, f, api }) => {
  api.on('POST /api/testimoni', writes.createTestimonial);
  const add = dialog(page, 'Tambah testimoni');
  const article = (ke: number, jumlah: number) => main(page).getByRole('article', { name: `Testimoni ${ke} dari ${jumlah}` });
  await f.step('IF2110: Tambah testimoni, with IF’s sections', async () => {
    await f.open('/layanan/testi/teknik-informatika/3/course-IF2110');
    await expect(article(1, 3)).toBeVisible();
    await page.getByRole('button', { name: 'Tambah testimoni' }).locator('visible=true').click();
    await expect(add).toBeVisible();
    for (const name of ['Overview', 'Tugas', 'Review Dosen']) await expect(add.getByLabel(name, { exact: true })).toBeVisible();
    await f.gate('tambah-testi');
  });
  await f.step('Empty: "Tulis minimal satu bagian."', async () => {
    await add.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(add.getByText('Tulis minimal satu bagian.')).toBeVisible();
    await expect(add.getByLabel('Overview', { exact: true })).toBeFocused();
    await f.gate('tambah-testi-error');
    await f.hold();
  });
  await f.step('Saved: the new one in the pager, 4 / 4, by Anonim', async () => {
    await f.type(add.getByLabel('Tugas', { exact: true }), 'Tubes tiap dua minggu.');
    await add.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(add).toBeHidden();
    await expect(toastText(page, 'Testimoni ditambahkan.')).toBeVisible();
    await expect(article(4, 4).getByText('Tubes tiap dua minggu.')).toBeVisible();
    await expect(article(4, 4).getByText('Anonim')).toBeVisible();
    await f.hold();
  });
  await f.step('An STI course offers STI’s sections (II2110)', async () => {
    await page.goto('/layanan/testi/sistem-dan-teknologi-informasi/3/course-II2110');
    await page.getByRole('button', { name: 'Tambah testimoni' }).locator('visible=true').click();
    for (const name of ['Kesan', 'Tantangan', 'Saran']) await expect(add.getByLabel(name, { exact: true })).toBeVisible();
    await f.hold();
  });
});
