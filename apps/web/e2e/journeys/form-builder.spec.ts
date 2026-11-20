/**
 * Kelola › Form, the builder: the list (Buatanku, Dibagikan ke aku, admin's Semua form), Buat form, every kind of
 * question, options, sections, "Tampilkan jika", duplicate, reorder by keyboard, the profile fields and the nudge,
 * Setelan, Terbitkan and the dialog after it, Bagikan (the link and its rename, pengurus access), the confirmation
 * before an edit that loses answers, a viewer's read-only form, admin on another's form, Jawaban (summary, one by one,
 * Excel and CSV) and the preview. Raka (akademik, admin) unless noted; `roles: { only: ['akademik'] }` makes him a
 * pengurus who is not admin. Every journey runs at phone, tablet and desktop size, light and dark, with the strict
 * gates on each screen.
 */
import type { Page, TestInfo } from '@playwright/test';
import { layoutOf } from '../support/app';
import type { ApiMock } from '../support/mock';
import { reply } from '../support/mock';
import { strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import { findForm, manageView } from '../support/forms';
import * as writes from '../support/writes';

test.use({ persona: 'pengurus' });

const main = (page: Page) => page.getByRole('main');
const desk = (testInfo: TestInfo) => layoutOf(testInfo) === 'desktop';
/** The tab lit on Kelola's pages: Layanan on phones and tablets, Kelola on desktop. */
const lit = (testInfo: TestInfo) => (desk(testInfo) ? 'Kelola' : 'Layanan');
const dialog = (page: Page, name: string | RegExp) =>
  page
    .getByRole('dialog', { name })
    .or(page.getByRole('alertdialog', { name }));
/** A bar action: in the top bar on phones and tablets, the builder's bar on desktop. */
const action = (page: Page, name: string | RegExp) =>
  page
    .getByRole('button', { name, exact: typeof name === 'string' })
    .locator('visible=true')
    .first();
const listRow = (page: Page, title: string) =>
  main(page).getByRole('link', { name: new RegExp(title) });
type Body = Record<string, unknown> & {
  sections?: { id: string; questions: Record<string, unknown>[] }[];
};
const patches = (api: ApiMock) =>
  api.calls('PATCH /api/form/:formId').map((c) => c.body as Body);
const lastPatch = (api: ApiMock) => patches(api).at(-1) ?? {};
const questionsIn = (b: Body) => (b.sections ?? []).flatMap((s) => s.questions);
/** A toast with this text (and its Urungkan, when it has one). */
const toastText = (page: Page, text: string | RegExp) =>
  page.locator('.g-toast').filter({ hasText: text });
const saved = (page: Page) =>
  expect(page.locator('.fb-state').locator('visible=true')).toHaveText(
    'Tersimpan',
  );
const tab = (page: Page, name: string) =>
  main(page).getByRole('radio', { name: new RegExp(`^${name}`) });
/** A question at rest in the canvas (the outline beside it on desktop has its own buttons). */
const restRow = (page: Page, label: string) =>
  main(page)
    .locator('button[data-q]')
    .filter({ has: page.getByText(label, { exact: true }) });

function editable(api: ApiMock) {
  api.on('PATCH /api/form/:formId', writes.updateForm);
}

async function openBuilder(page: Page, id: string, query = '') {
  await page.goto(`/kelola/form/${id}${query}`);
  await expect(
    main(page).getByRole('group', { name: 'Bagian penyusun' }),
  ).toBeVisible();
}

test.describe('the list', () => {
  test.describe('a pengurus who is not admin', () => {
    test.use({ roles: { only: ['akademik'] } });

    test('Buatanku and Dibagikan ke aku, each row with its state, who shared it and its answers', async ({
      page,
    }, testInfo) => {
      await page.goto('/kelola/form');
      await expect(
        main(page).getByRole('heading', { name: 'Buatanku' }),
      ).toBeVisible();
      await expect(
        main(page).getByRole('heading', { name: 'Dibagikan ke aku' }),
      ).toBeVisible();
      const makrab = listRow(page, 'Daftar Makrab HMIF 2026');
      await expect(makrab).toContainText(
        'Angkatan 2025 · PIXEL · tutup Min, 18 Okt · 23.59',
      );
      await expect(makrab).toContainText('Dibuka');
      await expect(makrab).toContainText('87 jawaban');
      await expect(
        listRow(page, 'Daftar panitia Wisuda Oktober'),
      ).toContainText('6 pertanyaan');
      await expect(
        listRow(page, 'Daftar panitia Wisuda Oktober'),
      ).toContainText('Draf');
      const belajar = listRow(page, 'Pilih jadwal belajar bareng UTS');
      await expect(belajar).toContainText('Bisa edit');
      await expect(belajar).toContainText('dari Aulia Rahma');
      await expect(belajar).toContainText('Dijadwalkan');
      await expect(
        listRow(page, 'Feedback Welcoming Party 2025'),
      ).toContainText('Lihat jawaban');
      // Forms nobody shared with him are not there, and there is no "Semua form" without admin.
      await expect(listRow(page, 'Evaluasi tengah periode HMIF')).toHaveCount(
        0,
      );
      await expect(
        main(page).getByRole('radio', { name: 'Semua form' }),
      ).toHaveCount(0);
      await strictGates(page, testInfo, 'forms', lit(testInfo));
    });

    test('a pengurus with nothing yet: the empty state offers Buat form', async ({
      page,
      db,
    }) => {
      db.formStore = [];
      await page.goto('/kelola/form');
      await expect(main(page).getByText('Belum ada form')).toBeVisible();
      await expect(
        main(page).getByText(
          'Buat form pertamamu, atau minta rekan pengurus membagikan form mereka ke kamu.',
        ),
      ).toBeVisible();
    });
  });

  test('admin: Formku, then Semua form with every form and whose it is', async ({
    page,
  }, testInfo) => {
    await page.goto('/kelola/form');
    await expect(listRow(page, 'Evaluasi tengah periode HMIF')).toHaveCount(0);
    await main(page).getByRole('radio', { name: 'Semua form' }).check();
    await expect(page).toHaveURL(/lihat=semua/);
    await expect(listRow(page, 'Evaluasi tengah periode HMIF')).toContainText(
      'dari Dimas Aditya',
    );
    await expect(listRow(page, 'Survei rencana tugas akhir')).toBeVisible();
    await expect(
      main(page).getByRole('heading', { name: 'Buatanku' }),
    ).toHaveCount(0);
    await strictGates(page, testInfo, 'forms-all', lit(testInfo));
  });

  test('a failed list offers Coba lagi', async ({ page, api }) => {
    api.on('GET /api/form/manage/list', reply.status(503));
    await page.goto('/kelola/form');
    await expect(
      main(page).getByText('Daftar form gagal dimuat.'),
    ).toBeVisible();
    api.on('GET /api/form/manage/list', reply.json({ forms: [] }));
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(main(page).getByText('Belum ada form')).toBeVisible();
  });
});

test.describe('anggota', () => {
  test.use({ persona: 'anggota' });

  test('Nadia is sent from Kelola › Form to Layanan, and no builder request goes out', async ({
    page,
    api,
  }) => {
    await page.goto('/kelola/form');
    await expect(page).toHaveURL(/\/layanan$/);
    expect(api.calls('GET /api/form/manage/list')).toHaveLength(0);
    await page.goto('/kelola/form/makrab');
    await expect(page).toHaveURL(/\/layanan$/);
    expect(api.calls('GET /api/form/:formId/manage')).toHaveLength(0);
  });
});

test('Buat form: a draft opens with its title in focus, and the title is saved as it is typed', async ({
  page,
  api,
}, testInfo) => {
  api.on('POST /api/form', writes.createForm);
  editable(api);
  await page.goto('/kelola/form');
  await action(page, 'Buat form').click();
  await expect(page).toHaveURL(/\/kelola\/form\/[^/]+$/);
  const title = main(page).getByRole('textbox', { name: 'Judul form' });
  await expect(title).toBeFocused();
  await expect(
    main(page).getByLabel('Pertanyaan 1', { exact: true }),
  ).toBeVisible();
  // Nama and NIM start ticked.
  await expect(
    main(page).getByRole('checkbox', { name: 'Nama' }),
  ).toBeChecked();
  await expect(
    main(page).getByRole('checkbox', { name: 'NIM', exact: true }),
  ).toBeChecked();
  await title.fill('Daftar panitia Dies Natalis');
  await saved(page);
  expect(lastPatch(api).title).toBe('Daftar panitia Dies Natalis');
  await strictGates(page, testInfo, 'build-new', null);
  // Back in the list it is a draft.
  await page.goto('/kelola/form');
  await expect(listRow(page, 'Daftar panitia Dies Natalis')).toContainText(
    'Draf',
  );
});

test('a question at rest opens in place; every kind has its own editor', async ({
  page,
  api,
}, testInfo) => {
  editable(api);
  await openBuilder(page, 'wisuda');
  await restRow(page, 'Mau bantu di divisi apa?').click();
  const label = main(page).getByLabel('Pertanyaan 1', { exact: true });
  if (desk(testInfo)) await expect(label).toBeFocused();
  await expect(label).toHaveValue('Mau bantu di divisi apa?');
  await expect(main(page).getByLabel('Opsi 4', { exact: true })).toHaveValue(
    'Konsumsi',
  );
  await strictGates(page, testInfo, 'build', null);
  const kinds: [string, string | null][] = [
    ['Jawaban singkat', 'Anggota menulis jawaban singkat'],
    ['Paragraf', 'Anggota menulis jawaban panjang'],
    ['Skala linier', null],
    ['Tanggal', 'Anggota memilih tanggal'],
    ['Waktu', 'Anggota memilih jam'],
    [
      'Unggah file',
      'Anggota mengunggah satu file: JPG, PNG, atau PDF, maksimal 5 MB',
    ],
    ['Kotak centang', null],
    ['Dropdown', null],
    ['Pilihan ganda', null],
  ];
  // The kind menu open, as the prototype's build-types shows it.
  await main(page)
    .getByRole('button', { name: 'Jenis pertanyaan: Pilihan ganda' })
    .click();
  await expect(
    page.getByRole('menuitemradio', { name: 'Unggah file' }),
  ).toBeVisible();
  await strictGates(page, testInfo, 'build-types', null);
  await page.keyboard.press('Escape');
  let from = 'Pilihan ganda';
  for (const [kind, ghost] of kinds) {
    await main(page)
      .getByRole('button', { name: `Jenis pertanyaan: ${from}` })
      .click();
    await expect(
      page.getByRole('menuitemradio', { name: from }),
    ).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('menuitemradio', { name: kind }).click();
    await expect(
      main(page).getByRole('button', { name: `Jenis pertanyaan: ${kind}` }),
    ).toBeFocused();
    if (ghost) await expect(main(page).getByText(ghost)).toBeVisible();
    if (kind === 'Skala linier') {
      await main(page).getByLabel('Angka tertinggi').selectOption('10');
      await main(page)
        .getByLabel('Arti angka 1', { exact: true })
        .fill('Longgar');
      await saved(page);
      const scale = questionsIn(lastPatch(api)).find((q) => q.id === 'p1')!;
      expect(scale.type).toBe('rating');
      // A kind with no options sends none.
      expect(scale.options).toBeUndefined();
      expect(scale.scale).toEqual({ min: 1, max: 10, minLabel: 'Longgar' });
    }
    from = kind;
  }
  // Options came back with Pilihan ganda: they were kept while the kind changed.
  await expect(main(page).getByLabel('Opsi 4', { exact: true })).toHaveValue(
    'Konsumsi',
  );
  await saved(page);
  await expect
    .poll(() => questionsIn(lastPatch(api)).find((q) => q.id === 'p1')?.type)
    .toBe('radio');
  const q1 = questionsIn(lastPatch(api)).find((q) => q.id === 'p1')!;
  expect(q1.options).toEqual(['Acara', 'Dekorasi', 'Dokumentasi', 'Konsumsi']);
});

test('options: Enter adds the next, a repeated option holds the save, "Lainnya" comes and goes', async ({
  page,
  api,
}) => {
  editable(api);
  await openBuilder(page, 'wisuda');
  await restRow(page, 'Mau bantu di divisi apa?').click();
  await main(page).getByLabel('Opsi 4', { exact: true }).press('End');
  await main(page).getByLabel('Opsi 4', { exact: true }).press('Enter');
  const five = main(page).getByLabel('Opsi 5', { exact: true });
  await expect(five).toBeFocused();
  await five.fill('Acara');
  await expect(main(page).getByText('Opsi ini sudah ada')).toBeVisible();
  await expect(five).toHaveAttribute('aria-invalid', 'true');
  await page.waitForTimeout(800);
  expect(
    questionsIn(lastPatch(api)).find((q) => q.id === 'p1')?.options ?? [],
  ).not.toContain('');
  await five.fill('Logistik');
  await expect(main(page).getByText('Opsi ini sudah ada')).toHaveCount(0);
  await main(page).getByRole('button', { name: 'tambah “Lainnya”' }).click();
  await expect(
    main(page).getByText('Lainnya, anggota menulis sendiri'),
  ).toBeVisible();
  await saved(page);
  let q1 = questionsIn(lastPatch(api)).find((q) => q.id === 'p1')!;
  expect(q1.options).toEqual([
    'Acara',
    'Dekorasi',
    'Dokumentasi',
    'Konsumsi',
    'Logistik',
  ]);
  expect(q1.other).toBe(true);
  await main(page).getByRole('button', { name: 'Hapus opsi Lainnya' }).click();
  await main(page).getByRole('button', { name: 'Hapus opsi Logistik' }).click();
  await saved(page);
  q1 = questionsIn(lastPatch(api)).find((q) => q.id === 'p1')!;
  expect(q1.other).toBeUndefined();
  expect(q1.options).toHaveLength(4);
});

test('Tampilkan jika: set on a later question, said in words at rest, and let go when its deciding option goes', async ({
  page,
  api,
}, testInfo) => {
  editable(api);
  await openBuilder(page, 'wisuda');
  // The draft's own rule, at rest.
  await expect(restRow(page, 'Bawa kamera sendiri?')).toContainText(
    'Muncul jika “Mau bantu di divisi apa?” dijawab “Dokumentasi”',
  );
  await restRow(page, 'Hari apa saja kamu bisa?').click();
  await main(page).getByRole('button', { name: 'Tampilkan jika' }).click();
  const is = main(page).getByLabel('Jawaban penentu');
  await expect(is).toBeFocused();
  await main(page)
    .getByLabel('Pertanyaan penentu')
    .selectOption({ label: 'Mau bantu di divisi apa?' });
  await is.selectOption('Acara');
  await strictGates(page, testInfo, 'build-logic', null);
  await saved(page);
  expect(
    questionsIn(lastPatch(api)).find((q) => q.id === 'p3')?.dependsOn,
  ).toEqual({
    questionId: 'p1',
    value: 'Acara',
  });
  // Renaming the deciding option carries the rule along.
  await restRow(page, 'Mau bantu di divisi apa?').click();
  await main(page).getByLabel('Opsi 1', { exact: true }).fill('Acara utama');
  await saved(page);
  expect(
    questionsIn(lastPatch(api)).find((q) => q.id === 'p3')?.dependsOn,
  ).toEqual({
    questionId: 'p1',
    value: 'Acara utama',
  });
  // Removing it lets the rule go, and says so.
  await main(page)
    .getByRole('button', { name: 'Hapus opsi Dokumentasi' })
    .click();
  await expect(
    toastText(page, 'Syarat “Tampilkan jika” dilepas'),
  ).toBeVisible();
  await saved(page);
  expect(
    questionsIn(lastPatch(api)).find((q) => q.id === 'p2')?.dependsOn,
  ).toBeUndefined();
});

test('duplicate, delete with Urungkan, a new section and its removal', async ({
  page,
  api,
}) => {
  editable(api);
  await openBuilder(page, 'wisuda');
  await restRow(page, 'Mau bantu di divisi apa?').click();
  await main(page).getByRole('button', { name: 'Duplikat pertanyaan' }).click();
  await expect(
    main(page).getByLabel('Pertanyaan 2', { exact: true }),
  ).toHaveValue('Mau bantu di divisi apa?');
  await saved(page);
  expect(
    questionsIn(lastPatch(api))
      .map((q) => q.label)
      .slice(0, 2),
  ).toEqual(['Mau bantu di divisi apa?', 'Mau bantu di divisi apa?']);
  // On a draft a question goes at once, with Urungkan.
  await main(page).getByRole('button', { name: 'Hapus pertanyaan' }).click();
  await expect(dialog(page, /Hapus pertanyaan/)).toHaveCount(0);
  await toastText(page, 'Pertanyaan dihapus.')
    .getByRole('button', { name: 'Urungkan' })
    .click();
  // Back, and open again.
  await expect(
    main(page).getByLabel('Pertanyaan 2', { exact: true }),
  ).toHaveValue('Mau bantu di divisi apa?');
  await expect(restRow(page, 'Mau bantu di divisi apa?')).toHaveCount(1);
  await saved(page);
  expect(questionsIn(lastPatch(api))).toHaveLength(7);
  // Bagian baru, at the end, its title in focus.
  await main(page).getByRole('button', { name: 'Bagian baru' }).click();
  const title = main(page).getByLabel('Judul bagian 3');
  await expect(title).toBeFocused();
  await title.fill('Penutup');
  await saved(page);
  expect(
    lastPatch(api).sections?.map((s) => (s as { title?: string }).title),
  ).toEqual(['Peran', 'Tentang kamu', 'Penutup']);
  await main(page).getByRole('button', { name: 'Hapus bagian' }).last().click();
  await expect(toastText(page, 'Bagian dihapus.')).toBeVisible();
  await saved(page);
  expect(lastPatch(api).sections).toHaveLength(2);
});

test('reorder with the keyboard: Space lifts, arrows move, Space drops, Escape puts it back', async ({
  page,
  api,
}, testInfo) => {
  editable(api);
  await openBuilder(page, 'wisuda');
  const grip = main(page).getByRole('button', {
    name: 'Pindahkan pertanyaan 3',
  });
  await grip.focus();
  await page.keyboard.press('Space');
  await expect(grip).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await saved(page);
  const order = questionsIn(lastPatch(api)).map((q) => q.id);
  expect(order.indexOf('p3')).toBeLessThan(order.indexOf('p2'));
  await strictGates(page, testInfo, 'build-reorder', null);
  // Escape puts it back where it was.
  const calls = patches(api).length;
  const again = main(page).getByRole('button', {
    name: 'Pindahkan pertanyaan 4',
  });
  await again.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  expect(patches(api).length).toBe(calls);
});

test('the profile fields: ticked fields are saved; the nudge asks from the profile instead', async ({
  page,
  api,
}, testInfo) => {
  editable(api);
  await openBuilder(page, 'wisuda');
  await expect(
    main(page).getByRole('heading', {
      name: 'Ikut terkirim dari profil anggota',
    }),
  ).toBeVisible();
  await expect(main(page).getByText('sensitif')).toHaveCount(5);
  await main(page)
    .getByRole('checkbox', { name: /^Kontak darurat/ })
    .check();
  await saved(page);
  expect(lastPatch(api).requestedFields).toEqual([
    'fullName',
    'nim',
    'whatsapp',
    'emergencyContact',
  ]);
  await strictGates(page, testInfo, 'build-fields', null);
  // "Nomor WhatsApp" is already requested: the nudge offers to remove the question.
  await restRow(page, 'Nomor WhatsApp').click();
  await expect(
    main(page).getByText('sudah kamu minta dari profil anggota'),
  ).toBeVisible();
  await strictGates(page, testInfo, 'build-nudge', null);
  await main(page)
    .getByRole('button', { name: 'Hapus pertanyaan' })
    .first()
    .click();
  await saved(page);
  expect(questionsIn(lastPatch(api)).map((q) => q.label)).not.toContain(
    'Nomor WhatsApp',
  );
  // A question about something not requested offers "Minta dari profil".
  await main(page).getByRole('button', { name: 'Tambah pertanyaan' }).click();
  await main(page)
    .getByRole('textbox', { name: /^Pertanyaan \d+$/ })
    .last()
    .fill('ID LINE kamu');
  await main(page).getByRole('button', { name: 'Minta dari profil' }).click();
  await expect(
    toastText(page, 'ID LINE sekarang diminta dari profil.'),
  ).toBeVisible();
  await saved(page);
  expect(lastPatch(api).requestedFields).toContain('line');
});

test('Terbitkan: what stops it, Setelan to fix it, then the link to copy', async ({
  page,
  api,
  context,
}, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  editable(api);
  api.on('POST /api/form/:formId/publish', writes.publishForm);
  await openBuilder(page, 'wisuda');
  await action(page, 'Terbitkan').click();
  const d = dialog(page, 'Terbitkan form?');
  await expect(d.getByText('Pilih angkatan yang boleh mengisi')).toBeVisible();
  await expect(d.getByText('6 pertanyaan, 5 wajib')).toBeVisible();
  await expect(d.getByText('Nama, NIM, Nomor WhatsApp')).toBeVisible();
  await expect(d.getByRole('button', { name: 'Terbitkan' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await strictGates(page, testInfo, 'publish', null);
  await d.getByRole('button', { name: 'Buka Setelan' }).click();
  await expect(tab(page, 'Setelan')).toBeChecked();
  await main(page).getByRole('checkbox', { name: '2025 · PIXEL' }).check();
  await saved(page);
  expect(lastPatch(api).eligibleAngkatan).toEqual([2025]);
  await action(page, 'Terbitkan').click();
  await dialog(page, 'Terbitkan form?')
    .getByRole('button', { name: 'Terbitkan' })
    .click();
  const done = dialog(page, 'Form diterbitkan');
  await expect(done).toBeVisible();
  await expect(
    done.getByText('app.hmif.dev/f/daftar-panitia-wisuda-oktober'),
  ).toBeVisible();
  const copy = done.getByRole('button', { name: 'Salin tautan' });
  await expect(copy).toBeFocused();
  await strictGates(page, testInfo, 'published', null);
  await copy.click();
  await expect(
    done.getByRole('button', { name: 'Tautan disalin' }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'https://app.hmif.dev/f/daftar-panitia-wisuda-oktober',
  );
  await done.getByRole('button', { name: 'Selesai' }).click();
  await expect(action(page, 'Terbitkan')).toHaveCount(0);
  await expect(
    main(page)
      .getByText('Dibuka')
      .locator('visible=true')
      .or(page.getByText('Dibuka').locator('visible=true'))
      .first(),
  ).toBeVisible();
});

test.describe('Bagikan', () => {
  test('the link: rename it in place, with the rules said as it is typed', async ({
    page,
    api,
  }, testInfo) => {
    api.on('PUT /api/form/:formId/slug', writes.renameFormSlug);
    await openBuilder(page, 'makrab');
    await action(page, /^Bagikan( form)?$/).click();
    const d = dialog(page, 'Bagikan “Daftar Makrab HMIF 2026”');
    await expect(d.getByText('app.hmif.dev/f/makrab-2026')).toBeVisible();
    await expect(
      d.getByText('Hanya angkatan 2025 yang bisa mengisi.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'share', null);
    await d.getByRole('button', { name: 'Ubah nama tautan' }).click();
    const field = d.getByRole('textbox', { name: /Tautan untuk anggota/ });
    await expect(field).toBeFocused();
    await field.fill('');
    await field.pressSequentially('Makrab IF');
    await expect(field).toHaveValue('makrab-if');
    await expect(d.getByText('Tersedia')).toBeVisible();
    await field.fill('ab');
    await expect(d.getByText('Minimal 3 karakter')).toBeVisible();
    await field.fill('makrab--if');
    await expect(
      d.getByText('Tanda hubung hanya di antara huruf atau angka'),
    ).toBeVisible();
    await field.fill('belajar-bareng-uts');
    await expect(d.getByText('Sudah dipakai form lain')).toBeVisible();
    await strictGates(page, testInfo, 'share-link-taken', null);
    await field.press('Enter');
    await expect(field).toBeFocused();
    expect(api.calls('PUT /api/form/:formId/slug')).toHaveLength(0);
    await field.fill('makrab-if-2026');
    await expect(d.getByText('Tersedia')).toBeVisible();
    await expect(
      d.getByText('Tautan lama tidak bisa dibuka lagi.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'share-link-edit', null);
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect(d.getByText('app.hmif.dev/f/makrab-if-2026')).toBeVisible();
    expect(api.calls('PUT /api/form/:formId/slug')[0]?.body).toEqual({
      slug: 'makrab-if-2026',
    });
    await expect(
      d.getByRole('button', { name: 'Ubah nama tautan' }),
    ).toBeFocused();
    // Escape leaves the editor and keeps the dialog.
    await d.getByRole('button', { name: 'Ubah nama tautan' }).click();
    await page.keyboard.press('Escape');
    await expect(d).toBeVisible();
    await expect(
      d.getByRole('button', { name: 'Ubah nama tautan' }),
    ).toBeVisible();
  });

  test('a draft: the address and Ubah, nothing to copy yet', async ({
    page,
  }, testInfo) => {
    await openBuilder(page, 'wisuda');
    await action(page, /^Bagikan( form)?$/).click();
    const d = dialog(page, /^Bagikan/);
    await expect(
      d.getByText('Tautan bisa dibagikan setelah form diterbitkan.'),
    ).toBeVisible();
    await expect(d.getByRole('button', { name: 'Salin tautan' })).toHaveCount(
      0,
    );
    await strictGates(page, testInfo, 'share-draft', null);
  });

  test('pengurus access: find by name, add as Lihat jawaban, change a role, remove with Urungkan', async ({
    page,
    api,
  }, testInfo) => {
    api.on('PUT /api/form/:formId/access/:userId', writes.setFormAccess);
    api.on('DELETE /api/form/:formId/access/:userId', writes.removeFormAccess);
    await openBuilder(page, 'makrab');
    await action(page, /^Bagikan( form)?$/).click();
    const d = dialog(page, /^Bagikan/);
    await expect(d.getByText('Pemilik')).toBeVisible();
    await d
      .getByRole('searchbox', { name: 'Tambah pengurus: cari nama atau NIM' })
      .fill('ke');
    await expect(
      d.getByText('Ketik minimal 3 huruf atau angka.'),
    ).toBeVisible();
    await d.getByRole('searchbox').fill('Kevin');
    const kevin = d.getByRole('button', { name: /Kevin Wijaya/ });
    await expect(kevin).toContainText('Tambah');
    await strictGates(page, testInfo, 'share-search', null);
    await kevin.click();
    await expect(
      d.getByRole('button', { name: 'Akses Kevin Wijaya: Lihat jawaban' }),
    ).toBeFocused();
    expect(api.calls('PUT /api/form/:formId/access/:userId')[0]?.body).toEqual({
      role: 'view',
    });
    // A member with no role can't be picked.
    await d.getByRole('searchbox').fill('Bima');
    const bima = d.getByRole('button', { name: /Bima Santoso/ });
    await expect(bima).toContainText('Bukan pengurus');
    await expect(bima).toHaveAttribute('aria-disabled', 'true');
    await bima.dispatchEvent('click');
    expect(api.calls('PUT /api/form/:formId/access/:userId')).toHaveLength(1);
    // Aulia from Edit to Lihat jawaban.
    await d.getByRole('button', { name: 'Akses Aulia Rahma: Edit' }).click();
    await expect(
      page.getByRole('menuitemradio', { name: /^Edit/ }),
    ).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('menuitemradio', { name: /^Lihat jawaban/ }).click();
    await expect(
      d.getByRole('button', { name: 'Akses Aulia Rahma: Lihat jawaban' }),
    ).toBeVisible();
    await strictGates(page, testInfo, 'share-role', null);
    // Dimas removed, then back with Urungkan.
    await d
      .getByRole('button', { name: 'Akses Dimas Aditya: Lihat jawaban' })
      .click();
    await page.getByRole('menuitem', { name: 'Hapus akses' }).click();
    await expect(d.getByText('Dimas Aditya')).toHaveCount(0);
    expect(api.calls('DELETE /api/form/:formId/access/:userId')).toHaveLength(
      1,
    );
    await toastText(page, 'Akses Dimas Aditya dihapus.')
      .getByRole('button', { name: 'Urungkan' })
      .click();
    await expect(d.getByText('Dimas Aditya')).toBeVisible();
  });
});

test.describe('a form that has answers', () => {
  test('removing a question asks first, says what goes, and is sent agreed', async ({
    page,
    api,
  }, testInfo) => {
    editable(api);
    await openBuilder(page, 'makrab');
    await restRow(page, 'Nama panggilan untuk name tag').click();
    await main(page).locator('button[data-del]').click();
    const d = dialog(page, 'Hapus pertanyaan ini?');
    await expect(
      d.getByText('87 anggota sudah mengisi form ini.'),
    ).toBeVisible();
    await expect(d.getByText('Nama panggilan untuk name tag')).toBeVisible();
    await expect(d.getByRole('button', { name: 'Batal' })).toBeFocused();
    await strictGates(page, testInfo, 'build-confirm-delete', null);
    await d.getByRole('button', { name: 'Batal' }).click();
    await expect(
      main(page).getByLabel('Pertanyaan 4', { exact: true }),
    ).toHaveValue('Nama panggilan untuk name tag');
    expect(patches(api)).toHaveLength(0);
    await main(page).locator('button[data-del]').click();
    await dialog(page, 'Hapus pertanyaan ini?')
      .getByRole('button', { name: 'Hapus pertanyaan' })
      .click();
    await expect(
      toastText(page, 'Pertanyaan dan jawabannya dihapus.'),
    ).toBeVisible();
    await saved(page);
    expect(lastPatch(api).confirmBreaking).toBe(true);
    expect(questionsIn(lastPatch(api)).map((q) => q.id)).not.toContain('k4');
  });

  test('a kind that keeps the answers goes through; one that loses them asks first', async ({
    page,
    api,
  }, testInfo) => {
    editable(api);
    await openBuilder(page, 'makrab');
    await restRow(page, 'Bisa ikut dua hari penuh?').click();
    await main(page)
      .getByRole('button', { name: 'Jenis pertanyaan: Pilihan ganda' })
      .click();
    await page.getByRole('menuitemradio', { name: 'Dropdown' }).click();
    await expect(dialog(page, /Ubah jadi/)).toHaveCount(0);
    await saved(page);
    expect(lastPatch(api).confirmBreaking).toBeUndefined();
    await main(page)
      .getByRole('button', { name: 'Jenis pertanyaan: Dropdown' })
      .click();
    await page.getByRole('menuitemradio', { name: 'Skala linier' }).click();
    const d = dialog(page, 'Ubah jadi skala linier?');
    await expect(
      d.getByText(
        'Jawaban dropdown mereka tidak bisa dibaca sebagai skala linier',
      ),
    ).toBeVisible();
    await strictGates(page, testInfo, 'build-confirm-type', null);
    await d.getByRole('button', { name: 'Ubah jenis' }).click();
    await saved(page);
    expect(lastPatch(api).confirmBreaking).toBe(true);
    expect(questionsIn(lastPatch(api)).find((q) => q.id === 'k1')?.type).toBe(
      'rating',
    );
  });

  test('an answer that came in meanwhile: the server refuses, the builder asks, then sends it agreed', async ({
    page,
    api,
  }) => {
    let first = true;
    api.on('PATCH /api/form/:formId', (req) => {
      const body = req.body as Body;
      if (first && !body.confirmBreaking) {
        first = false;
        return reply.status(409, {
          error: 'This edit loses answers',
          breaking: [
            {
              questionId: 'w3',
              label: 'Apa yang perlu diperbaiki untuk tahun depan?',
              change: 'removed',
            },
          ],
          responseCount: 1,
        });
      }
      return writes.updateForm(req);
    });
    // Welcoming Party shows 96 answers, but the builder thinks the form it loaded had none.
    api.on('GET /api/form/:formId/manage', ({ db, params }) => ({
      ...manageView(db, findForm(db, params.formId)!),
      responseCount: 0,
    }));
    await openBuilder(page, 'welpar');
    await restRow(page, 'Apa yang perlu diperbaiki untuk tahun depan?').click();
    await main(page).locator('button[data-del]').click();
    const d = dialog(page, 'Hapus pertanyaan ini?');
    await expect(
      d.getByText('1 anggota sudah mengisi form ini.'),
    ).toBeVisible();
    await d.getByRole('button', { name: 'Hapus pertanyaan' }).click();
    await saved(page);
    expect(lastPatch(api).confirmBreaking).toBe(true);
  });
});

test.describe('a pengurus who may only look', () => {
  test.use({ roles: { only: ['akademik'] } });

  test('lands on Jawaban, sees the form read only, copies the link, and has no Setelan', async ({
    page,
    api,
    context,
  }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/kelola/form/welpar');
    await expect(tab(page, 'Jawaban')).toBeChecked();
    await expect(tab(page, 'Setelan')).toHaveCount(0);
    await expect(
      page.getByText('Lihat saja').locator('visible=true'),
    ).toBeVisible();
    await expect(main(page).locator('[data-total]')).toHaveText('96');
    await strictGates(
      page,
      testInfo,
      'shared-view',
      lit(testInfo) === 'Kelola' ? 'Kelola' : null,
    );
    await action(page, /^Salin tautan( form)?$/).click();
    await expect(toastText(page, 'Tautan disalin.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'https://app.hmif.dev/f/feedback-welpar-2025',
    );
    await tab(page, 'Pertanyaan').check();
    await expect(
      main(page).getByText('Secara keseluruhan, gimana Welcoming Party 2025?'),
    ).toBeVisible();
    await expect(main(page).getByRole('textbox')).toHaveCount(0);
    await expect(main(page).getByText('Tidak ada')).toBeVisible();
    await strictGates(page, testInfo, 'shared-view-questions', null);
    expect(api.calls('PATCH /api/form/:formId')).toHaveLength(0);
  });
});

test("admin on another pengurus's form: one line says whose it is, and the edit is taken", async ({
  page,
  api,
}, testInfo) => {
  editable(api);
  await openBuilder(page, 'suara');
  await expect(
    main(page).getByText(
      'Form ini milik Dimas Aditya. Kamu mengubahnya sebagai admin.',
    ),
  ).toBeVisible();
  await strictGates(page, testInfo, 'admin-edit', null);
  await main(page)
    .getByRole('textbox', { name: 'Judul form' })
    .fill('Evaluasi tengah periode HMIF 2026');
  await saved(page);
  expect(lastPatch(api).title).toBe('Evaluasi tengah periode HMIF 2026');
});

test.describe('Jawaban', () => {
  test('the count against the audience, a summary per question, and the Excel and CSV downloads', async ({
    page,
  }, testInfo) => {
    await openBuilder(page, 'makrab', '?tab=jawaban');
    await expect(main(page).locator('[data-total]')).toHaveText('87');
    await expect(
      main(page).getByText(
        'dari 132 anggota angkatan 2025 · PIXEL sudah mengisi',
      ),
    ).toBeVisible();
    const q1 = main(page).getByRole('region', {
      name: 'Bisa ikut dua hari penuh?',
    });
    await expect(q1).toContainText('87 menjawab');
    await expect(q1.getByRole('listitem')).toHaveCount(3);
    await strictGates(page, testInfo, 'build-answers', null);
    const excel = page.waitForEvent('download');
    await main(page).getByRole('button', { name: 'Unduh Excel' }).click();
    expect((await excel).suggestedFilename()).toBe('makrab-2026-jawaban.xlsx');
    await expect(toastText(page, 'Rekap 87 jawaban diunduh.')).toBeVisible();
    const csv = page.waitForEvent('download');
    await main(page)
      .getByRole('button', { name: 'Pilihan unduhan lain' })
      .click();
    await page.getByRole('menuitem', { name: 'Unduh CSV' }).click();
    expect((await csv).suggestedFilename()).toBe('makrab-2026-jawaban.csv');
  });

  test('one by one: each response with only the fields it carried, and when it was sent', async ({
    page,
  }, testInfo) => {
    await openBuilder(page, 'makrab', '?tab=jawaban');
    await main(page).getByRole('radio', { name: 'Satu per satu' }).check();
    await expect(main(page).getByText('Jawaban 1 dari 87')).toBeVisible();
    await expect(
      main(page).getByRole('heading', { name: 'Data dari profil' }),
    ).toBeVisible();
    await expect(
      main(page).getByText('Kontak darurat', { exact: true }),
    ).toBeVisible();
    // Only the requested fields: nothing about who sent it beyond them.
    await expect(main(page).getByText('Email mahasiswa')).toHaveCount(0);
    await expect(main(page).getByText(/^Dikirim /)).toBeVisible();
    await strictGates(page, testInfo, 'answers-one', null);
    await main(page)
      .getByRole('button', { name: 'Jawaban berikutnya' })
      .click();
    await expect(main(page).getByText('Jawaban 2 dari 87')).toBeVisible();
    await expect(page).toHaveURL(/lihat=satu/);
    await expect(page).toHaveURL(/no=2/);
    await expect(
      main(page).getByRole('button', { name: 'Jawaban sebelumnya' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('a draft has no answers yet; a failed summary offers Coba lagi', async ({
    page,
    api,
  }) => {
    await openBuilder(page, 'wisuda', '?tab=jawaban');
    await expect(main(page).getByText('Belum ada jawaban')).toBeVisible();
    await expect(
      main(page).getByText('Jawaban masuk setelah form diterbitkan.'),
    ).toBeVisible();
    api.on('GET /api/form/:formId/answers/summary', reply.status(503));
    await openBuilder(page, 'makrab', '?tab=jawaban');
    await expect(main(page).getByText('Jawaban gagal dimuat.')).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Coba lagi' }),
    ).toBeVisible();
  });
});

test.describe('Setelan', () => {
  test('changing answers after sending, the words after sending, and Tutup form sekarang', async ({
    page,
    api,
  }, testInfo) => {
    editable(api);
    await openBuilder(page, 'makrab', '?tab=setelan');
    const sw = main(page).getByRole('switch', {
      name: 'Boleh mengubah jawaban sampai form ditutup',
    });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await strictGates(page, testInfo, 'build-settings', null);
    await sw.click();
    await expect.poll(() => lastPatch(api).allowEdit).toBe(false);
    const thanks = main(page).getByRole('textbox', {
      name: 'Setelah mengirim',
    });
    await thanks.fill('Sampai ketemu di Lembang!');
    await thanks.blur();
    await expect
      .poll(() => lastPatch(api).thanks)
      .toBe('Sampai ketemu di Lembang!');
    await main(page)
      .getByRole('button', { name: 'Tutup form sekarang' })
      .click();
    const d = dialog(page, 'Tutup form sekarang?');
    await d.getByRole('button', { name: 'Tutup form' }).click();
    await expect(toastText(page, 'Form ditutup.')).toBeVisible();
    expect(typeof lastPatch(api).closesAt).toBe('string');
  });

  test('a closing day on the month, a time typed as 09.00, and Hapus tanggal tutup', async ({
    page,
    api,
  }) => {
    editable(api);
    await openBuilder(page, 'makrab', '?tab=setelan');
    await main(page)
      .getByRole('button', { name: /^Ditutup/ })
      .click();
    await main(page)
      .getByRole('button', { name: 'Selasa, 20 Oktober 2026' })
      .click();
    await expect
      .poll(() => lastPatch(api).closesAt)
      .toBe('2026-10-20T16:59:00.000Z');
    const time = main(page).getByRole('textbox', { name: 'Jam ditutup' });
    await time.fill('2100');
    await expect(time).toHaveValue('21.00');
    await time.press('Enter');
    await expect
      .poll(() => lastPatch(api).closesAt)
      .toBe('2026-10-20T14:00:00.000Z');
    await main(page)
      .getByRole('button', { name: 'Hapus tanggal tutup' })
      .click();
    await expect.poll(() => lastPatch(api).closesAt).toBe(null);
  });

  test('Hapus form asks, then goes back to the list without it', async ({
    page,
    api,
  }) => {
    api.on('DELETE /api/form/:formId', writes.deleteForm);
    await openBuilder(page, 'wisuda', '?tab=setelan');
    await main(page).getByRole('button', { name: 'Hapus form' }).click();
    const d = dialog(page, 'Hapus form ini?');
    await expect(d.getByRole('button', { name: 'Batal' })).toBeFocused();
    await d.getByRole('button', { name: 'Hapus form' }).click();
    await expect(page).toHaveURL(/\/kelola\/form$/);
    await expect(listRow(page, 'Daftar panitia Wisuda Oktober')).toHaveCount(0);
  });
});

test("Pratinjau: the member's form with its cover, the rule that shows a question, and nothing sent", async ({
  page,
  api,
}, testInfo) => {
  await openBuilder(page, 'wisuda');
  await action(page, 'Pratinjau').click();
  await expect(page).toHaveURL(/\/pratinjau$/);
  await expect(
    page.getByText('Pratinjau. Jawaban tidak dikirim.'),
  ).toBeVisible();
  await expect(
    main(page).getByRole('heading', { name: 'Daftar panitia Wisuda Oktober' }),
  ).toBeVisible();
  await expect(main(page).getByText('Bawa kamera sendiri?')).toHaveCount(0);
  await strictGates(page, testInfo, 'preview', null);
  await main(page).getByRole('radio', { name: 'Dokumentasi' }).check();
  await expect(main(page).getByText('Bawa kamera sendiri?')).toBeVisible();
  await main(page)
    .getByRole('button', { name: /^Lanjut/ })
    .click();
  await expect(
    main(page).getByText('Pertanyaan ini wajib diisi').first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tutup pratinjau' }).click();
  await expect(page).toHaveURL(/\/kelola\/form\/wisuda$/);
  expect(api.calls('POST /api/form/:formId/response')).toHaveLength(0);
});

test('a form that is gone: Form tidak ditemukan, with the way back to the list', async ({
  page,
}) => {
  await page.goto('/kelola/form/tidak-ada');
  await expect(main(page).getByText('Form tidak ditemukan')).toBeVisible();
  await main(page).getByRole('link', { name: 'Ke daftar form' }).click();
  await expect(page).toHaveURL(/\/kelola\/form$/);
});

test('a save that lands while a newer edit waits never says Tersimpan', async ({
  page,
  api,
}) => {
  const holds: (() => void)[] = [];
  let n = 0;
  api.on('PATCH /api/form/:formId', async (req) => {
    n++;
    await new Promise<void>((r) => holds.push(r));
    return writes.updateForm(req);
  });
  await openBuilder(page, 'wisuda');
  const title = main(page).getByRole('textbox', { name: 'Judul form' });
  const state = page.locator('.fb-state').locator('visible=true');
  await title.fill('Daftar panitia Wisuda');
  await expect.poll(() => n).toBe(1);
  await title.fill('Daftar panitia Wisuda Oktober 2026');
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.fb-state')].find((e) =>
      e.checkVisibility(),
    )!;
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    new MutationObserver(() => seen.push(el.textContent ?? '')).observe(el, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  holds.shift()!();
  await expect.poll(() => n).toBe(2);
  expect(
    await page.evaluate(() => (window as unknown as { seen: string[] }).seen),
  ).not.toContain('Tersimpan');
  await expect(state).toHaveText('Menyimpan…');
  holds.shift()!();
  await expect(state).toHaveText('Tersimpan');
  expect(lastPatch(api).title).toBe('Daftar panitia Wisuda Oktober 2026');
});
