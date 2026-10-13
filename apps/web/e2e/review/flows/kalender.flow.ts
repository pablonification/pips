/** Kalender (P1-A; managing events P3-B): kalender, kalender-tambah-acara, kalender-himpunan. */
import type { Page } from '@playwright/test';
import { defaultHandlers } from '../../support/handlers';
import { toastText } from '../../support/manage';
import { reply } from '../../support/mock';
import * as writes from '../../support/writes';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');
const side = (page: Page) => page.getByRole('region', { name: 'Acara hari terpilih' });
const day = (page: Page, name: RegExp, month = 'Oktober 2026') =>
  main(page).getByRole('group', { name: month }).getByRole('button', { name });
const dayRows = (page: Page) => main(page).locator('.g-agenda-item > span:last-child > .block');
const monthHeading = (page: Page, desk: boolean, name: string) =>
  desk ? main(page).getByRole('heading', { level: 1, name }) : main(page).getByText(name, { exact: true });

flow('kalender', 'nadia', {}, async ({ page, f, api, layout }) => {
  const desk = layout === 'desktop';
  const detail = () => (desk ? side(page) : page.getByRole('dialog', { name: 'Detail acara' }));
  // The app fetches the next month ahead, so December (two months on) is the one that loads: it answers after a
  // moment, so its loading state shows.
  const events = defaultHandlers['GET /api/calendar/me'];
  api.on('GET /api/calendar/me', (ctx) =>
    ctx.query.get('month') === '12' ? reply.delay(1500, events(ctx)) : events(ctx),
  );
  await f.step('Kalender opens on today’s month and day', async () => {
    await f.open('/kalender');
    await expect(monthHeading(page, desk, 'Oktober 2026')).toBeVisible();
    await expect(day(page, /^Kamis, 8 Oktober, hari ini, 2 acara/)).toHaveAttribute('aria-pressed', 'true');
    await expect(dayRows(page)).toHaveText([
      'Kuis 2',
      'IF2123 Aljabar Linier dan Geometri',
      'Sharing Session: Magang di Startup',
      'Acara Himpunan',
    ]);
    await expect(main(page).getByRole('button', { name: 'Tambah acara' })).toHaveCount(0);
    await expect(main(page).getByRole('group', { name: 'Oktober 2026' }).getByRole('button').first()).toHaveAccessibleName(
      /^Senin, 28 September/,
    );
    await f.gate('kalender');
  });
  await f.step('The legend tells Akademik, Himpunan and deadlines apart', async () => {
    const legend = main(page).getByText('Batas waktu');
    await legend.scrollIntoViewIfNeeded();
    await expect(legend).toBeVisible();
    await f.hold();
  });
  await f.step('Jumat 9: Deadline Tugas Besar 1, "Batas"', async () => {
    await day(page, /^Jumat, 9 Oktober/).click();
    const row = main(page).getByRole('button', { name: /^23\.59.*Deadline Tugas Besar 1/ });
    await expect(row).toContainText('Batas');
    if (!desk) await row.click();
  });
  await f.step('Its detail: WIB time, the course, the reminder, three links', async () => {
    const d = detail();
    await expect(d.getByRole('heading', { name: 'Deadline Tugas Besar 1' })).toBeVisible();
    await expect(d).toContainText('IF2110 · Algoritma dan Pemrograman II');
    await expect(d).toContainText('Paling lambat 23.59 WIB');
    await expect(d).toContainText('Kumpulkan di Edunex. Satu kelompok tiga orang.');
    await expect(d).toContainText('Notifikasi belum menyala di perangkat ini');
    await expect(d.getByRole('link', { name: /Google Calendar/ })).toHaveAttribute('target', '_blank');
    await expect(d.getByRole('link', { name: 'Ding Dong' })).toHaveAttribute('href', '/layanan/dingdong');
    await expect(d.getByRole('link', { name: 'Testi Matkul' })).toBeVisible();
    await f.gate('kalender-detail');
    await f.hold();
    if (!desk) {
      await page.keyboard.press('Escape');
      await expect(d).toBeHidden();
    }
  });
  await f.step('November, then December loading its events', async () => {
    await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
    await expect(monthHeading(page, desk, 'November 2026')).toBeVisible();
    await f.hold();
    await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
    await expect(monthHeading(page, desk, 'Desember 2026')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Memuat acara…' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Memuat acara…' })).toHaveCount(0);
  });
  await f.step('Back to November: Dies Natalis HMIF ke-44', async () => {
    await main(page).getByRole('button', { name: 'Bulan sebelumnya' }).click();
    await day(page, /^Selasa, 10 November/, 'November 2026').click();
    await expect(main(page).getByText('Dies Natalis HMIF ke-44').first()).toBeVisible();
    await f.hold();
  });
  await f.step('Hari ini comes back', async () => {
    await main(page).getByRole('button', { name: 'Hari ini', exact: true }).click();
    await expect(monthHeading(page, desk, 'Oktober 2026')).toBeVisible();
    await expect(day(page, /^Kamis, 8 Oktober, hari ini/)).toHaveAttribute('aria-pressed', 'true');
    await expect(day(page, /^Kamis, 8 Oktober, hari ini/)).toBeFocused();
    await f.hold();
  });
});

const dialog = (page: Page, name: string) => page.getByRole('dialog', { name });

flow('kalender-tambah-acara', 'raka', {}, async ({ page, f, api, layout }) => {
  const desk = layout === 'desktop';
  api
    .on('POST /api/calendar/event', writes.createEvent)
    .on('PUT /api/calendar/event/:eventId', writes.updateEvent)
    .on('DELETE /api/calendar/event/:eventId', writes.deleteEvent);
  const d = dialog(page, 'Tambah acara Akademik');
  const field = (name: string, within = d) => within.getByLabel(name, { exact: true });
  const detail = () => (desk ? side(page) : page.getByRole('dialog', { name: 'Detail acara' }));
  await f.step('Tambah acara', async () => {
    await f.open('/kalender');
    await main(page).getByRole('button', { name: 'Tambah acara' }).click();
    await expect(d).toBeVisible();
    await expect(field('Mata kuliah')).toBeFocused();
    await f.gate('addev');
  });
  await f.step('An empty title: the error, focused', async () => {
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d.getByText('Tulis judul acara, misalnya Kuis 2.')).toBeVisible();
    await expect(field('Judul')).toBeFocused();
    expect(api.calls('POST /api/calendar/event')).toHaveLength(0);
    await f.gate('addev-error');
    await f.hold();
  });
  await f.step('Kuis 2 for IF3170 on Selasa 13 Oktober, 13.00–15.00', async () => {
    await field('Mata kuliah').selectOption('course-IF3170');
    await f.type(field('Judul'), 'Kuis 2');
    await field('Tanggal').fill('2026-10-13');
    await field('Mulai').fill('13:00');
    await field('Selesai').fill('15:00');
    await f.hold();
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    await expect(toastText(page, 'Acara ditambahkan ke kalender anggota IF3170 dan Google Calendar-nya.')).toBeVisible();
  });
  await f.step('It is on the day', async () => {
    await expect(page).toHaveURL(/hari=2026-10-13/);
    if (desk) await expect(side(page).getByRole('heading', { name: 'Kuis 2' })).toBeVisible();
    else await expect(main(page).getByText('Kuis 2', { exact: true })).toBeVisible();
    await f.gate('kalender-after');
    await f.hold();
  });
  await f.step('…and in search', async () => {
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Pencarian global' });
    await expect(palette).toBeVisible();
    await f.type(palette.getByRole('combobox', { name: 'Cari di PIPS!' }), 'IF3170');
    await expect(palette.getByRole('option').filter({ hasText: /^Kuis 2 · IF3170/ })).toBeVisible();
    await f.hold();
    await page.keyboard.press('Escape');
  });
  await f.step('Ubah acara (P3-B’s proposal): Kuis 1 moves to Rabu 14', async () => {
    await page.goto('/kalender?hari=2026-10-08&acara=b1');
    await detail().getByRole('button', { name: 'Opsi acara Kuis 1' }).click();
    await page.getByRole('menuitem', { name: 'Ubah acara' }).click();
    const ubah = dialog(page, 'Ubah acara');
    await expect(field('Judul', ubah)).toHaveValue('Kuis 1');
    await field('Tanggal', ubah).fill('2026-10-14');
    await f.gate('ubah-acara');
    await f.hold();
    await ubah.getByRole('button', { name: 'Simpan' }).click();
    await expect(ubah).toBeHidden();
    await expect(toastText(page, 'Acara diperbarui.')).toBeVisible();
    await expect(page).toHaveURL(/hari=2026-10-14/);
  });
  await f.step('Hapus acara (P3-B’s proposal), confirmed', async () => {
    if (!desk) await main(page).getByRole('button', { name: /Kuis 1/ }).first().click();
    await detail().getByRole('button', { name: 'Opsi acara Kuis 1' }).click();
    await page.getByRole('menuitem', { name: 'Hapus acara' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Hapus acara ini?' });
    await expect(
      confirm.getByText('Acara hilang dari kalender anggota dan Google Calendar-nya. Ini tidak bisa diurungkan.'),
    ).toBeVisible();
    await f.gate('hapus-acara');
    await f.hold();
    await confirm.getByRole('button', { name: 'Hapus' }).click();
    await expect(toastText(page, 'Acara dihapus.')).toBeVisible();
    expect(api.calls('DELETE /api/calendar/event/:eventId').map((c) => c.path)).toEqual(['/api/calendar/event/b1']);
  });
  await f.step('From Layanan’s Kelola row, Tambah acara Akademik opens the same dialog over Kalender', async () => {
    await page.goto('/layanan');
    const row = main(page).getByRole('link', { name: /^Tambah acara Akademik/ });
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await expect(page).toHaveURL(/\/kalender\?(.*&)?tambah=acara/);
    await expect(d).toBeVisible();
    await f.hold();
  });
});

flow('kalender-himpunan', 'ring1', { roles: { only: ['ring1'] } }, async ({ page, f, api }) => {
  api.on('POST /api/calendar/event', writes.createEvent);
  const d = dialog(page, 'Tambah acara Himpunan');
  await f.step('Ring 1 only: Tambah acara Himpunan, with no Mata kuliah', async () => {
    await f.open('/kalender');
    await main(page).getByRole('button', { name: 'Tambah acara' }).click();
    await expect(d).toBeVisible();
    await expect(d.getByLabel('Mata kuliah')).toHaveCount(0);
    await expect(d.getByRole('group', { name: 'Jenis acara' })).toHaveCount(0);
    await f.gate('addev-himpunan');
  });
  await f.step('Rapat Anggota HMIF on Selasa 13', async () => {
    await f.type(d.getByLabel('Judul', { exact: true }), 'Rapat Anggota HMIF');
    await d.getByLabel('Tanggal', { exact: true }).fill('2026-10-13');
    await f.hold();
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    await expect(toastText(page, 'Acara ditambahkan ke kalender semua anggota dan Google Calendar-nya.')).toBeVisible();
    await f.hold();
  });
});

flow('kalender-himpunan', 'both', { roles: ['ring1'] }, async ({ page, f }) => {
  await f.step('Akademik and Ring 1: Jenis acara offers both', async () => {
    await f.open('/kalender?tambah=acara');
    const seg = page.getByRole('group', { name: 'Jenis acara' });
    await expect(seg.getByRole('radio', { name: 'Akademik' })).toBeChecked();
    await expect(dialog(page, 'Tambah acara Akademik')).toBeVisible();
    await f.gate('addev-seg');
    await f.hold();
  });
  await f.step('Himpunan: the dialog follows, with no Mata kuliah', async () => {
    await page.getByRole('group', { name: 'Jenis acara' }).getByRole('radio', { name: 'Himpunan' }).check();
    const d = dialog(page, 'Tambah acara Himpunan');
    await expect(d).toBeVisible();
    await expect(d.getByLabel('Mata kuliah')).toHaveCount(0);
    await f.hold();
  });
});
