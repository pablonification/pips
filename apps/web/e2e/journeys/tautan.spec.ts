/**
 * Tautan pendek, the member's side: the list, making a link (every name message), a link's page (where it goes, its
 * name, deleting it), a form's link, the pages a push about an admin's change opens, and the loading, error and
 * empty states. Phone, tablet and desktop, light and dark, with strict gates.
 */
import type { Locator, Page, TestInfo } from '@playwright/test';
import { layoutOf, navLink } from '../support/app';
import { reply } from '../support/mock';
import { toastText } from '../support/pengumuman';
import { shortLinkWrites } from '../support/short-links';
import { strictGates } from '../support/strict';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const sheet = (page: Page) => page.getByRole('dialog');
const rows = (page: Page) =>
  main(page)
    .locator('li.sl-row')
    .locator('a')
    .filter({ hasText: 's.hmif.dev/' });
const desk = (t: TestInfo) => layoutOf(t) === 'desktop';
const nameField = (scope: Page | Locator) =>
  scope.getByRole('textbox', { name: /^Nama pendek/ });

/** "Buat tautan": the top bar's on phones and tablets, the page head's on desktop. */
const makeButton = (page: Page) =>
  page.getByRole('button', { name: 'Buat tautan' }).first();

async function writes(api: import('../support/mock').ApiMock) {
  for (const [k, h] of Object.entries(shortLinkWrites)) api.on(k, h);
}

test.describe('Tautan pendek', () => {
  test('Layanan › Administrasi opens the list: newest first, each with where it goes, its clicks and a copy button', async ({
    page,
    context,
  }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/layanan');
    const row = main(page).getByRole('link', { name: /^Tautan pendek/ });
    await expect(row).toContainText('s.hmif.dev');
    await row.click();
    await expect(page).toHaveURL(/\/layanan\/tautan$/);
    await expect(page).toHaveTitle('Tautan pendek · PIPS!');
    await expect(rows(page)).toHaveCount(6);
    expect(
      await rows(page).evaluateAll((els) =>
        els.map((e) => e.querySelector('b')?.textContent),
      ),
    ).toEqual([
      'bukber-pixel-25',
      'slide-pti-k4',
      'jadwal-piket-sekre',
      'PixelStudyGroup',
      'catatan-kalkulus-1b',
      'Catatan_PTI',
    ]);
    await expect(rows(page).first()).toContainText(
      'docs.google.com/forms/d/e/1FAIpQLSc9bukberPIXEL25x/viewform',
    );
    await expect(rows(page).first()).toContainText('186');
    // The quiet way into claiming: a row on phones and tablets, a button in the page head on desktop.
    const claim = desk(testInfo)
      ? main(page).getByRole('link', { name: 'Ambil tautan lama' })
      : main(page).getByRole('link', {
          name: 'Ambil tautan dari akun lama s.hmif.dev',
        });
    await expect(claim).toHaveAttribute('href', '/layanan/tautan/ambil');
    await strictGates(page, testInfo, 'links', 'Layanan');

    await main(page)
      .getByRole('button', { name: 'Salin s.hmif.dev/slide-pti-k4' })
      .click();
    await expect(toastText(page, 'Tautan disalin.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'https://s.hmif.dev/slide-pti-k4',
    );
  });

  test('search and the two orders', async ({ page, api }, testInfo) => {
    await page.goto('/layanan/tautan');
    await expect(rows(page)).toHaveCount(6);
    await main(page)
      .getByRole('searchbox', { name: 'Cari tautanmu' })
      .fill('kalkulus');
    await expect(
      main(page).getByRole('status').filter({ hasText: 'cocok' }),
    ).toHaveText('1 tautan cocok');
    await expect(rows(page)).toHaveCount(1);
    // While searching, the claim row steps aside.
    await expect(
      main(page).getByRole('link', {
        name: 'Ambil tautan dari akun lama s.hmif.dev',
      }),
    ).toHaveCount(0);
    expect(
      api.requests.some(
        (r) =>
          r.path === '/api/short-links' && r.query.includes('search=kalkulus'),
      ),
    ).toBe(true);
    await main(page).getByRole('searchbox').fill('zzz');
    await expect(
      main(page).getByText('Tidak ada tautanmu dengan “zzz”.'),
    ).toBeVisible();
    await main(page).getByRole('searchbox').fill('');
    await main(page).getByRole('radio', { name: 'Paling diklik' }).check();
    await expect(rows(page).first()).toContainText('catatan-kalkulus-1b');
    await strictGates(page, testInfo, 'links-clicks', 'Layanan');
  });

  test('make a link: the destination, then the name with every message in place, then the address ready to copy', async ({
    page,
    api,
    context,
  }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await writes(api);
    await page.goto('/layanan/tautan');
    await makeButton(page).click();
    const d = sheet(page);
    await expect(
      d.getByRole('heading', { name: 'Buat tautan pendek' }),
    ).toBeVisible();
    const dest = d.getByLabel('Tujuan');
    await expect(dest).toBeFocused();
    await strictGates(page, testInfo, 'make', null);

    const submit = d.getByRole('button', { name: 'Buat tautan' });
    await submit.click();
    await expect(d.getByText('Tempel alamatnya dulu')).toBeVisible();
    await expect(dest).toBeFocused();
    await dest.fill('s.hmif.dev/abc');
    await submit.click();
    await expect(d.getByText('Ini sudah tautan s.hmif.dev')).toBeVisible();
    await dest.fill('docs.google.com/forms/d/e/1FAIpQLSbukber2');
    await submit.click();
    await expect(
      d.getByText('Tulis alamat lengkap, diawali https://'),
    ).toBeVisible();
    await dest.fill(
      'https://docs.google.com/forms/d/e/1FAIpQLSbukber2/viewform',
    );

    const name = nameField(d);
    const says = async (typed: string, words: string) => {
      await name.fill(typed);
      await expect(d.getByRole('status').filter({ hasText: words })).toHaveText(
        words,
      );
    };
    await says('bb', 'Minimal 3 karakter');
    await says(
      'daftar-ulang-peserta-pengenalan-kampus-pixel-2025-gelombang-2',
      'Maksimal 50 karakter (sekarang 61)',
    );
    await says('bukber!25', 'Hanya huruf, angka, dan tanda hubung');
    await says('bukber--25', 'Tanda hubung hanya di antara huruf atau angka');
    await says(
      'Bukber-PIXEL-25',
      'Sudah dipakai tautan lain sebagai bukber-pixel-25',
    );
    await says('Makrab-2026', 'Sudah dipakai form lain sebagai makrab-2026');
    await says('oprec-asisten-pti', 'Nama ini sudah pernah dipakai');
    // A refused name stops the save and keeps the field's focus; nothing is sent.
    await submit.click();
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls('POST /api/short-links')).toHaveLength(0);
    await strictGates(page, testInfo, 'make-deleted', null);

    // Spaces become hyphens as they are typed; capitals stay.
    await name.fill('');
    await name.pressSequentially('Rapat Angkatan PIXEL');
    await expect(name).toHaveValue('Rapat-Angkatan-PIXEL');
    await expect(
      d.getByRole('status').filter({ hasText: 'Tersedia' }),
    ).toBeVisible();
    await submit.click();
    await expect(d.getByRole('heading', { name: 'Tautan siap' })).toBeVisible();
    expect(api.calls('POST /api/short-links')[0]?.body).toEqual({
      destination: 'https://docs.google.com/forms/d/e/1FAIpQLSbukber2/viewform',
      name: 'Rapat-Angkatan-PIXEL',
    });
    await expect(d.getByText('s.hmif.dev/Rapat-Angkatan-PIXEL')).toBeVisible();
    const copy = d.getByRole('button', { name: 'Salin tautan' });
    await expect(copy).toBeFocused();
    await strictGates(page, testInfo, 'made', null);
    await copy.click();
    await expect(
      d.getByRole('button', { name: 'Tautan disalin' }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'https://s.hmif.dev/Rapat-Angkatan-PIXEL',
    );
    await d.getByRole('button', { name: 'Selesai' }).click();
    await expect(d).toHaveCount(0);
    // The new link is on top, washed gold once.
    await expect(rows(page).first()).toContainText('Rapat-Angkatan-PIXEL');
    await expect(main(page).locator('li.sl-row').first()).toHaveClass(/sl-new/);
  });

  test('an empty name gets a random one', async ({ page, api }) => {
    await writes(api);
    await page.goto('/layanan/tautan');
    await makeButton(page).click();
    await sheet(page).getByLabel('Tujuan').fill('https://example.com/acara');
    await expect(
      sheet(page).getByText('Kosongkan untuk nama acak.'),
    ).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Buat tautan' }).click();
    await expect(sheet(page).getByText('s.hmif.dev/k7m2xq')).toBeVisible();
    expect(api.calls('POST /api/short-links')[0]?.body).toEqual({
      destination: 'https://example.com/acara',
    });
  });

  test('a link: where it goes changes in place, the name changes and the old one keeps working', async ({
    page,
    api,
  }, testInfo) => {
    await writes(api);
    await page.goto('/layanan/tautan');
    await rows(page).filter({ hasText: 'catatan-kalkulus-1b' }).click();
    await expect(page).toHaveURL(/\/layanan\/tautan\/l-kalkulus$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'catatan-kalkulus-1b' }),
    ).toBeAttached();
    const facts = main(page).locator('.sl-facts');
    await expect(facts).toContainText('742 kali');
    await expect(facts).toContainText('3 Mar 2026');
    await expect(facts).toContainText('19 Mei 2026');
    await expect(
      main(page).getByRole('link', {
        name: /drive\.google\.com\/drive\/folders\/1aXoKalkulus1BcatatanNP \(situs luar, tab baru\)/,
      }),
    ).toHaveAttribute('target', '_blank');
    await strictGates(page, testInfo, 'link', 'Layanan');

    await main(page).getByRole('button', { name: 'Ubah tujuan' }).click();
    const dest = main(page).getByLabel('Tujuan baru');
    await expect(dest).toBeFocused();
    await dest.fill('drive.google.com/x');
    await dest.press('Enter');
    await expect(
      main(page).getByText('Tulis alamat lengkap, diawali https://'),
    ).toBeVisible();
    expect(api.calls('PATCH /api/short-links/:id')).toHaveLength(0);
    await dest.fill(
      'https://drive.google.com/drive/folders/1aXoKalkulus1BcatatanNP-v2',
    );
    await strictGates(page, testInfo, 'link-edit-dest', 'Layanan');
    await main(page).getByRole('button', { name: 'Simpan' }).click();
    await expect(toastText(page, 'Tujuan diubah.')).toBeVisible();
    expect(api.calls('PATCH /api/short-links/:id')[0]?.body).toEqual({
      destination:
        'https://drive.google.com/drive/folders/1aXoKalkulus1BcatatanNP-v2',
    });
    await expect(
      main(page).getByRole('button', { name: 'Ubah tujuan' }),
    ).toBeFocused();

    await main(page).getByRole('button', { name: 'Ubah nama pendek' }).click();
    const name = nameField(main(page));
    await expect(name).toBeFocused();
    await expect(
      main(page).getByText('s.hmif.dev/catatan-kalkulus-1b tetap bisa dibuka.'),
    ).toBeVisible();
    // Typing goes where the caret is: the name is selected once, when the editor opens, never again.
    await name.press('End');
    await name.pressSequentially('-v2');
    await expect(name).toHaveValue('catatan-kalkulus-1b-v2');
    await name.fill('catatan-kalkulus');
    await expect(
      main(page).getByRole('status').filter({ hasText: 'Tersedia' }),
    ).toBeVisible();
    await strictGates(page, testInfo, 'link-rename', 'Layanan');
    await name.press('Enter');
    await expect(
      toastText(page, 'Nama diubah. Alamat lama tetap bisa dibuka.'),
    ).toBeVisible();
    expect(api.calls('PUT /api/short-links/:id/name')[0]?.body).toEqual({
      name: 'catatan-kalkulus',
    });
    await expect(
      page.getByRole('heading', { level: 1, name: 'catatan-kalkulus' }),
    ).toBeAttached();
    await expect(facts).toContainText('Nama lama');
    await expect(facts).toContainText('s.hmif.dev/catatan-kalkulus-1b');
    await expect(
      main(page).getByRole('button', { name: 'Ubah nama pendek' }),
    ).toBeFocused();
    await strictGates(page, testInfo, 'link-renamed', 'Layanan');
  });

  test('an old name that breaks today’s rule shows as it is; renaming it follows the rule', async ({
    page,
    api,
  }) => {
    await writes(api);
    await page.goto('/layanan/tautan/l-pti');
    await expect(main(page).locator('.sl-box')).toContainText(
      's.hmif.dev/Catatan_PTI',
    );
    await main(page).getByRole('button', { name: 'Ubah nama pendek' }).click();
    const name = nameField(main(page));
    await name.fill('Catatan_PTI_2026');
    await name.press('Enter');
    await expect(
      main(page).getByText('Hanya huruf, angka, dan tanda hubung'),
    ).toBeVisible();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls('PUT /api/short-links/:id/name')).toHaveLength(0);
    // Escape leaves the editor; the name stays.
    await name.press('Escape');
    await expect(
      main(page).getByRole('button', { name: 'Ubah nama pendek' }),
    ).toBeFocused();
  });

  test('delete a link: it says what stops working, and its name is never given out again', async ({
    page,
    api,
  }, testInfo) => {
    await writes(api);
    await page.goto('/layanan/tautan/l-kalkulus');
    await main(page).getByRole('button', { name: 'Hapus tautan' }).click();
    const d = page.getByRole('alertdialog', {
      name: 'Hapus s.hmif.dev/catatan-kalkulus-1b?',
    });
    await expect(d).toContainText(
      'Alamat ini berhenti bekerja, termasuk yang sudah dibagikan atau dicetak. Sudah dibuka 742 kali. Tidak bisa dibatalkan, dan namanya tidak bisa dipakai lagi.',
    );
    await expect(d.getByRole('button', { name: 'Batal' })).toBeFocused();
    await strictGates(page, testInfo, 'link-delete', null);
    await d.getByRole('button', { name: 'Hapus tautan' }).click();
    await expect(page).toHaveURL(/\/layanan\/tautan$/);
    await expect(toastText(page, 'Tautan dihapus.')).toBeVisible();
    expect(api.calls('DELETE /api/short-links/:id')).toHaveLength(1);
    await expect(rows(page)).toHaveCount(5);
    await makeButton(page).click();
    await nameField(sheet(page)).fill('Catatan-Kalkulus-1b');
    await expect(
      sheet(page).getByText('Nama ini sudah pernah dipakai'),
    ).toBeVisible();
  });

  test('a form’s link is in its maker’s list, marked Form, and only opens the form', async ({
    page,
  }, testInfo) => {
    test.slow();
    await page.goto('/layanan/tautan');
    const form = rows(page).filter({ hasText: 'makrab-2026' });
    await expect(form).toContainText('Form');
    await expect(form).toContainText('Daftar Makrab HMIF 2026');
    await form.click();
    await expect(main(page)).toContainText('Form “Daftar Makrab HMIF 2026”');
    await expect(main(page).getByRole('button', { name: /^Ubah/ })).toHaveCount(
      0,
    );
    await expect(
      main(page).getByRole('button', { name: 'Hapus tautan' }),
    ).toHaveCount(0);
    await expect(
      main(page).getByRole('link', { name: 'Buka formnya' }),
    ).toHaveAttribute('href', '/kelola/form/makrab');
    await strictGates(page, testInfo, 'link-form', 'Layanan');
  });

  test('161 links come 50 at a time', async ({ page }) => {
    await page.goto('/layanan/tautan');
    await expect(rows(page)).toHaveCount(50);
    const more = main(page).getByRole('button', { name: /^Tampilkan 50 lagi/ });
    await expect(more).toHaveText('Tampilkan 50 lagi dari 112');
    await more.click();
    await expect(rows(page)).toHaveCount(100);
    await expect(more).toHaveText('Tampilkan 50 lagi dari 62');
  });
});

test.describe('Tautan pendek, states', () => {
  test('no links yet: make one or take old ones', async ({
    page,
    db,
  }, testInfo) => {
    db.shortLinks = db.shortLinks.filter((l) => l.owner !== db.me!.nim);
    await page.goto('/layanan/tautan');
    await expect(
      main(page).getByRole('heading', { name: 'Belum ada tautan' }),
    ).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Buat tautan' }),
    ).toBeVisible();
    await expect(
      main(page).getByRole('link', { name: 'Ambil tautan lama' }),
    ).toHaveAttribute('href', '/layanan/tautan/ambil');
    await strictGates(page, testInfo, 'links-empty', 'Layanan');
  });

  test('loading, then a failed load with Coba lagi', async ({ page, api }) => {
    api.on('GET /api/short-links', reply.hang());
    await page.goto('/layanan/tautan');
    await expect(
      page.getByRole('status', { name: 'Memuat tautanmu…' }),
    ).toBeVisible();
    api.on('GET /api/short-links', reply.status(503, { error: 'down' }));
    await page.reload();
    await expect(main(page).getByText('Tautanmu gagal dimuat.')).toBeVisible();
  });

  test('once claiming has ended, no way into it shows, and its page says so', async ({
    page,
    db,
  }) => {
    db.shortLinkClaim = { open: false, until: null };
    await page.goto('/layanan/tautan');
    await expect(rows(page)).toHaveCount(6);
    await expect(
      main(page).getByRole('link', { name: /Ambil tautan/ }),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Ambil tautan/ })).toHaveCount(
      0,
    );
    await page.goto('/layanan/tautan/ambil');
    await expect(
      main(page).getByText('Pengambilan tautan lama sudah berakhir.'),
    ).toBeVisible();
  });

  test('a push after an admin moved the link opens a page that says so, once, and leads to the list', async ({
    page,
    db,
  }, testInfo) => {
    db.shortLinks = db.shortLinks.filter((l) => l.id !== 'l-piket');
    db.shortLinkLandings['l-piket'] = {
      state: 'moved',
      name: 'jadwal-piket-sekre',
      movedTo: 'Bima Santoso',
    };
    await page.goto('/layanan/tautan/l-piket');
    await expect(
      main(page).getByRole('heading', { name: 'Tautan ini sudah dipindahkan' }),
    ).toBeVisible();
    await expect(main(page)).toContainText(
      's.hmif.dev/jadwal-piket-sekre sekarang milik Bima Santoso. Alamatnya tetap bisa dibuka.',
    );
    await strictGates(page, testInfo, 'push-moved-open', 'Layanan');
    await main(page).getByRole('link', { name: 'Lihat tautanku' }).click();
    await expect(page).toHaveURL(/\/layanan\/tautan$/);
    await expect(rows(page)).toHaveCount(5);
  });

  test('a push after an admin deleted the link', async ({
    page,
    db,
  }, testInfo) => {
    db.shortLinks = db.shortLinks.filter((l) => l.id !== 'l-pixelstudy');
    db.shortLinkLandings['l-pixelstudy'] = {
      state: 'deleted',
      name: 'PixelStudyGroup',
      movedTo: null,
    };
    await page.goto('/layanan/tautan/l-pixelstudy');
    await expect(
      main(page).getByRole('heading', { name: 'Tautan ini sudah dihapus' }),
    ).toBeVisible();
    await expect(main(page)).toContainText(
      's.hmif.dev/PixelStudyGroup tidak bisa dibuka lagi.',
    );
    await strictGates(page, testInfo, 'push-deleted-open', 'Layanan');
  });

  test('a link that isn’t yours is not found', async ({ page }) => {
    await page.goto('/layanan/tautan/l-lowongin');
    await expect(
      main(page).getByText('Tautan tidak ditemukan').first(),
    ).toBeVisible();
    await expect(
      main(page).getByRole('link', { name: 'Lihat tautanku' }),
    ).toBeVisible();
  });

  test('global search makes a link, and takes old ones once the list said claiming is open', async ({
    page,
  }) => {
    await page.goto('/layanan/tautan');
    await expect(rows(page)).toHaveCount(6);
    await navLink(page, 'Beranda').click();
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Pencarian global' });
    await palette
      .getByRole('combobox', { name: 'Cari di PIPS!' })
      .fill('tautan');
    await expect(
      palette.getByRole('option', { name: /Ambil tautan lama s\.hmif\.dev/ }),
    ).toBeVisible();
    await palette.getByRole('option', { name: /Buat tautan pendek/ }).click();
    await expect(page).toHaveURL(/\/layanan\/tautan$/);
    await expect(
      sheet(page).getByRole('heading', { name: 'Buat tautan pendek' }),
    ).toBeVisible();
  });
});

test.describe('Tautan tidak ditemukan', () => {
  test.use({ persona: null, signedIn: false });
  test('s.hmif.dev/<a name no link has>: a page of its own, no sign-in, then Buka PIPS!', async ({
    page,
  }, testInfo) => {
    await page.goto('/tautan-tidak-ditemukan?nama=makrab-2027');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tautan tidak ditemukan' }),
    ).toBeFocused();
    await expect(page.getByText('s.hmif.dev/makrab-2027')).toBeVisible();
    await expect(page.getByText('Periksa lagi ejaannya.')).toBeVisible();
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page).toHaveTitle('Tautan tidak ditemukan · PIPS!');
    await strictGates(page, testInfo, 'notfound', null);
    await page.getByRole('link', { name: 'Buka PIPS!' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
