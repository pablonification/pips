/** Steps through today's app shared by journeys and captures. */
import type { Page } from '@playwright/test';

/** Today's form fields have no accessible names; this finds a field by its question's visible text. */
export const formField = (page: Page, question: string) =>
  page
    .locator('div')
    .filter({ has: page.locator('label', { hasText: question }) })
    .filter({
      has: page.locator('input, textarea, [role=radiogroup], [role=checkbox]'),
    })
    .last();

/** The PIXEL form's answers used everywhere, one function per section. */
export const pixelSections: ((page: Page) => Promise<void>)[] = [
  async (page) => {
    await formField(page, 'Hai dengan siapa di sini?')
      .getByRole('textbox')
      .fill('Nadia Putri');
    await formField(page, 'Mau tau nim kamu dong')
      .getByRole('textbox')
      .fill('13525045');
    await page.getByRole('radio', { name: 'PIXEL' }).check();
    await page.getByRole('radio', { name: 'IF', exact: true }).check();
    await page.getByRole('radio', { name: 'IF K2' }).check();
  },
  async (page) => {
    await page.getByRole('checkbox', { name: 'Main game' }).check();
    await page.getByRole('checkbox', { name: 'Other' }).check();
    await formField(
      page,
      'Sebutkan yang kamu maksud. (Kalau belum punya jawaban pasti, isi tanda "-".)',
    )
      .getByRole('textbox')
      .fill('Main musik');
    await formField(
      page,
      'Selama ikut kegiatan HMIF atau SPARTA, kegiatan atau momen apa yang paling kamu suka?',
    )
      .getByRole('textbox')
      .fill('Malam keakraban');
  },
  async (page) => {
    await page.getByRole('checkbox', { name: 'Ada teman yang ikut' }).check();
    await formField(
      page,
      'Kapan kamu biasanya punya waktu untuk ikut kegiatan santai HMIF?',
    )
      .getByRole('textbox')
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

/** Fill sections 1…n of the PIXEL form, ending on section n + 1. */
export async function fillPixelUpTo(
  page: Page,
  sections: number,
): Promise<void> {
  for (let i = 0; i < sections; i++) {
    await page
      .getByRole('heading', { name: PIXEL_SECTION_TITLES[i], level: 2 })
      .waitFor();
    await pixelSections[i](page);
    if (i < PIXEL_SECTION_TITLES.length - 1)
      await page.getByRole('button', { name: 'Selanjutnya' }).click();
  }
}
