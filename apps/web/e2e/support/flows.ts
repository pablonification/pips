/** Steps through today's app shared by journeys and captures. */
import type { Page } from '@playwright/test';

/** A question of the PIXEL form by its label (P2-A: every field is labelled; groups are fieldsets with a legend). */
export const formField = (page: Page, question: string) =>
  page.locator('[data-qb]').filter({
    has: page.locator('label, legend').filter({ hasText: question }),
  });

/** The PIXEL form's answers used everywhere, one function per section. */
export const pixelSections: ((page: Page) => Promise<void>)[] = [
  async (page) => {
    await page.getByLabel('Hai dengan siapa di sini?').fill('Nadia Putri');
    await page.getByLabel('Mau tau nim kamu dong').fill('13525045');
    await page.getByRole('radio', { name: 'PIXEL' }).check();
    await page.getByRole('radio', { name: 'IF', exact: true }).check();
    await page.getByRole('radio', { name: 'IF K2' }).check();
  },
  async (page) => {
    await page.getByRole('checkbox', { name: 'Main game' }).check();
    await page.getByRole('checkbox', { name: 'Other' }).check();
    await page
      .getByLabel(
        'Sebutkan yang kamu maksud. (Kalau belum punya jawaban pasti, isi tanda "-".)',
      )
      .fill('Main musik');
    await page
      .getByLabel(
        'Selama ikut kegiatan HMIF atau SPARTA, kegiatan atau momen apa yang paling kamu suka?',
      )
      .fill('Malam keakraban');
  },
  async (page) => {
    await page.getByRole('checkbox', { name: 'Ada teman yang ikut' }).check();
    await page
      .getByLabel(
        'Kapan kamu biasanya punya waktu untuk ikut kegiatan santai HMIF?',
      )
      .fill('Jumat malam');
  },
  async (page) => {
    await page.getByRole('radio', { name: 'Tertarik', exact: true }).check();
    await page.getByRole('radio', { name: 'Nonton Bareng PIPS' }).check();
  },
  async (page) => {
    await page.getByRole('radio', { name: '4', exact: true }).check();
  },
];
export const PIXEL_SECTION_TITLES = [
  'Identitas',
  'Biasanya kamu suka kegiatan apa?',
  'Kegiatan santai bareng HMIF',
  'Jalan-jalan bareng HMIF',
  'Feedback Welcoming Party 2025',
];

/** Fill sections 1…n of the PIXEL form with Lanjut after each, ending on section n + 1 (the check page after 5). */
export async function fillPixelUpTo(
  page: Page,
  sections: number,
): Promise<void> {
  for (let i = 0; i < sections; i++) {
    await page
      .getByRole('heading', { name: PIXEL_SECTION_TITLES[i], level: 2 })
      .waitFor();
    await pixelSections[i](page);
    await page.getByRole('button', { name: 'Lanjut' }).click();
  }
}
