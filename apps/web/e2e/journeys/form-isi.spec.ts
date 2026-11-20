/**
 * A form made in the builder, for the member (the forms prototype, round 3): Layanan › Form, filling every kind of
 * question on one page with conditions, required answers, the draft and the keyboard, the agreement step with a
 * detail never given, a form that requests nothing, sent and Ubah jawaban, closed and not-yet-open forms, a form's link
 * and its states, and Profil › Data diri. Every journey runs at phone, tablet and desktop size, light and dark.
 */
import type { Locator, Page } from '@playwright/test';
import { layoutOf } from '../support/app';
import { fakeGoogle, googleRequests } from '../support/google';
import { reply } from '../support/mock';
import { strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const main = (page: Page) => page.getByRole('main');
const question = (page: Page, label: string | RegExp) =>
  main(page)
    .locator('.fq')
    .filter({ has: page.getByRole('heading', { name: label }) });
const lanjut = (page: Page) =>
  main(page).getByRole('button', { name: 'Lanjut' });
const kirim = (page: Page) =>
  main(page).getByRole('button', { name: 'Kirim jawaban' });

async function openForm(page: Page, id: string, title: string) {
  await page.goto(`/layanan/form/${id}`);
  await expect(
    main(page).getByRole('heading', { level: 1, name: title }),
  ).toBeVisible();
}

/** Daftar Makrab, answered in full with every kind of question. */
async function answerMakrab(page: Page) {
  await question(page, 'Bisa ikut dua hari penuh?')
    .getByText('Menyusul Sabtu malam')
    .click();
  const jam = question(page, 'Kira-kira sampai jam berapa?').getByRole(
    'textbox',
  );
  await expect(jam).toBeVisible();
  await jam.fill('1930');
  await expect(jam).toHaveValue('19.30');
  await question(page, 'Berangkat dari mana?')
    .getByRole('combobox')
    .selectOption('Kampus Ganesha, bus bareng');
  await question(page, 'Nama panggilan untuk name tag')
    .getByRole('textbox')
    .fill('Nad');
  const kegiatan = question(page, 'Mau ikut kegiatan apa saja?');
  await kegiatan.getByText('Api unggun').click();
  await kegiatan.getByText('Lainnya', { exact: true }).click();
  await kegiatan
    .getByRole('textbox', { name: 'Lainnya, tulis sendiri' })
    .fill('Stargazing');
  await question(page, 'Seberapa semangat kamu ikut makrab?')
    .getByText('5', { exact: true })
    .click();
  await question(page, 'Bukti transfer iuran')
    .locator('input[type=file]')
    .setInputFiles({
      name: 'bukti.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('jpg'),
    });
  await expect(
    question(page, 'Bukti transfer iuran').getByRole('button', {
      name: /Hapus file/,
    }),
  ).toBeVisible();
  const tanggal = question(page, /ambil gelang peserta/);
  await tanggal.getByRole('button', { name: /Pilih tanggal/ }).click();
  await tanggal.getByRole('button', { name: 'Selasa, 20 Oktober' }).click();
  await expect(
    tanggal.getByRole('button', { name: /Selasa, 20 Oktober 2026/ }),
  ).toBeVisible();
}

test.describe('Layanan › Form', () => {
  test('lists the forms for your angkatan: open first, then not open, sent and closed', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/form');
    const rows = main(page).getByRole('listitem');
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0)).toContainText('Daftar Makrab HMIF 2026');
    await expect(rows.nth(0)).toContainText('Tutup Min, 18 Okt · 23.59');
    await expect(rows.nth(0)).toContainText('Isi sekarang');
    await expect(rows.nth(2)).toContainText('Pilih jadwal belajar bareng UTS');
    await expect(rows.nth(2)).toContainText('Belum dibuka');
    await expect(rows.nth(3)).toContainText('Form Analisis Kondisi PIXEL');
    await expect(rows.nth(4)).toContainText('Feedback Welcoming Party 2025');
    await expect(rows.nth(4)).toContainText('Ditutup Min, 4 Okt');
    await strictGates(page, testInfo, 'form-list', 'Layanan');
  });
});

test.describe('Filling a form', () => {
  test('every kind of question, a condition, the agreement step with a detail never given, then sent', async ({
    page,
    api,
  }, testInfo) => {
    api.on('POST /api/media/upload', writes.presign);
    const sent: unknown[] = [];
    api.on('POST /api/form/:formId/response', (req) => {
      sent.push(req.body);
      return writes.submitForm(req);
    });
    await openForm(page, 'makrab', 'Daftar Makrab HMIF 2026');
    await expect(
      main(page).getByText('Tutup Min, 18 Okt · 23.59'),
    ).toBeVisible();
    // The conditional question isn't there until its answer is chosen.
    await expect(question(page, 'Kira-kira sampai jam berapa?')).toBeHidden();
    await strictGates(page, testInfo, 'isi-start', null);

    await answerMakrab(page);
    await lanjut(page).click();

    const agree = main(page).getByRole('heading', {
      name: 'Ikut terkirim bersama jawabanmu',
    });
    await expect(agree).toBeFocused();
    await expect(
      main(page).getByText('Raka Pratama, pembuat form ini'),
    ).toBeVisible();
    await expect(main(page).getByText('Belum ada')).toBeVisible();
    await strictGates(page, testInfo, 'isi-agree', null);

    // Kirim without the missing detail or the agreement: both say what they need.
    await kirim(page).click();
    await expect(
      main(page).getByText('Isi dulu supaya bisa dikirim'),
    ).toBeVisible();
    await expect(
      main(page).getByText('Centang persetujuan ini untuk mengirim'),
    ).toBeVisible();
    expect(sent).toHaveLength(0);

    await main(page)
      .locator('[data-pfrow="health"] textarea')
      .fill('Tidak ada');
    await main(page)
      .getByText('Aku setuju data di atas dikirim bersama jawabanku.')
      .click();
    await kirim(page).click();

    await expect(
      main(page).getByRole('heading', { name: 'Sampai ketemu di makrab!' }),
    ).toBeVisible();
    await expect(
      main(page).getByText('Terkirim Kam, 8 Okt · 13.35.'),
    ).toBeVisible();
    expect(sent).toHaveLength(1);
    const body = sent[0] as {
      answers: { questionId: string; answer: unknown; other?: string }[];
      agreed: boolean;
      details: Record<string, unknown>;
    };
    expect(body.agreed).toBe(true);
    expect(body.details).toEqual({ health: 'Tidak ada' });
    expect(body.answers.find((a) => a.questionId === 'k2')).toEqual({
      questionId: 'k2',
      answer: '19:30',
    });
    expect(body.answers.find((a) => a.questionId === 'k5')).toEqual({
      questionId: 'k5',
      answer: ['Api unggun', '__other'],
      other: 'Stargazing',
    });
    expect(body.answers.some((a) => a.questionId === 'k9')).toBe(false);

    await main(page).getByText('Yang kamu kirim').click();
    await expect(
      main(page).getByText('Api unggun, Lainnya: Stargazing'),
    ).toBeVisible();
    await expect(main(page).getByText('5 dari 5')).toBeVisible();
    await expect(main(page).getByText('Selasa, 20 Oktober')).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Ubah jawaban' }),
    ).toBeVisible();
    await strictGates(page, testInfo, 'isi-sent', null);
  });

  test('Lanjut with required answers missing goes to the first, marks it and says how many', async ({
    page,
  }, testInfo) => {
    await openForm(page, 'makrab', 'Daftar Makrab HMIF 2026');
    // Nothing is marked when the form opens, and scrolling marks nothing.
    const mark = main(page).locator('.f-mark');
    await expect(mark).toHaveClass(/is-idle/);
    await page.mouse.wheel(0, 600);
    await expect(mark).toHaveClass(/is-idle/);

    await lanjut(page).click();
    await expect(
      main(page).getByText('7 pertanyaan wajib belum diisi'),
    ).toBeVisible();
    const first = question(page, 'Bisa ikut dua hari penuh?');
    await expect(first).toHaveClass(/is-bad/);
    await expect(first).toHaveClass(/is-active/);
    await expect(first.getByText('Pertanyaan ini wajib diisi')).toBeVisible();
    await expect(mark).not.toHaveClass(/is-idle/);
    await strictGates(page, testInfo, 'isi-required', null);

    // Answering clears that question's reason at once.
    await first.getByText('Ya, dua hari penuh').click();
    await expect(first).not.toHaveClass(/is-bad/);
    await expect(
      main(page).getByText('6 pertanyaan wajib belum diisi'),
    ).toBeVisible();
  });

  test('a choice moves on to the next question; Oke and Enter do for the rest @desktop-only', async ({
    page,
  }) => {
    await openForm(page, 'makrab', 'Daftar Makrab HMIF 2026');
    const first = question(page, 'Bisa ikut dua hari penuh?');
    await first.getByRole('radio').first().focus();
    // Letter keys choose while focus is in the question; the choice moves on.
    await page.keyboard.press('c');
    await expect(
      first.getByRole('radio', { name: 'Belum pasti' }),
    ).toBeChecked();
    await expect(
      question(page, 'Berangkat dari mana?').getByRole('combobox'),
    ).toBeFocused();
    const nama = question(page, 'Nama panggilan untuk name tag').getByRole(
      'textbox',
    );
    await nama.click();
    await nama.fill('Nad');
    await page.keyboard.press('Enter');
    await expect(
      question(page, 'Mau ikut kegiatan apa saja?')
        .getByRole('checkbox')
        .first(),
    ).toBeFocused();
  });

  test('the answers are kept on the device as a draft, and the list says Lanjutkan', async ({
    page,
  }) => {
    await openForm(page, 'makrab', 'Daftar Makrab HMIF 2026');
    await question(page, 'Nama panggilan untuk name tag')
      .getByRole('textbox')
      .fill('Nad');
    await expect(page.getByText('Draf tersimpan').first()).toBeVisible();
    await page.reload();
    await expect(
      question(page, 'Nama panggilan untuk name tag').getByRole('textbox'),
    ).toHaveValue('Nad');
    await page.goto('/layanan/form');
    await expect(main(page).getByRole('listitem').first()).toContainText(
      'Lanjutkan',
    );
  });

  test('a form that requests nothing has no agreement step: Kirim jawaban sends it', async ({
    page,
    api,
  }, testInfo) => {
    const sent: unknown[] = [];
    api.on('POST /api/form/:formId/response', (req) => {
      sent.push(req.body);
      return writes.submitForm(req);
    });
    await openForm(page, 'suara', 'Evaluasi tengah periode HMIF');
    await expect(lanjut(page)).toHaveCount(0);
    await question(page, /Seberapa puas/)
      .getByText('4', { exact: true })
      .click();
    await question(page, /Kegiatan mana/)
      .getByText('Acara angkatan')
      .click();
    await kirim(page).click();
    await expect(
      main(page).getByRole('heading', { name: 'Terima kasih, suaramu masuk.' }),
    ).toBeVisible();
    expect(sent).toEqual([
      {
        answers: [
          { questionId: 'e1', answer: '4' },
          { questionId: 'e2', answer: ['Acara angkatan'] },
        ],
      },
    ]);
    await expect(
      main(page).getByRole('button', { name: 'Ubah jawaban' }),
    ).toHaveCount(0);
    await strictGates(page, testInfo, 'isi-sent-plain', null);
  });

  test('a send that fails keeps everything and offers Coba lagi', async ({
    page,
    api,
  }) => {
    api.on('POST /api/form/:formId/response', () => reply.status(500, {}));
    await openForm(page, 'suara', 'Evaluasi tengah periode HMIF');
    await question(page, /Seberapa puas/)
      .getByText('4', { exact: true })
      .click();
    await question(page, /Kegiatan mana/)
      .getByText('Acara angkatan')
      .click();
    await kirim(page).click();
    await expect(
      page.getByText(
        'Jawabanmu belum terkirim. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    api.on('POST /api/form/:formId/response', writes.submitForm);
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(
      main(page).getByRole('heading', { name: 'Terima kasih, suaramu masuk.' }),
    ).toBeVisible();
  });

  test('Ubah jawaban opens what was sent and replaces it', async ({
    page,
    api,
    db,
  }) => {
    const makrab = db.formStore.find((f) => f.id === 'makrab')!;
    makrab.responses.push({
      id: 'mine',
      userId: db.me!.id,
      answers: [
        { questionId: 'k1', answer: 'Ya, dua hari penuh' },
        { questionId: 'k3', answer: 'Langsung ke lokasi' },
        { questionId: 'k4', answer: 'Nad' },
        { questionId: 'k5', answer: ['Games angkatan'] },
        { questionId: 'k6', answer: '4' },
        { questionId: 'k7', answer: 'https://media.pips.test/f1-bukti.jpg' },
        { questionId: 'k8', answer: '2026-10-20' },
      ],
      profile: {},
      submittedAt: '2026-10-07T05:00:00.000Z',
      updatedAt: null,
    });
    db.memberDetails = { ...db.memberDetails, health: 'Tidak ada' };
    const changed: unknown[] = [];
    api.on('PUT /api/form/:formId/response', (req) => {
      changed.push(req.body);
      return writes.changeFormResponse(req);
    });
    await openForm(page, 'makrab', 'Daftar Makrab HMIF 2026');
    await main(page).getByRole('button', { name: 'Ubah jawaban' }).click();
    const nama = question(page, 'Nama panggilan untuk name tag').getByRole(
      'textbox',
    );
    await expect(nama).toHaveValue('Nad');
    await nama.fill('Nadia');
    await lanjut(page).click();
    await main(page)
      .getByText('Aku setuju data di atas dikirim bersama jawabanku.')
      .click();
    await kirim(page).click();
    await expect(main(page).getByText(/^Diperbarui /)).toBeVisible();
    expect(changed).toHaveLength(1);
    expect(
      (
        changed[0] as { answers: { questionId: string; answer: unknown }[] }
      ).answers.find((a) => a.questionId === 'k4'),
    ).toEqual({ questionId: 'k4', answer: 'Nadia' });
  });

  test('a closed form and one not open yet say so under the cover', async ({
    page,
  }, testInfo) => {
    await openForm(page, 'welpar', 'Feedback Welcoming Party 2025');
    await expect(
      main(page).getByRole('heading', { name: 'Form ini sudah ditutup' }),
    ).toBeVisible();
    await expect(
      main(page).getByText('Ditutup Min, 4 Okt · 23.59 WIB.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'isi-closed', null);
    await openForm(page, 'belajar', 'Pilih jadwal belajar bareng UTS');
    await expect(
      main(page).getByRole('heading', { name: 'Belum dibuka' }),
    ).toBeVisible();
    await expect(
      main(page).getByText('Dibuka Sen, 12 Okt · 10.00 WIB, 4 hari lagi.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'isi-not-open', null);
  });

  test('the phone bar is gold, with the pips and Back to the questions on the agreement step @phone-only', async ({
    page,
  }, testInfo) => {
    test.skip(layoutOf(testInfo) === 'desktop');
    await openForm(page, 'makrab', 'Daftar Makrab HMIF 2026');
    const bar = page.locator('header.g-top');
    await expect(bar).toHaveClass(/gold/);
    await expect(
      bar.getByRole('progressbar', { name: 'Kemajuan' }),
    ).toHaveAttribute('aria-valuetext', '0 dari 8 pertanyaan terjawab');
    await answerMakrab(page);
    await lanjut(page).click();
    await page.getByRole('button', { name: 'Kembali ke pertanyaan' }).click();
    await expect(lanjut(page)).toBeFocused();
  });
});

test.describe('A form’s link', () => {
  test('a form for you opens as from Layanan › Form', async ({ page }) => {
    await page.goto('/f/makrab-2026');
    await expect(page).toHaveURL(/\/layanan\/form\/makrab$/);
    await expect(
      main(page).getByRole('heading', {
        level: 1,
        name: 'Daftar Makrab HMIF 2026',
      }),
    ).toBeVisible();
  });

  test('another angkatan’s form shows its title and who it is for, nothing more', async ({
    page,
  }, testInfo) => {
    await page.goto('/f/rencana-ta-2023');
    await expect(
      main(page).getByRole('heading', {
        level: 1,
        name: 'Survei rencana tugas akhir',
      }),
    ).toBeVisible();
    await expect(
      main(page).getByRole('heading', {
        name: 'Form ini bukan untuk angkatanmu',
      }),
    ).toBeVisible();
    await expect(
      main(page).getByText('Yang bisa mengisi: angkatan 2023.'),
    ).toBeVisible();
    await expect(main(page).locator('.fq')).toHaveCount(0);
    await strictGates(page, testInfo, 'link-other', null);
  });

  test('a name no form has is "Form tidak ditemukan"', async ({
    page,
  }, testInfo) => {
    await page.goto('/f/makrab-2027');
    await expect(
      main(page).getByText('app.hmif.dev/f/makrab-2027'),
    ).toBeVisible();
    await expect(
      main(page).getByRole('link', { name: 'Lihat form untukmu' }),
    ).toBeVisible();
    await strictGates(page, testInfo, 'link-none', null);
  });

  test.describe('signed out', () => {
    test.use({ signedIn: false });
    test('Masuk first, then the form', async ({ page, api }) => {
      await fakeGoogle(page.context());
      await page.goto('/f/makrab-2026');
      await expect(page).toHaveURL(/\/login\?redirect=%2Ff%2Fmakrab-2026$/);
      expect(api.calls('GET /api/form-link/:name')).toHaveLength(0);
      api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
      await expect
        .poll(async () => (await googleRequests(page)).clients.length)
        .toBe(1);
      await page
        .getByRole('button', { name: 'Masuk dengan akun STEI' })
        .click();
      await expect(page).toHaveURL(/\/layanan\/form\/makrab$/);
    });
  });
});

test.describe('Profil › Data diri', () => {
  const row = (page: Page, label: string): Locator =>
    main(page)
      .locator('.slip-row')
      .filter({ has: page.getByText(label, { exact: true }) });

  test('Profil says how much is given, and Data diri lists it in groups', async ({
    page,
  }, testInfo) => {
    await page.goto('/profil');
    await expect(
      main(page).getByRole('link', { name: /Data diri/ }),
    ).toContainText('5 dari 10 terisi');
    await main(page)
      .getByRole('link', { name: /Data diri/ })
      .click();
    await expect(page).toHaveURL(/\/profil\/data-diri$/);
    await expect(row(page, 'Nomor WhatsApp')).toContainText('0812-5550-0945');
    await expect(row(page, 'Kontak darurat')).toContainText(
      'Ratna Dewi (ibu) · 0813-5550-0911',
    );
    await expect(row(page, 'Instagram')).toContainText('Belum diisi');
    await strictGates(page, testInfo, 'data-diri', 'Profil');
  });

  test('a detail is filled in place, checked, and removed with Urungkan', async ({
    page,
    api,
  }, testInfo) => {
    const saves: unknown[] = [];
    api.on('PATCH /api/user/details', (req) => {
      saves.push(req.body);
      return writes.updateMyDetails(req);
    });
    await page.goto('/profil/data-diri');
    await main(page)
      .getByRole('button', { name: 'Ubah Nomor WhatsApp' })
      .click();
    const wa = row(page, 'Nomor WhatsApp').getByRole('textbox');
    await expect(wa).toBeFocused();
    await wa.fill('0812');
    await row(page, 'Nomor WhatsApp')
      .getByRole('button', { name: 'Simpan' })
      .click();
    await expect(
      row(page, 'Nomor WhatsApp').getByText('Tulis nomornya sampai lengkap'),
    ).toBeVisible();
    expect(saves).toHaveLength(0);
    await strictGates(page, testInfo, 'data-diri-edit', 'Profil');
    await wa.fill('0812-5550-0999');
    await wa.press('Enter');
    await expect(row(page, 'Nomor WhatsApp')).toContainText('0812-5550-0999');
    expect(saves).toEqual([{ whatsapp: '0812-5550-0999' }]);

    await main(page).getByRole('button', { name: 'Ubah Kota asal' }).click();
    await row(page, 'Kota asal').getByRole('button', { name: 'Hapus' }).click();
    await expect(row(page, 'Kota asal')).toContainText('Belum diisi');
    await page.getByRole('button', { name: 'Urungkan' }).click();
    await expect(row(page, 'Kota asal')).toContainText('Semarang');
    expect(saves.slice(1)).toEqual([
      { hometown: null },
      { hometown: 'Semarang' },
    ]);
  });
});
