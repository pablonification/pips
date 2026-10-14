/**
 * F2 (brief step 14): each role sees exactly its own tools, and a member none (SPEC "Kelola and role-aware UI",
 * P0-B's capability map). Nadia's account with only the role under test (`roles: { only: [...] }`), at phone and
 * desktop: Kelola's rows, Kalender's Tambah acara and which kind it adds, Info Lomba's Tambah lomba and Testi
 * Matkul's Tambah testimoni.
 */
import type { Page } from '@playwright/test';
import { layoutOf } from '../support/app';
import { expect, test } from '../support/test';

interface Expect {
  kelola: string[];
  acara: 'Tambah acara Akademik' | 'Tambah acara Himpunan' | null;
  lomba: boolean;
  testi: boolean;
}

const MATRIX: Record<string, { roles: string[]; want: Expect }> = {
  'no roles': {
    roles: [],
    want: { kelola: [], acara: null, lomba: false, testi: false },
  },
  akademik: {
    roles: ['akademik'],
    want: {
      kelola: ['Tambah acara Akademik'],
      acara: 'Tambah acara Akademik',
      lomba: false,
      testi: true,
    },
  },
  ring1: {
    roles: ['ring1'],
    want: {
      kelola: [],
      acara: 'Tambah acara Himpunan',
      lomba: false,
      testi: false,
    },
  },
  cnc: {
    roles: ['cnc'],
    want: { kelola: [], acara: null, lomba: true, testi: false },
  },
  admin: {
    roles: ['admin'],
    want: {
      kelola: ['Live Counting & Rekap Form', 'Data SPARTA Magang'],
      acara: null,
      lomba: false,
      testi: false,
    },
  },
  peoplemanage: {
    roles: ['peoplemanage'],
    want: {
      kelola: ['Data SPARTA Magang'],
      acara: null,
      lomba: false,
      testi: false,
    },
  },
  curhatadmin: {
    roles: ['curhatadmin'],
    want: { kelola: ['Curhat Yuk!'], acara: null, lomba: false, testi: false },
  },
};

/** Kelola's rows as the hub lists them, or none when Kelola sends the member away. */
async function kelolaRows(page: Page): Promise<string[]> {
  await page.goto('/kelola');
  await expect(page.locator('h1:visible')).toHaveCount(1);
  if (!/\/kelola/.test(new URL(page.url()).pathname)) return [];
  const main = page.locator('main');
  const names: string[] = [];
  for (const label of [
    'Live Counting & Rekap Form',
    'Data SPARTA Magang',
    'Tambah acara Akademik',
    'Curhat Yuk!',
  ])
    if (
      await main
        .getByRole('link', {
          name: new RegExp(`^${label.replace(/[&!]/g, '\\$&')}`),
        })
        .count()
    )
      names.push(label);
  return names;
}

for (const [name, { roles, want }] of Object.entries(MATRIX))
  test.describe(name, () => {
    test.use({ persona: 'anggota', roles: { only: roles } });
    test(`${name}: exactly its own tools`, async ({ page }, testInfo) => {
      test.skip(
        !/^qa-(phone|desktop)-light$/.test(testInfo.project.name),
        'phone and desktop, light',
      );
      expect(await kelolaRows(page)).toEqual(want.kelola);
      // Kelola in the navigation only with a tool in it (the sidebar on desktop, Layanan's last group on touch).
      if (layoutOf(testInfo) === 'desktop')
        await expect(
          page
            .getByRole('navigation', { name: 'Navigasi utama' })
            .getByRole('link', { name: /^Kelola/ }),
        ).toHaveCount(want.kelola.length ? 1 : 0);

      await page.goto('/kalender');
      await expect(page.locator('h1:visible')).toHaveCount(1);
      const tambah = page
        .getByRole('button', { name: 'Tambah acara' })
        .locator('visible=true');
      if (!want.acara) await expect(tambah).toHaveCount(0);
      else {
        await tambah.first().click();
        await expect(
          page.getByRole('dialog', { name: want.acara }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
      }

      await page.goto('/layanan/lomba');
      await expect(page.locator('h1:visible')).toHaveCount(1);
      await expect(
        page
          .getByRole('button', { name: 'Tambah lomba' })
          .locator('visible=true'),
      ).toHaveCount(want.lomba ? 1 : 0);

      await page.goto('/layanan/testi/teknik-informatika/3/course-IF2110');
      await expect(
        page.getByRole('heading', { name: /Algoritma|IF2110/ }).first(),
      ).toBeVisible();
      await expect(
        page
          .getByRole('button', { name: 'Tambah testimoni' })
          .locator('visible=true'),
      ).toHaveCount(want.testi ? 1 : 0);
    });
  });
