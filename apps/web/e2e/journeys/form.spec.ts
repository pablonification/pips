/**
 * Form (PIXEL), P2-A: the list, filling section by section with drafts on the device, required errors, the check page,
 * sending and its failures, the thank-you, and the states the server can put a form in (not open yet, closed, not for
 * your angkatan, not found). Every journey runs at phone, tablet and desktop size, light and dark, with strict gates.
 */
import type { Page, TestInfo } from '@playwright/test';
import type { Db } from '../fixtures/api';
import { NOW } from '../fixtures/prototype';
import { audit, gateFailures } from '../support/audit';
import { layoutOf } from '../support/app';
import { fillPixelUpTo, pixelSections } from '../support/flows';
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
}

const main = (page: Page) => page.getByRole('main');
const section = (page: Page, name: string) =>
  main(page).getByRole('heading', { name, level: 2 });
const lanjut = (page: Page) => page.getByRole('button', { name: 'Lanjut' });
const mainNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigasi utama' });
const confirmSheet = (page: Page) =>
  page.getByRole('alertdialog', { name: 'Kirim jawaban?' });
const saved = (page: Page) => main(page).getByText('Draf tersimpan');
const plaque = (page: Page) =>
  main(page).getByRole('heading', { name: 'Terima kasih sudah mengisi!' });

/** No tab bar or rail in the focused flow on phones and tablets; the sidebar stays on desktop. */
async function expectFocusedFlow(page: Page, testInfo: TestInfo) {
  if (layoutOf(testInfo) === 'desktop')
    await expect(mainNav(page)).toBeVisible();
  else await expect(mainNav(page)).toHaveCount(0);
}

/** The draft this test's member has for the PIXEL form, read straight from the device (today's bungkus store). */
async function storedDraft(page: Page, db: Db) {
  return page.evaluate(
    (key) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result
            .transaction('keyval', 'readonly')
            .objectStore('keyval')
            .get(key);
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result ?? null);
          };
        };
      }),
    `bungkus-hmif-form-pixel-${db.me!.id}`,
  );
}

/** A draft written the way today's screen writes it (bungkus 1.3.7's `simpan`), `ageDays` old. */
async function plantTodaysDraft(
  page: Page,
  db: Db,
  answers: Record<string, string | string[]>,
  ageDays: number,
) {
  await page.evaluate(
    ({ key, answers, ageDays }) =>
      new Promise<void>((resolve, reject) => {
        const lock = (s: string) =>
          '🔒' + btoa(encodeURIComponent(s)).split('').reverse().join('');
        const record: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(answers))
          record[k] = typeof v === 'string' ? lock(v) : v;
        record._timestamp = Date.now() - ageDays * 86400_000;
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(record, key);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    { key: `bungkus-hmif-form-pixel-${db.me!.id}`, answers, ageDays },
  );
}

const sentAnswers = (
  page: Page,
  api: { calls: (s: string) => { body: unknown }[] },
) =>
  Object.fromEntries(
    (
      api.calls('POST /api/form/pixel/response')[0].body as {
        answers: { questionId: string; answer: unknown }[];
      }
    ).answers.map((a) => [a.questionId, a.answer]),
  );

test.describe('the list', () => {
  test('the PIXEL form as a card: Isi sekarang, its title, description and 5 bagian; Layanan stays lit', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/form');
    const card = main(page).getByRole('link', {
      name: /Form Analisis Kondisi PIXEL/,
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Isi sekarang');
    await expect(card).toContainText('Bantu HMIF kenalan lebih dekat');
    await expect(card).toContainText('5 bagian');
    await expect(page).toHaveTitle('Form · PIPS!');
    if (layoutOf(testInfo) !== 'desktop')
      await expect(
        mainNav(page).getByRole('link', { name: /^Layanan/ }),
      ).toHaveAttribute('aria-current', 'page');
    else
      await expect(
        main(page).getByRole('heading', { name: 'Form', level: 1 }),
      ).toBeVisible();
    await gates(page, testInfo, 'form-list');
    await card.click();
    await expect(section(page, 'Identitas')).toBeVisible();
    await expect(page).toHaveURL(/\/layanan\/form\/pixel$/);
  });

  test('Belum dibuka shows when it opens; Sudah diisi; Ditutup shows when it closed', async ({
    page,
    db,
  }, testInfo) => {
    const base = db.forms[0];
    db.forms = [
      {
        ...base,
        id: 'soon',
        title: 'Form Evaluasi Kaderisasi',
        status: 'not_opened',
        opensAt: '2026-10-17T06:00:00.000Z',
      },
      { ...base, status: 'already_responded' },
      {
        ...base,
        id: 'old',
        title: 'Form Pemilu Ketua Angkatan',
        status: 'closed',
        closesAt: '2026-10-01T16:59:00.000Z',
      },
    ];
    await page.goto('/layanan/form');
    const cards = main(page).getByRole('list').getByRole('link');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('Belum dibuka');
    await expect(cards.nth(0)).toContainText('Dibuka Sab 17 Okt, 13.00');
    await expect(cards.nth(1)).toContainText('Sudah diisi');
    await expect(cards.nth(1)).toContainText('5 bagian');
    await expect(cards.nth(2)).toContainText('Ditutup');
    await expect(cards.nth(2)).toContainText('Ditutup Kam 1 Okt, 23.59');
    await gates(page, testInfo, 'form-list-statuses');
  });

  test('loading, then an error with Coba lagi that loads the list', async ({
    page,
    api,
  }, testInfo) => {
    api.on('GET /api/form', reply.hang());
    await page.goto('/layanan/form');
    await expect(
      main(page).getByRole('status', { name: 'Memuat form…' }),
    ).toBeVisible();
    await gates(page, testInfo, 'form-list-loading');

    api.on('GET /api/form', reply.status(503));
    await page.reload();
    const error = main(page).getByRole('alert');
    await expect(error).toContainText('Form gagal dimuat.', {
      timeout: 15_000,
    });
    await gates(page, testInfo, 'form-list-error');
    api.on('GET /api/form', ({ db }) => ({ forms: db.forms }));
    await error.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(
      main(page).getByRole('link', { name: /Form Analisis Kondisi PIXEL/ }),
    ).toBeVisible();
  });

  test('offline, the last list stays with when it was updated', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/layanan/form');
    const card = main(page).getByRole('link', {
      name: /Form Analisis Kondisi PIXEL/,
    });
    await expect(card).toBeVisible();
    await page.waitForLoadState('networkidle');
    await api.setOffline(true);
    await expect(main(page).getByRole('status')).toHaveText(
      'Offline · diperbarui 13.35',
    );
    await expect(card).toBeVisible();
    await gates(page, testInfo, 'form-list-offline');
    await api.setOffline(false);
    await expect(main(page).getByText(/^Offline/)).toHaveCount(0);
  });
});

test.describe('Raka, angkatan 2024', () => {
  test.use({ persona: 'pengurus' });

  test('Raka has no form to fill', async ({ page }, testInfo) => {
    await page.goto('/layanan/form');
    await expect(main(page).getByText('Belum ada form untukmu')).toBeVisible();
    await expect(
      main(page).getByText(
        'Form muncul di sini kalau HMIF membuka form untuk angkatanmu.',
      ),
    ).toBeVisible();
    await gates(page, testInfo, 'form-empty');
  });

  test('the PIXEL form isn’t for Raka’s angkatan', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/form/pixel');
    await expect(
      main(page).getByText('Form ini bukan untuk angkatanmu'),
    ).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Lanjut' }),
    ).toHaveCount(0);
    await gates(page, testInfo, 'form-not-eligible');
    await main(page).getByRole('link', { name: 'Lihat daftar Form' }).click();
    await expect(page).toHaveURL(/\/layanan\/form$/);
  });
});

test('the PIXEL form end to end: prefill, required errors, Other, rating by keyboard, Ubah, confirm, send', async ({
  page,
  api,
  db,
}, testInfo) => {
  api.on('POST /api/form/:formId/response', writes.submitForm);
  await page.goto('/layanan/form/pixel');
  await expect(section(page, 'Identitas')).toBeVisible();
  await expect(page).toHaveTitle('Form Analisis Kondisi PIXEL · PIPS!');
  await expect(main(page).getByText('Bagian 1 dari 5')).toBeVisible();
  await expect(main(page).getByText(/^Bantu HMIF kenalan/)).toBeVisible();
  await expectFocusedFlow(page, testInfo);

  // Prefill from the account, with its caption.
  await expect(page.getByLabel('Hai dengan siapa di sini?')).toHaveValue(
    'Nadia Putri',
  );
  await expect(page.getByLabel('Mau tau nim kamu dong')).toHaveValue(
    '13525045',
  );
  await expect(
    main(page).getByText('Diisi dari akunmu. Ubah kalau perlu.'),
  ).toHaveCount(2);
  // No Sebelumnya on the first section.
  await expect(page.getByRole('button', { name: 'Sebelumnya' })).toHaveCount(0);
  await gates(page, testInfo, 'form-step-1');

  // Lanjut with required questions missing: errors, the alert, focus on the first missing one.
  await lanjut(page).click();
  await expect(main(page).getByRole('alert')).toHaveText(
    'Masih ada pertanyaan wajib yang belum diisi.',
  );
  await expect(main(page).getByText('Pertanyaan ini wajib diisi')).toHaveCount(
    3,
  );
  await expect(page.getByRole('radio', { name: 'PIXEL' })).toBeFocused();
  const kelas = page.getByRole('group', { name: 'Kelas berapa tuh?' });
  await expect(kelas).toHaveAccessibleDescription('Pertanyaan ini wajib diisi');
  await expect(page.getByRole('radio', { name: 'IF K1' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await gates(page, testInfo, 'form-required');
  // Answering clears that question's error only.
  await page.getByRole('radio', { name: 'PIXEL' }).check();
  await expect(main(page).getByText('Pertanyaan ini wajib diisi')).toHaveCount(
    2,
  );
  // A cleared prefill is required too.
  await page.getByLabel('Hai dengan siapa di sini?').fill('');
  await expect(
    main(page).getByText('Diisi dari akunmu. Ubah kalau perlu.'),
  ).toHaveCount(1);
  await lanjut(page).click();
  await expect(page.getByLabel('Hai dengan siapa di sini?')).toBeFocused();
  await expect(page.getByLabel('Hai dengan siapa di sini?')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await pixelSections[0](page);
  await lanjut(page).click();

  // Section 2: focus on its title; "Other" reveals its follow-up right below.
  await expect(section(page, 'Biasanya kamu suka kegiatan apa?')).toBeFocused();
  await expect(main(page).getByText('Bagian 2 dari 5')).toBeVisible();
  await expect(main(page).getByText(/^Bantu HMIF kenalan/)).toHaveCount(0);
  await expect(
    main(page).getByText('Boleh pilih lebih dari satu.'),
  ).toBeVisible();
  const followUp = page.getByLabel(/^Sebutkan yang kamu maksud/);
  await expect(followUp).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Other' }).check();
  await expect(followUp).toBeVisible();
  // Right below its question.
  const order = await main(page)
    .locator('[data-qb]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-qb')));
  expect(order).toEqual(['q6', 'q22', 'q8']);
  await page.getByRole('checkbox', { name: 'Other' }).uncheck();
  await expect(followUp).toHaveCount(0);
  await pixelSections[1](page);
  await gates(page, testInfo, 'form-step-2');
  await lanjut(page).click();

  await expect(section(page, 'Kegiatan santai bareng HMIF')).toBeFocused();
  // Sebelumnya goes back with the answers kept.
  await page.getByRole('button', { name: 'Sebelumnya' }).click();
  await expect(section(page, 'Biasanya kamu suka kegiatan apa?')).toBeFocused();
  await expect(followUp).toHaveValue('Main musik');
  await lanjut(page).click();
  await pixelSections[2](page);
  await lanjut(page).click();
  await pixelSections[3](page);
  await lanjut(page).click();

  // The rating: a radio group under its legend and scale, chosen by keyboard.
  await expect(section(page, 'Feedback Welcoming Party 2025')).toBeFocused();
  const rating = page.getByRole('group', {
    name: 'Secara keseluruhan, gimana penilaian kamu soal Welcoming Party 2025?',
  });
  await expect(rating).toHaveAccessibleDescription(
    '1 = sangat kurang, 5 = sangat baik',
  );
  await expect(rating.getByRole('radio')).toHaveCount(5);
  await page.keyboard.press('Tab');
  await expect(
    rating.getByRole('radio', { name: '1', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Space');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(
    rating.getByRole('radio', { name: '4', exact: true }),
  ).toBeChecked();
  await expect(main(page).getByText('(opsional)')).toBeVisible();
  await gates(page, testInfo, 'form-step-5');
  await lanjut(page).click();

  // The check page: every section with Ubah; answers as given.
  await expect(section(page, 'Periksa jawabanmu')).toBeFocused();
  const review = main(page);
  await expect(
    review.getByRole('button', { name: /^Ubah jawaban bagian/ }),
  ).toHaveCount(5);
  await expect(
    review.getByText('Main game, Lainnya: Main musik'),
  ).toBeVisible();
  await expect(review.getByText('4 dari 5')).toBeVisible();
  await expect(review.getByText('Tidak diisi')).toBeVisible();
  await gates(page, testInfo, 'form-review');

  // Ubah opens that section with Kembali ke ringkasan and no Sebelumnya, then returns.
  await page
    .getByRole('button', {
      name: 'Ubah jawaban bagian Biasanya kamu suka kegiatan apa?',
    })
    .click();
  await expect(section(page, 'Biasanya kamu suka kegiatan apa?')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Sebelumnya' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Olahraga' }).check();
  await page.getByRole('button', { name: 'Kembali ke ringkasan' }).click();
  await expect(section(page, 'Periksa jawabanmu')).toBeFocused();
  await expect(
    review.getByText('Main game, Olahraga, Lainnya: Main musik'),
  ).toBeVisible();

  // The confirmation: Periksa lagi returns focus; Kirim sends.
  const kirimJawaban = page.getByRole('button', { name: 'Kirim jawaban' });
  await kirimJawaban.click();
  await expect(confirmSheet(page)).toBeVisible();
  await expect(confirmSheet(page)).toContainText(
    'Jawaban tidak bisa diubah setelah dikirim.',
  );
  await expect(
    confirmSheet(page).getByRole('button', { name: 'Periksa lagi' }),
  ).toBeFocused();
  await gates(page, testInfo, 'form-confirm');
  await confirmSheet(page)
    .getByRole('button', { name: 'Periksa lagi' })
    .click();
  await expect(confirmSheet(page)).toHaveCount(0);
  await expect(kirimJawaban).toBeFocused();
  expect(api.calls('POST /api/form/pixel/response')).toHaveLength(0);
  await kirimJawaban.click();
  await confirmSheet(page)
    .getByRole('button', { name: 'Kirim', exact: true })
    .click();

  await expect(plaque(page)).toBeVisible();
  await expect(plaque(page)).toBeFocused();
  await expect(main(page).getByText('Jawabanmu sudah terkirim.')).toBeVisible();
  await expect(page.getByText('Form berhasil dikirim!')).toBeVisible();
  await expectFocusedFlow(page, testInfo);
  await gates(page, testInfo, 'form-done');

  // What the server got: the visible questions' answers, nothing hidden.
  expect(api.calls('POST /api/form/pixel/response')).toHaveLength(1);
  const answers = sentAnswers(page, api);
  expect(answers).toEqual({
    q1: 'Nadia Putri',
    q2: '13525045',
    q3: 'PIXEL',
    q4: 'IF',
    q5: 'IF K2',
    q6: ['Main game', 'Olahraga', 'Other'],
    q22: 'Main musik',
    q8: 'Malam keakraban',
    q9: ['Ada teman yang ikut'],
    q12: 'Jumat malam',
    q16: 'Tertarik',
    q18: 'Nonton Bareng PIPS',
    q29: '4',
  });
  expect(db.myResponses.pixel).toBeTruthy();

  // The list refreshed: Sudah diisi; Kembali ke Beranda goes home.
  await main(page).getByRole('link', { name: 'Kembali ke Beranda' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/layanan/form');
  await expect(
    main(page).getByRole('link', { name: /Form Analisis/ }),
  ).toContainText('Sudah diisi');
});

test.describe('the draft on this device', () => {
  test('Draf tersimpan after a change; answers back after a reload, at section 1', async ({
    page,
    db,
  }, testInfo) => {
    await page.goto('/layanan/form/pixel');
    await expect(section(page, 'Identitas')).toBeVisible();
    // Prefill alone isn't a draft.
    await expect(saved(page)).toHaveCount(0);
    await page.getByLabel('Hai dengan siapa di sini?').fill('Nadia P.');
    await page.getByRole('radio', { name: 'STI', exact: true }).check();
    await expect(saved(page)).toBeVisible();
    await gates(page, testInfo, 'form-draft-saved');
    await page.getByRole('radio', { name: 'PIXEL' }).check();
    await page.getByRole('radio', { name: 'IF K2' }).check();
    await lanjut(page).click();
    await page.getByRole('checkbox', { name: 'Main game' }).check();
    await expect
      .poll(async () => JSON.stringify(await storedDraft(page, db)))
      .toContain('Main game');

    await page.reload();
    await expect(section(page, 'Identitas')).toBeVisible();
    await expect(saved(page)).toBeVisible();
    await expect(page.getByLabel('Hai dengan siapa di sini?')).toHaveValue(
      'Nadia P.',
    );
    await expect(
      page.getByRole('radio', { name: 'STI', exact: true }),
    ).toBeChecked();
    await expect(page.getByRole('radio', { name: 'IF K2' })).toBeChecked();
    // The NIM wasn't in the draft: prefilled again.
    await expect(page.getByLabel('Mau tau nim kamu dong')).toHaveValue(
      '13525045',
    );
    await lanjut(page).click();
    await expect(
      page.getByRole('checkbox', { name: 'Main game' }),
    ).toBeChecked();
  });

  test('answers keep saving offline and are there after coming back', async ({
    page,
    api,
    db,
  }) => {
    await page.goto('/layanan/form/pixel');
    await expect(section(page, 'Identitas')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await api.setOffline(true);
    await page.getByRole('radio', { name: 'IF K3' }).check();
    await expect(saved(page)).toBeVisible();
    await expect
      .poll(async () => JSON.stringify(await storedDraft(page, db)))
      .toContain('q5');
    await api.setOffline(false);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'IF K3' })).toBeChecked();
  });

  test('a draft from today’s screen restores; one older than 14 days doesn’t', async ({
    page,
    db,
  }) => {
    await page.goto('/layanan/form');
    await expect(
      main(page).getByRole('link', { name: /Form Analisis/ }),
    ).toBeVisible();
    await plantTodaysDraft(
      page,
      db,
      { q1: 'Nadia dari kemarin', q4: 'STI', q6: ['Membaca'] },
      13,
    );
    await page.goto('/layanan/form/pixel');
    await expect(page.getByLabel('Hai dengan siapa di sini?')).toHaveValue(
      'Nadia dari kemarin',
    );
    await expect(
      page.getByRole('radio', { name: 'STI', exact: true }),
    ).toBeChecked();
    await expect(saved(page)).toBeVisible();

    await plantTodaysDraft(page, db, { q1: 'Nadia dari bulan lalu' }, 15);
    await page.reload();
    await expect(section(page, 'Identitas')).toBeVisible();
    await expect(page.getByLabel('Hai dengan siapa di sini?')).toHaveValue(
      'Nadia Putri',
    );
    await expect(saved(page)).toHaveCount(0);
    expect(await storedDraft(page, db)).toBeNull();
  });

  test('gone after sending', async ({ page, api, db }) => {
    api.on('POST /api/form/:formId/response', writes.submitForm);
    await page.goto('/layanan/form/pixel');
    await fillPixelUpTo(page, 5);
    await expect(section(page, 'Periksa jawabanmu')).toBeVisible();
    await expect
      .poll(async () => JSON.stringify(await storedDraft(page, db)))
      .toContain('q29');
    await page.getByRole('button', { name: 'Kirim jawaban' }).click();
    await confirmSheet(page)
      .getByRole('button', { name: 'Kirim', exact: true })
      .click();
    await expect(plaque(page)).toBeVisible();
    await expect.poll(() => storedDraft(page, db)).toBeNull();
    await page.reload();
    await expect(plaque(page)).toBeVisible();
  });
});

test.describe('send failures keep everything', () => {
  for (const how of ['503', 'offline'] as const) {
    test(`${how}: an error toast with Coba lagi; answers and draft kept; Coba lagi sends`, async ({
      page,
      api,
      db,
    }, testInfo) => {
      await page.goto('/layanan/form/pixel');
      await fillPixelUpTo(page, 5);
      await expect(section(page, 'Periksa jawabanmu')).toBeVisible();
      await expect
        .poll(async () => JSON.stringify(await storedDraft(page, db)))
        .toContain('q29');
      if (how === '503')
        api.on('POST /api/form/:formId/response', reply.status(503));
      else await api.setOffline(true);
      await page.getByRole('button', { name: 'Kirim jawaban' }).click();
      await confirmSheet(page)
        .getByRole('button', { name: 'Kirim', exact: true })
        .click();
      const toast = page
        .locator('.g-toasts [aria-live="assertive"]')
        .filter({ hasText: 'Jawabanmu belum terkirim.' });
      await expect(toast).toBeVisible();
      await expect(confirmSheet(page)).toHaveCount(0);
      await expect(section(page, 'Periksa jawabanmu')).toBeVisible();
      await expect(main(page).getByText('4 dari 5')).toBeVisible();
      expect(JSON.stringify(await storedDraft(page, db))).toContain('q29');
      await gates(page, testInfo, `form-send-${how}`);
      // An error toast stays until dismissed.
      await page.waitForTimeout(6000);
      await expect(toast).toBeVisible();

      if (how === 'offline') await api.setOffline(false);
      api.on('POST /api/form/:formId/response', writes.submitForm);
      await toast.getByRole('button', { name: 'Coba lagi' }).click();
      await expect(plaque(page)).toBeVisible();
      await expect(toast).toHaveCount(0);
      expect(sentAnswers(page, api).q29).toBe('4');
    });
  }

  test('409: sent before, so the thank-you', async ({ page, api, db }) => {
    api.on(
      'POST /api/form/:formId/response',
      reply.status(409, { error: 'Already responded' }),
    );
    await page.goto('/layanan/form/pixel');
    await fillPixelUpTo(page, 5);
    await page.getByRole('button', { name: 'Kirim jawaban' }).click();
    await confirmSheet(page)
      .getByRole('button', { name: 'Kirim', exact: true })
      .click();
    await expect(plaque(page)).toBeVisible();
    await expect.poll(() => storedDraft(page, db)).toBeNull();
  });

  test('403: closed meanwhile, so the closed view, nothing lost', async ({
    page,
    api,
    db,
  }) => {
    await page.goto('/layanan/form/pixel');
    await fillPixelUpTo(page, 5);
    await expect
      .poll(async () => JSON.stringify(await storedDraft(page, db)))
      .toContain('q29');
    db.formDetails.pixel.closesAt = '2026-10-08T06:30:00.000Z';
    api.on('POST /api/form/:formId/response', writes.submitForm);
    await page.getByRole('button', { name: 'Kirim jawaban' }).click();
    await confirmSheet(page)
      .getByRole('button', { name: 'Kirim', exact: true })
      .click();
    await expect(main(page).getByText('Form ini sudah ditutup')).toBeVisible();
    await expect(
      main(page).getByText(
        'Ditutup Kamis, 8 Oktober 2026, 13.30 WIB. Jawaban tidak bisa dikirim lagi.',
      ),
    ).toBeVisible();
    // The answers, read-only.
    await expect(main(page).getByText('4 dari 5')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ubah/ })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Kirim jawaban' }),
    ).toHaveCount(0);
    expect(JSON.stringify(await storedDraft(page, db))).toContain('q29');
    expect(db.myResponses.pixel).toBeUndefined();
  });
});

test('not open yet: its time and a countdown, then the questions without a reload', async ({
  page,
  api,
  db,
}, testInfo) => {
  const opensAt = '2026-10-08T06:45:00.000Z'; // 13.45 WIB, ten minutes after the clock's 13.35
  let open = false;
  const form = { ...db.formDetails.pixel, opensAt };
  api.on('GET /api/form/:formId', () =>
    open
      ? { ...form, status: 'open' }
      : { ...form, status: 'not_opened', sections: null },
  );
  await page.goto('/layanan/form/pixel');
  await expect(
    main(page).getByText('Dibuka Kamis, 8 Oktober 2026, 13.45 WIB'),
  ).toBeVisible();
  await expect(main(page).getByRole('timer')).toHaveText(
    /^Dibuka dalam 10 menit|^Dibuka dalam 9 menit/,
  );
  await expect(main(page).getByText(/^Bantu HMIF kenalan/)).toBeVisible();
  await expect(section(page, 'Identitas')).toHaveCount(0);
  await gates(page, testInfo, 'form-not-open');
  const before = api.calls('GET /api/form/pixel').length;

  // At zero the server is asked; it still says no twice (every 3–4 s), then sends the questions.
  await page.clock.fastForward('10:00');
  await expect
    .poll(() => api.calls('GET /api/form/pixel').length, { timeout: 10_000 })
    .toBe(before + 2);
  open = true;
  await expect(section(page, 'Identitas')).toBeVisible({ timeout: 10_000 });
  const polls = api.calls('GET /api/form/pixel').length - before;
  expect(polls).toBe(3);
  // Then it stops asking.
  await page.waitForTimeout(5000);
  expect(api.calls('GET /api/form/pixel').length - before).toBe(polls);
});

test('not open yet, and the questions never come: after 2 minutes, an error with Coba lagi', async ({
  page,
  api,
  db,
}) => {
  const form = { ...db.formDetails.pixel, opensAt: '2026-10-08T06:36:00.000Z' };
  api.on('GET /api/form/:formId', () => ({
    ...form,
    status: 'not_opened',
    sections: null,
  }));
  await page.goto('/layanan/form/pixel');
  await expect(main(page).getByRole('timer')).toBeVisible();
  // A minute past opening, polling starts; two more minutes of the clock and it gives up.
  await page.clock.fastForward('01:00');
  await expect
    .poll(() => api.calls('GET /api/form/pixel').length)
    .toBeGreaterThan(1);
  await page.clock.fastForward('02:00');
  await expect(main(page).getByRole('alert')).toContainText(
    'Form belum bisa dibuka.',
    { timeout: 10_000 },
  );
  const polls = api.calls('GET /api/form/pixel').length;
  await page.waitForTimeout(5000);
  expect(api.calls('GET /api/form/pixel').length).toBe(polls);
  // Coba lagi asks again.
  await main(page).getByRole('button', { name: 'Coba lagi' }).click();
  await expect
    .poll(() => api.calls('GET /api/form/pixel').length)
    .toBeGreaterThan(polls);
});

test('a closed form: read-only with its closing time, no Kirim', async ({
  page,
  db,
}, testInfo) => {
  db.formDetails.pixel.closesAt = '2026-10-01T16:59:00.000Z';
  await page.goto('/layanan/form/pixel');
  await expect(main(page).getByText('Form ini sudah ditutup')).toBeVisible();
  await expect(
    main(page).getByText(/Ditutup Kamis, 1 Oktober 2026, 23.59 WIB/),
  ).toBeVisible();
  await expect(lanjut(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kirim jawaban' })).toHaveCount(
    0,
  );
  await gates(page, testInfo, 'form-closed');
});

test('a closed form with a draft: the check page without Ubah', async ({
  page,
  db,
}) => {
  await page.goto('/layanan/form');
  await expect(
    main(page).getByRole('link', { name: /Form Analisis/ }),
  ).toBeVisible();
  await plantTodaysDraft(page, db, { q1: 'Nadia Putri', q4: 'STI' }, 1);
  db.formDetails.pixel.closesAt = '2026-10-01T16:59:00.000Z';
  await page.goto('/layanan/form/pixel');
  await expect(main(page).getByText('Form ini sudah ditutup')).toBeVisible();
  await expect(
    main(page).getByRole('heading', { name: 'Identitas', level: 3 }),
  ).toBeVisible();
  await expect(main(page).getByText('STI', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ubah/ })).toHaveCount(0);
});

test('a form that doesn’t exist', async ({ page }, testInfo) => {
  await page.goto('/layanan/form/tidak-ada');
  await expect(main(page).getByText('Form tidak ditemukan')).toBeVisible();
  await gates(page, testInfo, 'form-not-found');
  await main(page).getByRole('link', { name: 'Lihat daftar Form' }).click();
  await expect(page).toHaveURL(/\/layanan\/form$/);
});

test('already sent: the thank-you instead of the questions', async ({
  page,
  db,
}) => {
  db.myResponses.pixel = {
    id: 'response-pixel',
    formId: 'pixel',
    userId: db.me!.id,
    answers: [],
    submittedAt: NOW,
  };
  await page.goto('/layanan/form/pixel');
  await expect(plaque(page)).toBeVisible();
  await expect(lanjut(page)).toHaveCount(0);
});

test.describe('gates at every width', () => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`list, a section and the check page at ${width} px: no overflow, nothing under 12 px @desktop-only`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/layanan/form');
      await expect(
        main(page).getByRole('link', { name: /Form Analisis/ }),
      ).toBeVisible();
      await gates(page, testInfo, `form-list-${width}`);
      await page.goto('/layanan/form/pixel');
      await expect(section(page, 'Identitas')).toBeVisible();
      await gates(page, testInfo, `form-step-1-${width}`);
      await fillPixelUpTo(page, 5);
      await expect(section(page, 'Periksa jawabanmu')).toBeVisible();
      await gates(page, testInfo, `form-review-${width}`);
    });
  }

  test('at 200 % zoom @desktop-only', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 720, height: 450 });
    await page.goto('/layanan/form/pixel');
    await expect(section(page, 'Identitas')).toBeVisible();
    await gates(page, testInfo, 'form-step-1-zoom');
  });

  test('touch: inputs 16 px, targets at least 44 px, focus visible at each Tab stop @phone-only', async ({
    page,
  }) => {
    await page.goto('/layanan/form/pixel');
    await expect(section(page, 'Identitas')).toBeVisible();
    const fontSize = await page
      .getByLabel('Hai dengan siapa di sini?')
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(fontSize).toBe('16px');
    for (const target of [
      page.getByRole('radio', { name: 'IF K1' }).locator('xpath=..'),
      lanjut(page),
    ]) {
      const box = (await target.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await section(page, 'Identitas').focus();
    // Every Tab stop down to Lanjut, the page's last control.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el.matches(':focus-visible'))
          return `not focus-visible: ${el.outerHTML.slice(0, 120)}`;
        const label = el.closest('label');
        const outlines = [el, label]
          .filter((x): x is HTMLElement => !!x)
          .map((x) => getComputedStyle(x).outlineStyle);
        // A field's ring is its 4 px focus shadow (components.css `.g-field:focus-visible`).
        const fieldRing = /\b4px\b/.test(getComputedStyle(el).boxShadow);
        return outlines.some((o) => o !== 'none') || fieldRing
          ? 'ring'
          : `none on ${el.tagName}`;
      });
      expect(ring, `Tab stop ${i + 1}`).toBe('ring');
      if (await lanjut(page).evaluate((b) => b === document.activeElement))
        break;
      expect(i, 'Lanjut is reached within 12 Tab stops').toBeLessThan(11);
    }
  });
});
