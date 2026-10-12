import { checkGates } from '../support/audit';
import { visibleText } from '../support/app';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

import { formField as field, pixelSections } from '../support/flows';

test('the form list shows the PIXEL form as open', async ({
  page,
}, testInfo) => {
  await page.goto('/home/form');
  await expect(visibleText(page, 'Isi Sekarang')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Form Analisis Kondisi PIXEL' }),
  ).toBeVisible();
  await checkGates(page, testInfo, 'form-list');
});

test('a required question blocks the next section', async ({ page }) => {
  await page.goto('/home/form/pixel');
  await page.getByRole('button', { name: 'Selanjutnya' }).click();
  await expect(
    page.getByText('Pertanyaan ini wajib diisi').first(),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Identitas', level: 2 }),
  ).toBeVisible();
});

test('filling the PIXEL form section by section and sending it', async ({
  page,
  api,
  db,
}, testInfo) => {
  api.on('POST /api/form/:formId/response', writes.submitForm);
  await page.goto('/home/form/pixel');
  await expect(
    page.getByRole('heading', { name: 'Identitas', level: 2 }),
  ).toBeVisible();
  await checkGates(page, testInfo, 'form-step-1');
  await pixelSections[0](page);
  await page.getByRole('button', { name: 'Selanjutnya' }).click();

  // Section 2: "Other" reveals its follow-up question.
  await expect(
    page.getByRole('heading', {
      name: 'Biasanya kamu suka kegiatan apa?',
      level: 2,
    }),
  ).toBeVisible();
  const followUp = page.getByText(/^Sebutkan yang kamu maksud/);
  await expect(followUp).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Main game' }).check();
  await page.getByRole('checkbox', { name: 'Other' }).check();
  await expect(followUp).toBeVisible();
  await field(
    page,
    'Sebutkan yang kamu maksud. (Kalau belum punya jawaban pasti, isi tanda "-".)',
  )
    .getByRole('textbox')
    .fill('Main musik');
  await field(
    page,
    'Selama ikut kegiatan HMIF atau SPARTA, kegiatan atau momen apa yang paling kamu suka?',
  )
    .getByRole('textbox')
    .fill('Malam keakraban');
  await checkGates(page, testInfo, 'form-step-2');
  await page.getByRole('button', { name: 'Selanjutnya' }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Kegiatan santai bareng HMIF',
      level: 2,
    }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Ada teman yang ikut' }).check();
  await field(
    page,
    'Kapan kamu biasanya punya waktu untuk ikut kegiatan santai HMIF?',
  )
    .getByRole('textbox')
    .fill('Jumat malam');
  await page.getByRole('button', { name: 'Selanjutnya' }).click();

  await expect(
    page.getByRole('heading', { name: 'Jalan-jalan bareng HMIF', level: 2 }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Tertarik', exact: true }).check();
  await page.getByRole('radio', { name: 'Nonton Bareng PIPS' }).check();
  await page.getByRole('button', { name: 'Selanjutnya' }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Feedback Welcoming Party 2025',
      level: 2,
    }),
  ).toBeVisible();
  await page.getByRole('radio', { name: '4', exact: true }).check();
  await checkGates(page, testInfo, 'form-step-5');
  await page.getByRole('button', { name: 'Kirim Jawaban' }).click();

  const confirm = page.getByRole('dialog', { name: 'Kirim Jawaban?' });
  await expect(confirm).toBeVisible();
  await checkGates(page, testInfo, 'form-confirm');
  await confirm.getByRole('button', { name: 'Ya, Kirim' }).click();
  await expect(visibleText(page, 'Terima kasih sudah mengisi!')).toBeVisible();

  const sent = api.calls('POST /api/form/pixel/response');
  expect(sent).toHaveLength(1);
  const answers = Object.fromEntries(
    (
      sent[0].body as { answers: { questionId: string; answer: unknown }[] }
    ).answers.map((a) => [a.questionId, a.answer]),
  );
  expect(answers).toMatchObject({
    q1: 'Nadia Putri',
    q2: '13525045',
    q4: 'IF',
    q6: ['Main game', 'Other'],
    q22: 'Main musik',
    q16: 'Tertarik',
    q29: '4',
  });
  expect(db.myResponses.pixel).toBeTruthy();
});

test('answers survive a reload as a draft on the device', async ({ page }) => {
  await page.goto('/home/form/pixel');
  await field(page, 'Hai dengan siapa di sini?')
    .getByRole('textbox')
    .fill('Nadia Putri');
  await page.getByRole('radio', { name: 'STI', exact: true }).check();
  await page.waitForTimeout(1_000); // the draft is saved after a short debounce
  await page.reload();
  await expect(
    field(page, 'Hai dengan siapa di sini?').getByRole('textbox'),
  ).toHaveValue('Nadia Putri');
  await expect(
    page.getByRole('radio', { name: 'STI', exact: true }),
  ).toBeChecked();
});

test.describe('Raka, angkatan 2024', () => {
  test.use({ persona: 'pengurus' });

  test('Raka has no form to fill', async ({ page }, testInfo) => {
    await page.goto('/home/form');
    await expect(visibleText(page, 'Belum ada form untuk kamu')).toBeVisible();
    await checkGates(page, testInfo, 'form-empty');
  });
});
