/**
 * Tautan pendek: taking links from an old s.hmif.dev account (every answer, the lock, the window), and Kelola ›
 * Tautan pendek for admin (every link, Belum diambil, search, giving, moving and deleting someone's link, with the
 * line that says the owner is told). Phone, tablet and desktop, light and dark, with strict gates.
 */
import type { Page } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { isPhone } from '../support/app';
import { defaultHandlers } from '../support/handlers';
import { reply, type ApiMock } from '../support/mock';
import { toastText } from '../support/pengumuman';
import { shortLinkWrites } from '../support/short-links';
import { strictGates } from '../support/strict';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
/** Kelola is a sidebar item on desktop; on phones and tablets its pages light the tab you came from (none here). */
const kelolaLit = (t: TestInfo) => (isPhone(t) ? null : ('Kelola' as const));
const rows = (page: Page) =>
  main(page)
    .locator('li.sl-row')
    .locator('a')
    .filter({ hasText: 's.hmif.dev/' });

function writes(api: ApiMock) {
  for (const [k, h] of Object.entries(shortLinkWrites)) api.on(k, h);
}

async function lookUp(page: Page, login: string, password: string) {
  await main(page).getByLabel('Nama pengguna atau email').fill(login);
  await main(page).getByLabel('Kata sandi s.hmif.dev').fill(password);
  await main(page).getByRole('button', { name: 'Cari tautanku' }).click();
}

/**
 * Sends the password again and waits for the answer: a wrong one empties the field, so the next try is typed only
 * after it (otherwise a slow answer can empty a password typed for the next try).
 */
async function tryAgain(page: Page, password: string) {
  const pass = main(page).getByLabel('Kata sandi s.hmif.dev');
  await pass.fill(password);
  await main(page).getByRole('button', { name: 'Cari tautanku' }).click();
  await expect(pass).toHaveValue('');
}

test.describe('Ambil tautan lama', () => {
  test('the old username and password, the links that would move, then they are yours', async ({
    page,
    api,
  }, testInfo) => {
    writes(api);
    await page.goto('/layanan/tautan/ambil');
    await expect(page).toHaveTitle('Ambil tautan lama · PIPS!');
    await expect(main(page)).toContainText(
      'Untuk akun s.hmif.dev selain email mahasiswa. Bisa sampai 1 Maret 2027.',
    );
    await expect(main(page)).toContainText('Kata sandi ini tidak disimpan.');
    await strictGates(page, testInfo, 'claim', 'Layanan');
    await main(page).getByRole('button', { name: 'Cari tautanku' }).click();
    await expect(main(page).getByRole('alert')).toHaveText(
      'Isi nama pengguna dan kata sandinya',
    );
    await expect(
      main(page).getByLabel('Nama pengguna atau email'),
    ).toBeFocused();

    // The email the old account used finds it too.
    await lookUp(page, 'Nadia.Putri@example.com', 'rahasia');
    const heading = main(page).getByRole('heading', {
      name: '4 tautan ini akan jadi milikmu',
    });
    await expect(heading).toBeFocused();
    await expect(main(page)).toContainText('Dari akun lama nadia.putri.');
    await expect(main(page).locator('.sl-claim-list li')).toHaveCount(4);
    await strictGates(page, testInfo, 'claim-found', 'Layanan');
    await main(page).getByRole('button', { name: 'Jadikan milikku' }).click();
    expect(api.calls('POST /api/short-links/claim')[0]?.body).toEqual({
      token: 'claim:nadia.putri',
    });
    await expect(
      main(page).getByRole('heading', { name: '4 tautan sekarang milikmu' }),
    ).toBeFocused();
    await strictGates(page, testInfo, 'claim-done', 'Layanan');
    await main(page).getByRole('button', { name: 'Lihat tautanku' }).click();
    await expect(page).toHaveURL(/\/layanan\/tautan$/);
    await expect(rows(page)).toHaveCount(10);
    // The claimed links are washed gold once.
    await expect(
      main(page)
        .locator('li.sl-row.sl-new')
        .filter({ hasText: 'PIXEL-OSKM-Kel12' }),
    ).toHaveCount(1);
  });

  test('wrong passwords: the tries left from the third, then 15 minutes locked', async ({
    page,
    api,
  }, testInfo) => {
    writes(api);
    await page.goto('/layanan/tautan/ambil');
    const alert = main(page).getByRole('alert');
    const pass = main(page).getByLabel('Kata sandi s.hmif.dev');
    await lookUp(page, 'nadia.putri', 'salah');
    await expect(alert).toHaveText(
      'Nama pengguna atau kata sandi tidak cocok.',
    );
    await expect(pass).toHaveValue('');
    await expect(pass).toBeFocused();
    await tryAgain(page, 'salah');
    await expect(alert).toHaveText(
      'Nama pengguna atau kata sandi tidak cocok.',
    );
    await tryAgain(page, 'salah');
    await expect(alert).toHaveText(
      'Nama pengguna atau kata sandi tidak cocok. Sisa 2 percobaan.',
    );
    await expect(pass).toHaveAttribute('aria-invalid', 'true');
    await strictGates(page, testInfo, 'claim-wrong', 'Layanan');
    for (let i = 0; i < 2; i++) await tryAgain(page, 'salah');
    await expect(alert).toHaveText(
      'Terlalu banyak percobaan. Coba lagi pukul 13.50.',
    );
    const go = main(page).getByRole('button', { name: 'Cari tautanku' });
    await expect(go).toHaveAttribute('aria-disabled', 'true');
    const sent = api.calls('POST /api/short-links/claim/lookup').length;
    await pass.fill('rahasia');
    await go.click({ force: true });
    expect(api.calls('POST /api/short-links/claim/lookup')).toHaveLength(sent);
    await strictGates(page, testInfo, 'claim-locked', 'Layanan');
  });

  test('when the window can’t be read, the page says so with Coba lagi instead of loading for good', async ({
    page,
    api,
  }) => {
    api.on('GET /api/short-links', reply.status(503, { error: 'down' }));
    await page.goto('/layanan/tautan/ambil');
    await expect(main(page).getByText('Tautanmu gagal dimuat.')).toBeVisible();
    api.on('GET /api/short-links', (req) =>
      defaultHandlers['GET /api/short-links'](req),
    );
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(
      main(page).getByLabel('Nama pengguna atau email'),
    ).toBeVisible();
  });

  test('a 429 without a time is the service being busy, not a lock', async ({
    page,
    api,
  }) => {
    api.on(
      'POST /api/short-links/claim/lookup',
      reply.status(429, { error: 'Too many requests' }),
    );
    await page.goto('/layanan/tautan/ambil');
    await lookUp(page, 'nadia.putri', 'rahasia');
    await expect(main(page).getByRole('alert')).toHaveText(
      'Sedang sibuk. Coba lagi sebentar lagi.',
    );
    await expect(
      main(page).getByRole('button', { name: 'Cari tautanku' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
  });

  for (const [login, heading, text, name] of [
    [
      'arkav.panitia',
      'Tautan akun ini sudah diambil',
      'Diambil anggota lain hari ini pukul 09.12. Kalau bukan kamu, hubungi admin HMIF.',
      'claim-taken',
    ],
    ['nadiaputri07', 'Akun ini tidak punya tautan', '', 'claim-empty'],
    [
      '13525945@std.stei.itb.ac.id',
      'Tautan akun ini sudah ada di daftarmu',
      '',
      'claim-mine',
    ],
    [
      'ketua.lama',
      'Akun ini memakai verifikasi dua langkah.',
      'Minta admin HMIF memindahkan tautanmu.',
      'claim-two-factor',
    ],
  ] as const) {
    test(`${name}: says so, never who, and offers another account`, async ({
      page,
      api,
    }, testInfo) => {
      writes(api);
      await page.goto('/layanan/tautan/ambil');
      await lookUp(page, login, 'rahasia');
      await expect(
        main(page).getByRole('heading', { name: heading }),
      ).toBeFocused();
      if (text) await expect(main(page)).toContainText(text);
      await expect(main(page)).not.toContainText('Kevin');
      await strictGates(page, testInfo, name, 'Layanan');
      await main(page).getByRole('button', { name: 'Coba akun lain' }).click();
      await expect(
        main(page).getByLabel('Nama pengguna atau email'),
      ).toBeVisible();
    });
  }

  test('someone took the account first, or the window closed while looking', async ({
    page,
    api,
  }) => {
    writes(api);
    api.on(
      'POST /api/short-links/claim',
      reply.status(409, { error: 'Claimed first' }),
    );
    await page.goto('/layanan/tautan/ambil');
    await lookUp(page, 'panitia.semnas', 'rahasia');
    await main(page).getByRole('button', { name: 'Jadikan milikku' }).click();
    await expect(main(page).getByRole('alert')).toHaveText(
      'Tautan akun ini baru saja diambil anggota lain.',
    );
    api.on(
      'POST /api/short-links/claim',
      reply.status(410, { error: 'Ended' }),
    );
    await main(page).getByRole('button', { name: 'Jadikan milikku' }).click();
    await expect(
      main(page).getByText('Pengambilan tautan lama sudah berakhir.'),
    ).toBeVisible();
  });
});

test.describe('Kelola › Tautan pendek', () => {
  test.use({ persona: 'pengurus' });

  test('every link with its holder; Belum diambil with the old accounts; search by owner', async ({
    page,
  }, testInfo) => {
    await page.goto(isPhone(testInfo) ? '/profil' : '/kelola');
    if (isPhone(testInfo))
      await main(page)
        .getByRole('link', { name: /^Kelola/ })
        .click();
    const row = main(page).getByRole('link', { name: /^Tautan pendek/ });
    await expect(row).toContainText('Semua tautan s.hmif.dev');
    await row.click();
    await expect(page).toHaveURL(/\/kelola\/tautan$/);
    await expect(main(page).getByRole('status').first()).toHaveText(
      '191 tautan',
    );
    await expect(rows(page)).toHaveCount(50);
    await expect(rows(page).filter({ hasText: 'LowonginAja!' })).toHaveCount(0);
    await strictGates(page, testInfo, 'admin-all', kelolaLit(testInfo));
    await main(page).getByRole('radio', { name: 'Belum diambil' }).check();
    await expect(main(page).getByRole('status').first()).toHaveText(
      '10 tautan dari 5 akun lama',
    );
    await expect(rows(page).first()).toContainText('Belum diambil');
    await strictGates(page, testInfo, 'admin-old', kelolaLit(testInfo));
    await main(page).getByRole('radio', { name: 'Semua' }).check();
    await main(page).getByRole('searchbox').fill('aulia');
    await expect(main(page).getByRole('status').first()).toHaveText('3 tautan');
    await expect(rows(page).filter({ hasText: 'LowonginAja!' })).toContainText(
      'Aulia Rahma',
    );
  });

  test('a link nobody has taken: Berikan ke anggota, with the old account’s other links', async ({
    page,
    api,
  }, testInfo) => {
    writes(api);
    await page.goto('/kelola/tautan/l-semnas');
    const facts = main(page).locator('.sl-facts');
    await expect(facts).toContainText('Belum diambil');
    await expect(facts).toContainText('Akun lama panitia.semnas');
    await strictGates(page, testInfo, 'admin-link-old', kelolaLit(testInfo));
    await main(page)
      .getByRole('button', { name: 'Berikan ke anggota' })
      .click();
    const d = page.getByRole('dialog', {
      name: 'Berikan s.hmif.dev/SemnasIF25',
    });
    await d
      .getByRole('searchbox', { name: 'Cari anggota: nama atau NIM' })
      .fill('farh');
    await d.getByRole('button', { name: /Farhan Akbar/ }).click();
    await expect(d.getByText('Dipilih')).toBeVisible();
    const along = d.getByRole('checkbox', {
      name: 'Juga 2 tautan lain dari akun lama panitia.semnas',
    });
    await expect(along).toBeChecked();
    await expect(d).not.toContainText('diberi tahu');
    await strictGates(page, testInfo, 'admin-give', null);
    await d.getByRole('button', { name: 'Berikan', exact: true }).click();
    expect(api.calls('POST /api/short-links/:id/give')[0]?.body).toEqual({
      nim: '13525003',
      withAccount: true,
    });
    await expect(
      toastText(page, '3 tautan sekarang milik Farhan Akbar.'),
    ).toBeVisible();
    await expect(facts).toContainText('Farhan Akbar');
  });

  test('moving and deleting a member’s link says the member will be told', async ({
    page,
    api,
  }, testInfo) => {
    writes(api);
    await page.goto('/kelola/tautan/l-piket');
    await expect(main(page).locator('.sl-facts')).toContainText('Nadia Putri');
    await main(page).getByRole('button', { name: 'Pindahkan' }).click();
    const d = page.getByRole('dialog', {
      name: 'Pindahkan s.hmif.dev/jadwal-piket-sekre',
    });
    await expect(d).toContainText(
      'Nadia Putri, pemiliknya sekarang, akan diberi tahu lewat notifikasi.',
    );
    const go = d.getByRole('button', { name: 'Pindahkan', exact: true });
    await expect(go).toHaveAttribute('aria-disabled', 'true');
    await d.getByRole('searchbox').fill('bima');
    await d.getByRole('button', { name: /Bima Santoso/ }).click();
    await strictGates(page, testInfo, 'admin-move', null);
    await go.click();
    await expect(
      toastText(
        page,
        's.hmif.dev/jadwal-piket-sekre sekarang milik Bima Santoso.',
      ),
    ).toBeVisible();

    await page.goto('/kelola/tautan/l-pixelstudy');
    await main(page).getByRole('button', { name: 'Hapus tautan' }).click();
    const del = page.getByRole('alertdialog');
    await expect(del).toContainText(
      'Nadia Putri, pemiliknya, akan diberi tahu lewat notifikasi.',
    );
    await strictGates(page, testInfo, 'admin-delete', null);
    await del.getByRole('button', { name: 'Hapus tautan' }).click();
    await expect(page).toHaveURL(/\/kelola\/tautan$/);
    expect(api.calls('DELETE /api/short-links/:id')).toHaveLength(1);
  });

  test('an old name that breaks today’s rule can be edited like any other', async ({
    page,
  }, testInfo) => {
    await page.goto('/kelola/tautan/l-lowongin');
    await expect(main(page).locator('.sl-box')).toContainText(
      's.hmif.dev/LowonginAja!',
    );
    await expect(main(page).locator('.sl-facts')).toContainText('Aulia Rahma');
    await expect(
      main(page).getByRole('button', { name: 'Ubah nama pendek' }),
    ).toBeVisible();
    await strictGates(page, testInfo, 'admin-link', kelolaLit(testInfo));
  });
});

test.describe('Kelola › Tautan pendek for a member', () => {
  test('is not there: the page sends a member without admin on to Layanan', async ({
    page,
  }) => {
    await page.goto('/kelola/tautan');
    await expect(page).toHaveURL(/\/layanan$/);
  });
});
