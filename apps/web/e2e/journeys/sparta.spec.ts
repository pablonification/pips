/**
 * Magang SPARTA for members (P2-A; no locked design, OPEN-QUESTIONS D4): closed now, with Nadia's draft read-only;
 * Raka's eligibility note; no entry point while closed; and next season's flow under a window override (the four
 * steps, four choices reordered by keyboard, a draft saved on every step, send and lock), a failed save, and a late
 * write answered 403. Every size and theme, strict gates. Set P2A_SHOTS=<dir> to also write the report's captures.
 */
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import type { Db } from '../fixtures/api';
import { audit, gateFailures } from '../support/audit';
import { layoutOf } from '../support/app';
import { reply } from '../support/mock';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

async function gates(page: Page, testInfo: TestInfo, name: string) {
  const a = await audit(page);
  await testInfo.attach(`gates-${name}.json`, {
    body: JSON.stringify(a, null, 2),
    contentType: 'application/json',
  });
  expect(gateFailures(a), name).toEqual([]);
  const dir = process.env.P2A_SHOTS;
  if (dir)
    await page.screenshot({
      path: path.join(
        dir,
        `${testInfo.project.name}-${page.viewportSize()!.width}-${name}.png`,
      ),
      fullPage: true,
    });
}

const main = (page: Page) => page.getByRole('main');
const heading = (page: Page, name: string) =>
  main(page).getByRole('heading', { name, level: 2 });
const lanjut = (page: Page) => page.getByRole('button', { name: 'Lanjut' });
const saved = (page: Page) => main(page).getByText('Draf tersimpan');

/** Next season: open from 1 Oktober to 31 Oktober 2026, 23.59 WIB; Nadia starts with nothing saved. */
function openSeason(db: Db, { keepDraft = false } = {}) {
  db.spartaWindow = {
    opensAt: '2026-09-30T17:00:00.000Z',
    closesAt: '2026-10-31T16:59:00.000Z',
  };
  if (!keepDraft)
    db.internshipSubmissions = db.internshipSubmissions.filter(
      (s) => s.userId !== db.me!.id,
    );
  // Two more divisions, so there are five to choose four from, with every kind of question the screen asks.
  const dept = db.internshipDepartments[1];
  dept.divisions = [
    ...(dept.divisions ?? []),
    {
      id: 'div-medkom',
      departmentId: dept.id,
      name: 'Media dan Komunikasi',
      quotaMin: 2,
      quotaIdeal: 3,
      quotaMax: 4,
      questions: [
        {
          id: 'mq1',
          label: 'Alat yang kamu kuasai',
          type: 'checkbox',
          options: ['Figma', 'Canva', 'Premiere'],
          required: true,
        },
        {
          id: 'mq2',
          label: 'Seberapa sering kamu membuat konten?',
          type: 'radio',
          options: ['Jarang', 'Sering'],
          required: false,
        },
      ],
      questionsRaw: 'Ceritakan karya terbaikmu.\nBoleh lampirkan tautan.',
      description: 'Mengelola media sosial HMIF.',
      order: 2,
    },
    {
      id: 'div-kastrat',
      departmentId: dept.id,
      name: 'Kajian Strategis',
      quotaMin: 2,
      quotaIdeal: 3,
      quotaMax: 4,
      questions: [
        {
          id: 'kq1',
          label: 'Isu yang paling kamu minati',
          type: 'select',
          options: ['Pendidikan', 'Teknologi'],
          required: true,
        },
      ],
      questionsRaw: null,
      description: 'Mengkaji isu kampus.',
      order: 3,
    },
  ];
}

/** From the start to Pertanyaan divisi: Info umum filled, the four divisions in their listed order. */
async function toQuestions(page: Page) {
  await page.getByRole('button', { name: /^(Mulai|Lanjutkan)$/ }).click();
  await page.getByLabel('Kelas').fill('K-02');
  await page.getByLabel('ID LINE').fill('nadia.putri');
  await lanjut(page).click();
  await lanjut(page).click();
  for (const name of [
    'Media dan Komunikasi',
    'Akademik',
    'Welfare',
    'Competition and Community',
  ])
    await page.getByRole('checkbox', { name }).check();
  await lanjut(page).click();
  await expect(heading(page, 'Pertanyaan divisi')).toBeFocused();
}

/** Pertanyaan divisi answered, then on to the check page. */
async function toReview(page: Page) {
  await toQuestions(page);
  await page.getByRole('checkbox', { name: 'Figma' }).check();
  await page
    .getByLabel('Ceritakan pengalamanmu mendengarkan teman.')
    .fill('Teman sekamar');
  await page
    .getByLabel('Kenapa kamu tertarik di Akademik?')
    .fill('Suka mengajar');
  await page.getByLabel('Lomba apa yang pernah kamu ikuti?').fill('Gemastik');
  await lanjut(page).click();
  await expect(heading(page, 'Periksa pilihanmu')).toBeFocused();
}

test('closed: the closing time, Nadia’s draft read-only, nothing to send', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/layanan/sparta');
  await expect(
    main(page).getByText('Pendaftaran ditutup Min, 23 Agu 2026 pukul 23.59'),
  ).toBeVisible();
  await expect(main(page).getByText('Belum dikirim')).toBeVisible();
  await expect(main(page).getByText('e2e.nadia')).toBeVisible();
  await expect(
    main(page)
      .getByText('Welfare and Academics')
      .or(main(page).getByText('Akademik', { exact: true })),
  ).not.toHaveCount(0);
  await expect(main(page).getByRole('button')).toHaveCount(0);
  await expect(page).toHaveTitle('Magang SPARTA · PIPS!');
  // A focused flow: no tab bar or rail on touch layouts.
  if (layoutOf(testInfo) !== 'desktop')
    await expect(
      page.getByRole('navigation', { name: 'Navigasi utama' }),
    ).toHaveCount(0);
  expect(api.calls('PUT /api/internship/submission')).toHaveLength(0);
  await gates(page, testInfo, 'sparta-closed');
});

test('closed at 320 px: nothing overflows @phone-only', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/layanan/sparta');
  await expect(main(page).getByText(/^Pendaftaran ditutup/)).toBeVisible();
  await gates(page, testInfo, 'sparta-closed');
});

test.describe('Raka, angkatan 2024', () => {
  test.use({ persona: 'pengurus' });

  test('a plain note on who can take part; the submission is never asked for', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/layanan/sparta');
    await expect(
      main(page).getByText('Magang SPARTA hanya untuk angkatan 2025'),
    ).toBeVisible();
    await expect(
      main(page).getByRole('link', { name: 'Kembali ke Layanan' }),
    ).toBeVisible();
    expect(api.calls('GET /api/internship/submission')).toHaveLength(0);
    expect(api.calls('GET /api/internship/window')).toHaveLength(1);
    await gates(page, testInfo, 'sparta-not-eligible');
    await page.setViewportSize({ width: 320, height: 720 });
    await gates(page, testInfo, 'sparta-not-eligible-320');
  });
});

test('no way in while closed: not in search; the old address still lands here', async ({
  page,
}) => {
  await page.goto('/layanan/form');
  await page.keyboard.press('ControlOrMeta+k');
  const palette = page.getByRole('dialog', { name: 'Pencarian global' });
  await palette.getByRole('combobox').fill('sparta');
  await expect(
    palette.getByRole('option', { name: /^Magang SPARTA/ }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.goto('/home/internship');
  await expect(page).toHaveURL(/\/layanan\/sparta$/);
  await expect(main(page).getByText(/^Pendaftaran ditutup/)).toBeVisible();
});

test('next season: the deadline and four steps, a draft on every step, four choices reordered by keyboard, send and lock', async ({
  page,
  api,
  db,
}, testInfo) => {
  openSeason(db);
  api.on('PUT /api/internship/submission', writes.saveSpartaDraft);
  api.on('POST /api/internship/submission/submit', writes.submitSparta);
  await page.goto('/layanan/sparta');
  await expect(
    main(page).getByText('Batas waktu Sab, 31 Okt 2026 pukul 23.59'),
  ).toBeVisible();
  await expect(main(page).getByRole('listitem')).toHaveText([
    'Info umum',
    'Penjelasan divisi',
    'Pilih divisi',
    'Pertanyaan divisi',
  ]);
  await gates(page, testInfo, 'sparta-start');
  await page.getByRole('button', { name: 'Mulai' }).click();

  // 1. Info umum: Kelas and ID LINE required.
  await expect(heading(page, 'Info umum')).toBeFocused();
  await expect(
    main(page).getByText('Langkah 1 dari 4 · Info umum'),
  ).toBeVisible();
  await lanjut(page).click();
  await expect(main(page).getByRole('alert')).toHaveText(
    'Masih ada pertanyaan wajib yang belum diisi.',
  );
  await expect(page.getByLabel('Kelas')).toBeFocused();
  await expect(page.getByLabel('Kelas')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(main(page).getByText('Pertanyaan ini wajib diisi')).toHaveCount(
    2,
  );
  await gates(page, testInfo, 'sparta-step-1-errors');
  await page.getByLabel('Kelas').fill('K-02');
  await page.getByLabel('ID LINE').fill('nadia.putri');
  await expect(main(page).getByText('Pertanyaan ini wajib diisi')).toHaveCount(
    0,
  );
  // Saved while typing.
  await expect(saved(page)).toBeVisible();
  const typed = api.calls('PUT /api/internship/submission').at(-1)!.body as {
    kelas: string;
    idLine: string;
    choices: unknown[];
  };
  expect(typed).toMatchObject({
    kelas: 'K-02',
    idLine: 'nadia.putri',
    choices: [],
  });
  await page.getByRole('button', { name: 'Tambah kesibukan' }).click();
  await page.getByLabel('Jabatan').fill('Staf');
  await lanjut(page).click();
  await expect(page.getByLabel('Organisasi', { exact: true })).toBeFocused();
  await page.getByLabel('Organisasi', { exact: true }).fill('Unit Robotika');
  await page.getByLabel('Periode').fill('2025/2026');
  await gates(page, testInfo, 'sparta-step-1');
  const beforeStep = api.calls('PUT /api/internship/submission').length;
  await lanjut(page).click();

  // 2. Penjelasan divisi; the step was saved.
  await expect(heading(page, 'Penjelasan divisi')).toBeFocused();
  await expect
    .poll(() => api.calls('PUT /api/internship/submission').length)
    .toBeGreaterThan(beforeStep);
  await expect(
    main(page).getByText('Mengelola media sosial HMIF.'),
  ).toBeVisible();
  await gates(page, testInfo, 'sparta-step-2');
  await lanjut(page).click();

  // 3. Pilih divisi: exactly four; a fifth can't be ticked; reorder by keyboard.
  await expect(heading(page, 'Pilih divisi')).toBeFocused();
  await lanjut(page).click();
  await expect(
    main(page).getByText('Pilih tepat 4 divisi.', { exact: true }),
  ).toBeVisible();
  for (const name of [
    'Akademik',
    'Welfare',
    'Competition and Community',
    'Media dan Komunikasi',
  ])
    await page.getByRole('checkbox', { name }).check();
  await expect(
    page.getByRole('checkbox', { name: 'Kajian Strategis' }),
  ).toBeDisabled();
  const prio = main(page).locator('ol li');
  await expect(prio).toHaveText([
    /Akademik/,
    /Welfare/,
    /Competition and Community/,
    /Media dan Komunikasi/,
  ]);
  // Media dan Komunikasi to the top, from the keyboard; focus stays with it.
  const up = page.getByRole('button', {
    name: /^Naikkan Media dan Komunikasi/,
  });
  await up.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: /^Naikkan Media dan Komunikasi/ }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(prio).toHaveText([
    /Media dan Komunikasi/,
    /Akademik/,
    /Welfare/,
    /Competition and Community/,
  ]);
  await expect(
    main(page)
      .getByRole('status')
      .filter({ hasText: 'Media dan Komunikasi sekarang prioritas 1.' }),
  ).toBeAttached();
  // At the top, Naikkan does nothing and focus moves to Turunkan.
  await expect(
    page.getByRole('button', { name: /^Turunkan Media dan Komunikasi/ }),
  ).toBeFocused();
  await page.getByRole('button', { name: /^Turunkan Akademik/ }).click();
  await expect(prio).toHaveText([
    /Media dan Komunikasi/,
    /Welfare/,
    /Akademik/,
    /Competition and Community/,
  ]);
  await gates(page, testInfo, 'sparta-step-3');
  await lanjut(page).click();

  // 4. Pertanyaan divisi: each chosen division's questions, in priority order.
  await expect(heading(page, 'Pertanyaan divisi')).toBeFocused();
  await expect(main(page).getByRole('heading', { level: 3 })).toHaveText([
    'Pilihan 1: Media dan Komunikasi',
    'Pilihan 2: Welfare',
    'Pilihan 3: Akademik',
    'Pilihan 4: Competition and Community',
  ]);
  await lanjut(page).click();
  await expect(page.getByRole('checkbox', { name: 'Figma' })).toBeFocused();
  await page.getByRole('checkbox', { name: 'Figma' }).check();
  await page.getByRole('checkbox', { name: 'Premiere' }).check();
  await page
    .getByLabel('Ceritakan pengalamanmu mendengarkan teman.')
    .fill('Teman sekamar');
  await page
    .getByLabel('Kenapa kamu tertarik di Akademik?')
    .fill('Suka mengajar');
  await page.getByLabel('Lomba apa yang pernah kamu ikuti?').fill('Gemastik');
  await gates(page, testInfo, 'sparta-step-4');
  await lanjut(page).click();

  // The check page, then the confirmation that the choices lock.
  await expect(heading(page, 'Periksa pilihanmu')).toBeFocused();
  await expect(main(page).getByText('Figma, Premiere')).toBeVisible();
  await expect(
    main(page).getByText('Staf, Unit Robotika, 2025/2026'),
  ).toBeVisible();
  await gates(page, testInfo, 'sparta-review');
  await page.getByRole('button', { name: 'Kirim pilihan' }).click();
  const confirm = page.getByRole('alertdialog', {
    name: 'Kirim pilihan divisi?',
  });
  await expect(confirm).toContainText('terkunci setelah dikirim');
  await confirm.getByRole('button', { name: 'Kirim', exact: true }).click();
  await expect(main(page).getByText('Sudah dikirim')).toBeVisible();
  await expect(
    page.getByText('Pilihan magang berhasil dikirim!'),
  ).toBeVisible();
  await expect(lanjut(page)).toHaveCount(0);
  await gates(page, testInfo, 'sparta-sent');

  const sent = api.calls('POST /api/internship/submission/submit')[0].body as {
    kelas: string;
    idLine: string;
    kesibukan: unknown[];
    choices: {
      divisionId: string;
      priorityOrder: number;
      answers: { questionId: string; answer: string }[];
    }[];
  };
  expect(sent.kelas).toBe('K-02');
  expect(sent.kesibukan).toEqual([
    { jabatan: 'Staf', organisasi: 'Unit Robotika', periode: '2025/2026' },
  ]);
  expect(sent.choices.map((c) => [c.divisionId, c.priorityOrder])).toEqual([
    ['div-medkom', 1],
    ['div-welfare', 2],
    ['div-akademik', 3],
    ['div-cnc', 4],
  ]);
  expect(sent.choices[0].answers).toEqual([
    { questionId: 'mq1', answer: 'Figma, Premiere' },
  ]);
  expect(
    db.internshipSubmissions.find((s) => s.userId === db.me!.id)?.isLocked,
  ).toBe(true);
  // Steps were saved on the way: at least one save per step left.
  expect(
    api.calls('PUT /api/internship/submission').length,
  ).toBeGreaterThanOrEqual(4);
});

test('next season with a draft: Lanjutkan, and the saved choices come back', async ({
  page,
  api,
  db,
}) => {
  openSeason(db, { keepDraft: true });
  api.on('PUT /api/internship/submission', writes.saveSpartaDraft);
  await page.goto('/layanan/sparta');
  await page.getByRole('button', { name: 'Lanjutkan' }).click();
  await expect(page.getByLabel('Kelas')).toHaveValue('IF K2');
  await lanjut(page).click();
  await lanjut(page).click();
  await expect(main(page).locator('ol li')).toHaveText([
    /Akademik/,
    /Welfare/,
    /Competition and Community/,
  ]);
});

test('a failed save keeps the answers, with Coba lagi', async ({
  page,
  api,
  db,
}, testInfo) => {
  openSeason(db);
  api.on('PUT /api/internship/submission', reply.status(503));
  await page.goto('/layanan/sparta');
  await page.getByRole('button', { name: 'Mulai' }).click();
  await page.getByLabel('Kelas').fill('K-03');
  const failed = main(page)
    .getByRole('alert')
    .filter({ hasText: 'Draf belum tersimpan.' });
  await expect(failed).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel('Kelas')).toHaveValue('K-03');
  await gates(page, testInfo, 'sparta-save-failed');
  api.on('PUT /api/internship/submission', writes.saveSpartaDraft);
  await failed.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(saved(page)).toBeVisible();
  expect(
    (
      api.calls('PUT /api/internship/submission').at(-1)!.body as {
        kelas: string;
      }
    ).kelas,
  ).toBe('K-03');
});

test('a late write answered 403 shows the closed state with nothing lost', async ({
  page,
  api,
  db,
}) => {
  openSeason(db);
  api.on('PUT /api/internship/submission', writes.saveSpartaDraft);
  await page.goto('/layanan/sparta');
  await page.getByRole('button', { name: 'Mulai' }).click();
  await page.getByLabel('Kelas').fill('K-04');
  await page.getByLabel('ID LINE').fill('nadia.late');
  await expect(saved(page)).toBeVisible();
  // The deadline passes on the server.
  db.spartaWindow = {
    opensAt: '2026-09-30T17:00:00.000Z',
    closesAt: '2026-10-08T06:00:00.000Z',
  };
  await lanjut(page).click();
  await expect(
    main(page).getByText('Pendaftaran ditutup Kam, 8 Okt 2026 pukul 13.00'),
  ).toBeVisible();
  await expect(main(page).getByText('K-04')).toBeVisible();
  await expect(main(page).getByText('nadia.late')).toBeVisible();
  await expect(lanjut(page)).toHaveCount(0);
  const last = api.calls('PUT /api/internship/submission').at(-1)!;
  expect(last).toBeTruthy();
});

test('each open step at 320 px: nothing overflows, the step line fits @phone-only', async ({
  page,
  api,
  db,
}, testInfo) => {
  openSeason(db);
  api.on('PUT /api/internship/submission', writes.saveSpartaDraft);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/layanan/sparta');
  await gates(page, testInfo, 'sparta-start-320');
  await page.getByRole('button', { name: 'Mulai' }).click();
  await page.getByLabel('Kelas').fill('K-02');
  await page.getByLabel('ID LINE').fill('nadia.putri');
  const line = main(page).getByText('Langkah 1 dari 4 · Info umum');
  const box = (await line.boundingBox())!;
  expect(box.height).toBeLessThan(24); // one line
  await gates(page, testInfo, 'sparta-step-1-320');
  await lanjut(page).click();
  await gates(page, testInfo, 'sparta-step-2-320');
  await lanjut(page).click();
  for (const name of [
    'Akademik',
    'Welfare',
    'Competition and Community',
    'Media dan Komunikasi',
  ])
    await page.getByRole('checkbox', { name }).check();
  await gates(page, testInfo, 'sparta-step-3-320');
  await lanjut(page).click();
  await gates(page, testInfo, 'sparta-step-4-320');
});

test('Coba lagi on a failed send sends the choices as they are now', async ({
  page,
  api,
  db,
}) => {
  openSeason(db);
  api.on('PUT /api/internship/submission', writes.saveSpartaDraft);
  api.on('POST /api/internship/submission/submit', reply.status(503));
  await page.goto('/layanan/sparta');
  await toReview(page);
  await page.getByRole('button', { name: 'Kirim pilihan' }).click();
  await page
    .getByRole('alertdialog', { name: 'Kirim pilihan divisi?' })
    .getByRole('button', { name: 'Kirim', exact: true })
    .click();
  const toast = page
    .locator('.g-toasts [aria-live="assertive"]')
    .filter({ hasText: 'Pilihanmu belum terkirim.' });
  await expect(toast).toBeVisible();
  // Kelas changes before Coba lagi.
  await page
    .getByRole('button', { name: 'Ubah jawaban bagian Info umum' })
    .click();
  await page.getByLabel('Kelas').fill('K-09');
  await page.getByRole('button', { name: 'Kembali ke ringkasan' }).click();
  await expect(main(page).getByText('K-09')).toBeVisible();
  await expect(toast).toBeVisible();
  api.on('POST /api/internship/submission/submit', writes.submitSparta);
  await toast.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(main(page).getByText('Sudah dikirim')).toBeVisible();
  const sends = api.calls('POST /api/internship/submission/submit');
  expect(sends).toHaveLength(2);
  expect((sends[1].body as { kelas: string }).kelas).toBe('K-09');
  expect(
    db.internshipSubmissions.find((s) => s.userId === db.me!.id)?.kelas,
  ).toBe('K-09');
});
