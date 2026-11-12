/**
 * The form against the real API: Nadia opens the PIXEL form (the API's own copy, apps/api/src/db/seed/pixel-form-seed.ts,
 * which asks more than the pretend API's), answers every bagian, sends it, and the list marks it Sudah diisi. The
 * server takes one answer per member, so on a database where an earlier run already sent it, only the mark is checked.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support';

const main = (page: Page) => page.getByRole('main');
const card = (page: Page) =>
  main(page).getByRole('link', { name: /Form Analisis Kondisi PIXEL/ });
const check = (page: Page, name: string) =>
  page.getByRole('checkbox', { name, exact: true }).check();
const choose = (page: Page, name: string) =>
  page.getByRole('radio', { name, exact: true }).check();

/** One function per bagian, answering every required question and none that opens a follow-up. */
const sections: Array<[string, (page: Page) => Promise<void>]> = [
  [
    'Identitas',
    async (page) => {
      // Name and NIM come from her account.
      await expect(page.getByLabel('Hai dengan siapa di sini?')).toHaveValue(
        'Nadia Contoh Lestari',
      );
      await expect(page.getByLabel('Mau tau nim kamu dong')).toHaveValue(
        '13525901',
      );
      await choose(page, 'PIXEL');
      await choose(page, 'IF');
      await choose(page, 'IF K2');
    },
  ],
  [
    'Biasanya kamu suka kegiatan apa?',
    async (page) => {
      await check(page, 'Main game');
      await check(page, 'Makan bareng');
      await page
        .getByLabel(
          'Selama ikut kegiatan HMIF atau SPARTA, kegiatan atau momen apa yang paling kamu suka?',
        )
        .fill('Malam keakraban');
    },
  ],
  [
    'Kegiatan santai bareng HMIF',
    async (page) => {
      await check(page, 'Ada teman yang ikut');
      await page
        .getByLabel(
          'Supaya kamu nyaman, kegiatan santai HMIF sebaiknya dibuat seperti apa?',
        )
        .fill('Santai dan tidak terlalu ramai');
      await check(page, 'Bisa refreshing');
      await page
        .getByLabel(
          'Kapan kamu biasanya punya waktu untuk ikut kegiatan santai HMIF?',
        )
        .fill('Jumat malam');
    },
  ],
  [
    'Jalan-jalan bareng HMIF',
    async (page) => {
      await check(page, 'Menikmati pemandangan alam');
      await check(page, 'Tempat tujuannya menarik');
      await check(page, 'Pikiran lebih segar');
      await choose(page, 'Tertarik');
      await choose(page, 'Nonton Bareng PIPS');
      await choose(page, 'Career');
    },
  ],
  [
    'Feedback Welcoming Party 2025',
    async (page) => {
      await choose(page, '4');
    },
  ],
];

test('Nadia answers the PIXEL form, sends it, and it is marked as answered', async ({
  page,
  problems,
}) => {
  await page.goto('/layanan/form');
  await expect(card(page)).toBeVisible();
  if (!(await card(page).textContent())?.includes('Sudah diisi')) {
    await expect(card(page)).toContainText('Isi sekarang');
    await card(page).click();
    for (const [title, answer] of sections) {
      await expect(
        page.getByRole('heading', { level: 2, name: title }),
      ).toBeVisible();
      await answer(page);
      await page.getByRole('button', { name: 'Lanjut' }).click();
    }
    await expect(
      page.getByRole('heading', { name: 'Periksa jawabanmu' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Kirim jawaban' }).click();
    const sent = page.waitForResponse(
      (r) =>
        /\/api\/form\/[^/]+\/response$/.test(r.url()) &&
        r.request().method() === 'POST',
    );
    await page
      .getByRole('alertdialog', { name: 'Kirim jawaban?' })
      .getByRole('button', { name: 'Kirim', exact: true })
      .click();
    expect((await sent).status()).toBeLessThan(300);
    await expect(
      main(page).getByRole('heading', { name: 'Terima kasih sudah mengisi!' }),
    ).toBeVisible();
    await page.goto('/layanan/form');
  }
  await expect(card(page)).toContainText('Sudah diisi');
  void problems;
});
