/**
 * Layanan (P1-C): the registry's groups and rows in order, the badges, Kelola last for pengurus, internal links and
 * the external services (a new tab over https), with no search box.
 */
import type { Page } from '@playwright/test';
import { layoutOf } from '../support/app';
import { reply } from '../support/mock';
import { strictGates } from '../support/strict';
import { expect, test } from '../support/test';

const main = (page: Page) => page.getByRole('main');
const groupTitles = (page: Page) =>
  main(page).getByRole('heading', { level: 2 }).allTextContents();
const rowNames = (page: Page) =>
  main(page).locator('.g-svc-row .t-sub').allTextContents();
const row = (page: Page, name: string | RegExp) =>
  main(page).getByRole('link', { name });

const MEMBER_ROWS = [
  'Ding Dong',
  'Testi Matkul',
  'NIM Finder',
  'Curhat Yuk!',
  'Form',
  'Info Lomba',
  'Beasiswa',
  'LowonginAja!',
  'Bayar Kas!',
  'Surat & Proposal',
];

test.describe('Nadia', () => {
  test('groups and rows in order with descriptions and badges; no Kelola, no search box', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan');
    await expect(
      page
        .getByRole('heading', { level: 1, name: 'Layanan' })
        .locator('visible=true'),
    ).toBeVisible();
    await expect(page).toHaveTitle('Layanan · PIPS!');
    await expect
      .poll(() => groupTitles(page))
      .toEqual(['Kuliah', 'Teman dan himpunan', 'Kesempatan', 'Administrasi']);
    expect(await rowNames(page)).toEqual(MEMBER_ROWS);
    await expect(row(page, /^Ding Dong/)).toContainText(
      'Folder materi mata kuliahmu semester ini',
    );
    // Badges as the prototype: Curhat's unread count by name, Form's open forms as a tag.
    await expect(row(page, /^Curhat Yuk!/)).toHaveAccessibleName(
      /1 pesan baru/,
    );
    await expect(row(page, /^Form/)).toContainText('1 belum diisi');
    await expect(main(page).getByRole('searchbox')).toHaveCount(0);
    await expect(main(page).getByText('Kelola')).toHaveCount(0);
    // Two columns on desktop, one below.
    const a = (await row(page, /^Ding Dong/).boundingBox())!;
    const b = (await row(page, /^NIM Finder/).boundingBox())!;
    if (layoutOf(testInfo) === 'desktop')
      expect(b.x).toBeGreaterThan(a.x + a.width);
    else expect(b.x).toBe(a.x);
    await strictGates(page, testInfo, 'layanan-nadia', 'Layanan');
  });

  test('internal rows link to their services', async ({ page }) => {
    await page.goto('/layanan');
    const expected: [string, string][] = [
      ['Ding Dong', '/layanan/dingdong'],
      ['Testi Matkul', '/layanan/testi'],
      ['NIM Finder', '/layanan/nim'],
      ['Curhat Yuk!', '/layanan/curhat'],
      ['Form', '/layanan/form'],
      ['Info Lomba', '/layanan/lomba'],
    ];
    for (const [name, href] of expected)
      await expect(
        row(page, new RegExp(`^${name.replace('!', '\\!')}`)),
      ).toHaveAttribute('href', href);
    await row(page, /^NIM Finder/).click();
    await expect(page).toHaveURL(/\/layanan\/nim$/);
  });

  test('external rows open s.hmif.dev over https in a new tab, and say so', async ({
    page,
  }) => {
    await page.goto('/layanan');
    const external: [string, string][] = [
      ['Beasiswa', 'https://s.hmif.dev/MadingBeasiswa'],
      ['LowonginAja!', 'https://s.hmif.dev/LowonginAja!'],
      ['Bayar Kas!', 'https://s.hmif.dev/BayarKasHMIF'],
      ['Surat & Proposal', 'https://s.hmif.dev/LayananAdministrasiHMIF2526'],
    ];
    for (const [name, href] of external) {
      const link = row(page, new RegExp(`^${name.replace(/[!&]/g, '\\$&')}`));
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAccessibleName(/\(situs luar, tab baru\)$/);
      // No destination text on the row.
      await expect(link).not.toContainText('s.hmif.dev');
    }
    // Stand in for the external site, so the test never leaves this machine; PIPS! stays in its own tab.
    await page.context().route('https://s.hmif.dev/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Mading Beasiswa</title>',
      }),
    );
    const [tab] = await Promise.all([
      page.context().waitForEvent('page'),
      row(page, /^Beasiswa/).click(),
    ]);
    await expect(tab).toHaveURL('https://s.hmif.dev/MadingBeasiswa');
    await expect(page).toHaveURL(/\/layanan$/);
    await tab.close();
  });

  test('no badges while their counts load or when they fail', async ({
    page,
    api,
  }) => {
    api.on('GET /api/curhat/chatrooms/unread', reply.hang());
    api.on('GET /api/form', reply.status(500));
    await page.goto('/layanan');
    await expect.poll(() => rowNames(page)).toEqual(MEMBER_ROWS);
    await page.waitForTimeout(300);
    await expect(row(page, /^Curhat Yuk!/)).not.toHaveAccessibleName(
      /pesan baru/,
    );
    await expect(row(page, /^Form/)).not.toContainText('belum diisi');
  });

  test.describe('before Magang SPARTA closed', () => {
    test.use({ now: '2026-08-20T09:00:00+07:00' });
    test('it shows in Kesempatan; under today’s date it is hidden', async ({
      page,
    }) => {
      await page.goto('/layanan');
      await expect.poll(() => rowNames(page)).toContain('Magang SPARTA');
      await expect(row(page, /^Magang SPARTA/)).toHaveAttribute(
        'href',
        '/layanan/sparta',
      );
    });
  });
});

test.describe('Raka', () => {
  test.use({ persona: 'pengurus', push: 'on' });

  test('Kelola last, with his three tools', async ({ page }, testInfo) => {
    await page.goto('/layanan');
    await expect
      .poll(() => groupTitles(page))
      .toEqual([
        'Kuliah',
        'Teman dan himpunan',
        'Kesempatan',
        'Administrasi',
        'Kelola',
      ]);
    expect((await rowNames(page)).slice(-3)).toEqual([
      'Live Counting & Rekap Form',
      'Data SPARTA Magang',
      'Tambah acara Akademik',
    ]);
    await expect(row(page, /^Live Counting/)).toHaveAttribute(
      'href',
      '/kelola/live',
    );
    await expect(row(page, /^Data SPARTA Magang/)).toHaveAttribute(
      'href',
      '/kelola/sparta',
    );
    await expect(row(page, /^Tambah acara Akademik/)).toHaveAttribute(
      'href',
      '/kalender',
    );
    await expect(row(page, /^Data SPARTA Magang/)).toContainText(
      'Pilihan divisi magang angkatan 2025 · ditutup 23 Agu 2026',
    );
    await strictGates(page, testInfo, 'layanan-raka', 'Layanan');
  });
});
