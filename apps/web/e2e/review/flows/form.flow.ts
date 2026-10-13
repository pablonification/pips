/** Form (PIXEL) and Magang SPARTA (P2-A): form-list, form-pixel, sparta. */
import type { Page } from '@playwright/test';
import type { Db } from '../../fixtures/api';
import { greeting } from '../../support/app';
import { pixelSections } from '../../support/flows';
import { defaultHandlers } from '../../support/handlers';
import { reply } from '../../support/mock';
import * as writes from '../../support/writes';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');
const section = (page: Page, name: string) => main(page).getByRole('heading', { name, level: 2 });
const lanjut = (page: Page) => page.getByRole('button', { name: 'Lanjut' });
const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Navigasi utama' });
const saved = (page: Page) => main(page).getByText('Draf tersimpan');

/** This member's PIXEL draft on the device (the store P2-A kept from today's screen), or null. */
const storedDraft = (page: Page, userId: string) =>
  page.evaluate(
    (key) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction('keyval', 'readonly').objectStore('keyval').get(key);
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result ?? null);
          };
        };
      }),
    `bungkus-hmif-form-pixel-${userId}`,
  );

flow('form-list', 'nadia', {}, async ({ page, f, api, db }) => {
  const base = db.forms[0];
  db.forms = [
    base,
    { ...base, id: 'soon', title: 'Form Evaluasi Kaderisasi', status: 'not_opened', opensAt: '2026-10-08T06:45:00.000Z' },
    { ...base, id: 'done', title: 'Form Welcoming Party 2025', status: 'already_responded' },
    { ...base, id: 'old', title: 'Form Pemilu Ketua Angkatan', status: 'closed', closesAt: '2026-10-01T16:59:00.000Z' },
  ];
  // The form not open yet: the server says so until its time, then sends its questions.
  let open = false;
  const pixel = db.formDetails.pixel;
  const soon = { ...pixel, id: 'soon', title: 'Form Evaluasi Kaderisasi', opensAt: '2026-10-08T06:45:00.000Z' };
  const details = defaultHandlers['GET /api/form/:formId'];
  api.on('GET /api/form/:formId', (req) =>
    req.params.formId === 'soon'
      ? open
        ? { ...soon, status: 'open' }
        : { ...soon, status: 'not_opened', sections: null }
      : details(req),
  );
  const cards = main(page).getByRole('list').getByRole('link');
  await f.step('Nadia’s forms: Isi sekarang, Belum dibuka, Sudah diisi, Ditutup', async () => {
    await f.open('/layanan/form');
    await expect(cards).toHaveCount(4);
    await expect(cards.filter({ hasText: 'Form Analisis Kondisi PIXEL' })).toContainText('Isi sekarang');
    await expect(cards.filter({ hasText: 'Form Evaluasi Kaderisasi' })).toContainText('Dibuka Kam 8 Okt, 13.45');
    await expect(cards.filter({ hasText: 'Form Welcoming Party 2025' })).toContainText('Sudah diisi');
    await expect(cards.filter({ hasText: 'Form Pemilu Ketua Angkatan' })).toContainText('Ditutup Kam 1 Okt, 23.59');
    await f.gate('form-list');
    await f.hold();
  });
  await f.step('A form not open yet: its time and the countdown', async () => {
    await cards.filter({ hasText: 'Form Evaluasi Kaderisasi' }).click();
    await expect(main(page).getByText('Dibuka Kamis, 8 Oktober 2026, 13.45 WIB')).toBeVisible();
    await expect(main(page).getByRole('timer')).toHaveText(/^Dibuka dalam (10|9) menit/);
    await expect(section(page, 'Identitas')).toHaveCount(0);
    await f.gate('form-not-open');
    await f.hold();
  });
  await f.step('At 13.45 the questions appear without a reload', async () => {
    await page.clock.fastForward('10:00');
    await expect.poll(() => api.calls('GET /api/form/soon').length, { timeout: 10_000 }).toBeGreaterThan(1);
    open = true;
    await expect(section(page, 'Identitas')).toBeVisible({ timeout: 10_000 });
    await f.hold();
  });
});

flow('form-list', 'raka', {}, async ({ page, f }) => {
  await f.step('Forms go by angkatan: Raka (2024) has none', async () => {
    await f.open('/layanan/form');
    await expect(main(page).getByText('Belum ada form untukmu')).toBeVisible();
    await expect(main(page).getByText('Form muncul di sini kalau HMIF membuka form untuk angkatanmu.')).toBeVisible();
    await f.gate('form-empty');
    await f.hold();
  });
});

flow('form-pixel', 'nadia', {}, async ({ page, f, api, db, layout }) => {
  api.on('POST /api/form/:formId/response', writes.submitForm);
  await f.step('The PIXEL form: name and NIM from the account, "Bagian 1 dari 5", no tab bar', async () => {
    await f.open('/layanan/form/pixel');
    await expect(section(page, 'Identitas')).toBeVisible();
    await expect(main(page).getByText('Bagian 1 dari 5')).toBeVisible();
    await expect(page.getByLabel('Hai dengan siapa di sini?')).toHaveValue('Nadia Putri');
    await expect(page.getByLabel('Mau tau nim kamu dong')).toHaveValue('13525045');
    if (layout === 'desktop') await expect(mainNav(page)).toBeVisible();
    else await expect(mainNav(page)).toHaveCount(0);
    await f.gate('form-step-1');
  });
  await f.step('Lanjut with required questions missing: the errors, focus on the first', async () => {
    await lanjut(page).click();
    await expect(main(page).getByRole('alert')).toHaveText('Masih ada pertanyaan wajib yang belum diisi.');
    await expect(main(page).getByText('Pertanyaan ini wajib diisi')).toHaveCount(3);
    await expect(page.getByRole('radio', { name: 'PIXEL' })).toBeFocused();
    await f.gate('form-required');
    await f.hold();
  });
  await f.step('Answered: "Draf tersimpan"', async () => {
    await pixelSections[0](page);
    await expect(saved(page)).toBeVisible();
    await f.hold();
  });
  await f.step('A reload brings the answers back', async () => {
    await expect.poll(async () => JSON.stringify(await storedDraft(page, db.me!.id))).toContain('"q5"');
    await page.reload();
    await expect(section(page, 'Identitas')).toBeVisible();
    await expect(saved(page)).toBeVisible();
    await expect(page.getByRole('radio', { name: 'IF K2' })).toBeChecked();
    await f.gate('form-draft-restored');
    await f.hold();
    await lanjut(page).click();
  });
  await f.step('Other opens its follow-up right where it applies', async () => {
    await expect(section(page, 'Biasanya kamu suka kegiatan apa?')).toBeFocused();
    await expect(main(page).getByText('Bagian 2 dari 5')).toBeVisible();
    const followUp = page.getByLabel(/^Sebutkan yang kamu maksud/);
    await expect(followUp).toHaveCount(0);
    await pixelSections[1](page);
    await expect(followUp).toBeVisible();
    await f.gate('form-step-2');
    await f.hold();
    await lanjut(page).click();
  });
  await f.step('Sections 3 and 4', async () => {
    await expect(section(page, 'Kegiatan santai bareng HMIF')).toBeFocused();
    await pixelSections[2](page);
    await lanjut(page).click();
    await expect(section(page, 'Jalan-jalan bareng HMIF')).toBeFocused();
    await pixelSections[3](page);
    await lanjut(page).click();
  });
  await f.step('Section 5: the rating', async () => {
    await expect(section(page, 'Feedback Welcoming Party 2025')).toBeFocused();
    await pixelSections[4](page);
    await f.gate('form-step-5');
    await f.hold();
    await lanjut(page).click();
  });
  await f.step('The check page, with Ubah for each section', async () => {
    await expect(section(page, 'Periksa jawabanmu')).toBeFocused();
    await expect(main(page).getByRole('button', { name: /^Ubah jawaban bagian/ })).toHaveCount(5);
    await expect(main(page).getByText('Main game, Lainnya: Main musik')).toBeVisible();
    await f.gate('form-review');
    await f.hold();
  });
  await f.step('Ubah section 2, add Olahraga, back to the check page', async () => {
    await page.getByRole('button', { name: 'Ubah jawaban bagian Biasanya kamu suka kegiatan apa?' }).click();
    await expect(section(page, 'Biasanya kamu suka kegiatan apa?')).toBeFocused();
    await page.getByRole('checkbox', { name: 'Olahraga' }).check();
    await page.getByRole('button', { name: 'Kembali ke ringkasan' }).click();
    await expect(main(page).getByText('Main game, Olahraga, Lainnya: Main musik')).toBeVisible();
  });
  await f.step('Kirim jawaban asks first: answers can’t be changed after', async () => {
    await page.getByRole('button', { name: 'Kirim jawaban' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Kirim jawaban?' });
    await expect(confirm).toContainText('Jawaban tidak bisa diubah setelah dikirim.');
    await f.gate('form-confirm');
    await f.hold();
    await confirm.getByRole('button', { name: 'Kirim', exact: true }).click();
  });
  await f.step('"Terima kasih sudah mengisi!"; the draft is gone', async () => {
    const plaque = main(page).getByRole('heading', { name: 'Terima kasih sudah mengisi!' });
    await expect(plaque).toBeVisible();
    await expect(page.getByText('Form berhasil dikirim!')).toBeVisible();
    expect(api.calls('POST /api/form/pixel/response')).toHaveLength(1);
    await expect.poll(() => storedDraft(page, db.me!.id)).toBeNull();
    await f.gate('form-done');
    await f.hold();
  });
  await f.step('Beranda’s PIXEL row is gone', async () => {
    await main(page).getByRole('link', { name: 'Kembali ke Beranda' }).click();
    await expect(greeting(page)).toBeVisible();
    await expect(main(page).locator('.g-att').filter({ hasText: 'Form Analisis Kondisi PIXEL' })).toHaveCount(0);
    await expect(main(page).locator('.g-att').filter({ hasText: 'Notifikasi belum menyala' })).toBeVisible();
    await f.hold();
  });
  await f.step('The list says Sudah diisi', async () => {
    await page.goto('/layanan/form');
    await expect(main(page).getByRole('link', { name: /Form Analisis/ })).toContainText('Sudah diisi');
    await f.hold();
  });
});

/** Next season under P2-A's window override: open 1–31 Oktober 2026, with five divisions to choose four from. */
function openSeason(db: Db) {
  db.spartaWindow = { opensAt: '2026-09-30T17:00:00.000Z', closesAt: '2026-10-31T16:59:00.000Z' };
  db.internshipSubmissions = db.internshipSubmissions.filter((s) => s.userId !== db.me!.id);
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
        { id: 'mq1', label: 'Alat yang kamu kuasai', type: 'checkbox', options: ['Figma', 'Canva', 'Premiere'], required: true },
      ],
      questionsRaw: null,
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
        { id: 'kq1', label: 'Isu yang paling kamu minati', type: 'select', options: ['Pendidikan', 'Teknologi'], required: true },
      ],
      questionsRaw: null,
      description: 'Mengkaji isu kampus.',
      order: 3,
    },
  ];
}

flow('sparta', 'nadia', {}, async ({ page, f, api, db, layout }) => {
  const heading = (name: string) => main(page).getByRole('heading', { name, level: 2 });
  await f.step('Closed: the closing time, Nadia’s draft read-only, nothing to send', async () => {
    await f.open('/layanan/sparta');
    await expect(main(page).getByText('Pendaftaran ditutup Min, 23 Agu 2026 pukul 23.59')).toBeVisible();
    await expect(main(page).getByText('Belum dikirim')).toBeVisible();
    await expect(main(page).getByRole('button')).toHaveCount(0);
    if (layout !== 'desktop') await expect(mainNav(page)).toHaveCount(0);
    await f.gate('sparta-closed');
    await f.hold();
  });
  // P2-A's override: next season's window (OPEN-QUESTIONS D4).
  openSeason(db);
  let failNext = 1;
  api.on('PUT /api/internship/submission', (req) => {
    if (failNext > 0) {
      failNext -= 1;
      return reply.status(503);
    }
    return writes.saveSpartaDraft(req);
  });
  api.on('POST /api/internship/submission/submit', writes.submitSparta);
  await f.step('Next season (window override): the deadline and the four steps first', async () => {
    await page.reload();
    await expect(main(page).getByText('Batas waktu Sab, 31 Okt 2026 pukul 23.59')).toBeVisible();
    await expect(main(page).getByRole('listitem')).toHaveText([
      'Info umum',
      'Penjelasan divisi',
      'Pilih divisi',
      'Pertanyaan divisi',
    ]);
    await f.gate('sparta-start');
    await f.hold();
    await page.getByRole('button', { name: 'Mulai' }).click();
  });
  await f.step('Step 1 of 4; a failed save says so, with Coba lagi', async () => {
    await expect(heading('Info umum')).toBeFocused();
    await expect(main(page).getByText('Langkah 1 dari 4 · Info umum')).toBeVisible();
    await f.type(page.getByLabel('Kelas'), 'K-02');
    const failed = main(page).getByRole('alert').filter({ hasText: 'Draf belum tersimpan.' });
    await expect(failed).toBeVisible({ timeout: 10_000 });
    await f.gate('sparta-save-failed');
    await f.hold();
    await failed.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(saved(page)).toBeVisible();
  });
  await f.step('"Draf tersimpan" as Nadia types', async () => {
    await f.type(page.getByLabel('ID LINE'), 'nadia.putri');
    await expect(saved(page)).toBeVisible();
    await f.gate('sparta-step-1');
    await lanjut(page).click();
  });
  await f.step('Step 2: the divisions explained', async () => {
    await expect(heading('Penjelasan divisi')).toBeFocused();
    await expect(main(page).getByText('Mengelola media sosial HMIF.')).toBeVisible();
    await f.hold();
    await lanjut(page).click();
  });
  await f.step('Step 3: exactly four divisions; Naikkan and Turunkan order them', async () => {
    await expect(heading('Pilih divisi')).toBeFocused();
    for (const name of ['Akademik', 'Welfare', 'Competition and Community', 'Media dan Komunikasi'])
      await page.getByRole('checkbox', { name }).check();
    await expect(page.getByRole('checkbox', { name: 'Kajian Strategis' })).toBeDisabled();
    const prio = main(page).locator('ol li');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^Naikkan Media dan Komunikasi/ }).click();
    await expect(prio).toHaveText([/Media dan Komunikasi/, /Akademik/, /Welfare/, /Competition and Community/]);
    await page.getByRole('button', { name: /^Turunkan Akademik/ }).click();
    await expect(prio).toHaveText([/Media dan Komunikasi/, /Welfare/, /Akademik/, /Competition and Community/]);
    await expect(saved(page)).toBeVisible();
    await f.gate('sparta-step-3');
    await f.hold();
    await lanjut(page).click();
  });
  await f.step('Step 4: each choice’s questions, in priority order', async () => {
    await expect(heading('Pertanyaan divisi')).toBeFocused();
    await page.getByRole('checkbox', { name: 'Figma' }).check();
    await page.getByLabel('Ceritakan pengalamanmu mendengarkan teman.').fill('Teman sekamar');
    await page.getByLabel('Kenapa kamu tertarik di Akademik?').fill('Suka mengajar');
    await page.getByLabel('Lomba apa yang pernah kamu ikuti?').fill('Gemastik');
    await expect(saved(page)).toBeVisible();
    await f.gate('sparta-step-4');
    await lanjut(page).click();
  });
  await f.step('The check page; Kirim pilihan divisi? says they lock', async () => {
    await expect(heading('Periksa pilihanmu')).toBeFocused();
    await f.gate('sparta-review');
    await f.hold();
    await page.getByRole('button', { name: 'Kirim pilihan' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Kirim pilihan divisi?' });
    await expect(confirm).toContainText('terkunci setelah dikirim');
    await f.hold();
    await confirm.getByRole('button', { name: 'Kirim', exact: true }).click();
  });
  await f.step('Sent: read-only now', async () => {
    await expect(main(page).getByText('Sudah dikirim')).toBeVisible();
    await expect(page.getByText('Pilihan magang berhasil dikirim!')).toBeVisible();
    await expect(lanjut(page)).toHaveCount(0);
    expect(api.calls('POST /api/internship/submission/submit')).toHaveLength(1);
    await f.gate('sparta-sent');
    await f.hold();
  });
});

flow('sparta', 'raka', {}, async ({ page, f, api }) => {
  await f.step('Raka (2024): "Magang SPARTA hanya untuk angkatan 2025"', async () => {
    await f.open('/layanan/sparta');
    await expect(main(page).getByText('Magang SPARTA hanya untuk angkatan 2025')).toBeVisible();
    await expect(main(page).getByRole('link', { name: 'Kembali ke Layanan' })).toBeVisible();
    expect(api.calls('GET /api/internship/submission')).toHaveLength(0);
    await f.gate('sparta-not-eligible');
    await f.hold();
  });
});
