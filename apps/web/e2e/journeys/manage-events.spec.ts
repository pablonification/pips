/**
 * P3-B: managing calendar events. Tambah acara Akademik (the locked `OV.addev`) from Kalender, Layanan's Kelola row
 * and the Kelola hub; its validation, request, result, failures, busy state and ways out. Who sees what, by role:
 * Himpunan events for `ring1` and the Seg for both roles (proposals), nothing for members. Ubah acara and Hapus
 * acara in the event detail (proposals). Phone, tablet and desktop, light and dark, with strict gates.
 */
import type { Page, TestInfo } from '@playwright/test';
import { layoutOf, navLink } from '../support/app';
import { defaultHandlers } from '../support/handlers';
import {
  dialog,
  expectStillSignedIn,
  FAILED,
  expectTitleFocused,
  failWith,
  FAILURES,
  slow,
  toastText,
} from '../support/manage';
import { reply } from '../support/mock';
import { expectLit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const main = (page: Page) => page.getByRole('main');
const side = (page: Page) =>
  page.getByRole('region', { name: 'Acara hari terpilih' });
const desk = (t: TestInfo) => layoutOf(t) === 'desktop';
const detail = (page: Page, t: TestInfo) =>
  desk(t) ? side(page) : page.getByRole('dialog', { name: 'Detail acara' });
const addDialog = (page: Page) => dialog(page, 'Tambah acara Akademik');
const tambahAcara = (page: Page) =>
  main(page).getByRole('button', { name: 'Tambah acara' });
const field = (page: Page, name: string, d = addDialog(page)) =>
  d.getByLabel(name, { exact: true });
const posts = (api: { calls: (s: string) => unknown[] }) =>
  api.calls('POST /api/calendar/event');

/** Kuis 2 for IF3170 on Selasa 13 Oktober, 13.00 to 15.00 (the locked `i-desk-kalender-after`). */
async function fillKuis2(page: Page) {
  const d = addDialog(page);
  await field(page, 'Mata kuliah').selectOption('course-IF3170');
  await field(page, 'Judul').fill('Kuis 2');
  await field(page, 'Tanggal').fill('2026-10-13');
  await field(page, 'Mulai').fill('13:00');
  await field(page, 'Selesai').fill('15:00');
  await expect(d.getByLabel('Judul', { exact: true })).toHaveValue('Kuis 2');
}

const KUIS_2 = {
  category: 'akademik',
  courseId: 'course-IF3170',
  title: 'Kuis 2',
  description: '',
  start: '2026-10-13T06:00:00.000Z',
  end: '2026-10-13T08:00:00.000Z',
};

test.describe('Raka adds an Akademik event', () => {
  test.use({ persona: 'pengurus' });

  test('from Tambah acara: the empty-title error and no request, then the request, the toast and 13 Oktober', async ({
    page,
    api,
  }, testInfo) => {
    api.on('POST /api/calendar/event', writes.createEvent);
    await page.goto('/kalender');
    await expectLit(page, testInfo, 'Kalender');
    await tambahAcara(page).click();
    await expect(page).toHaveURL(/tambah=acara/);
    const d = addDialog(page);
    await expect(d).toBeVisible();
    // Focus on the first field (`focusOv`), once the courses have loaded.
    await expect(field(page, 'Mata kuliah')).toBeFocused();
    // The locked defaults: the chosen day (today), 13.00 to 15.00, Raka's own courses first and the first chosen.
    await expect(field(page, 'Tanggal')).toHaveValue('2026-10-08');
    await expect(field(page, 'Mulai')).toHaveValue('13:00');
    await expect(field(page, 'Selesai')).toHaveValue('15:00');
    await expect(field(page, 'Mata kuliah')).toHaveValue('course-IF3110');
    await expect(d.getByText('Muncul di kalender anggota')).toBeVisible();

    await d.getByRole('button', { name: 'Tambahkan' }).click();
    const error = d.getByText('Tulis judul acara, misalnya Kuis 2.');
    await expect(error).toBeVisible();
    await expect(field(page, 'Judul')).toBeFocused();
    await expect(field(page, 'Judul')).toHaveAttribute('aria-invalid', 'true');
    // Regression: a field with an error shows the focus ring as well as its red edge (it showed only the edge). The
    // first shadow is the 1.5 px inset edge in the danger colour, then the ring's two (review m10).
    const { shadows, danger } = await field(page, 'Judul').evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--text-danger)';
      el.parentElement!.append(probe);
      const danger = getComputedStyle(probe).color;
      probe.remove();
      return {
        shadows: getComputedStyle(el).boxShadow.split(/,\s*(?![^(]*\))/),
        danger,
      };
    });
    expect(shadows).toHaveLength(3);
    expect(shadows[0]).toBe(`${danger} 0px 0px 0px 1.5px inset`);
    expect(posts(api)).toHaveLength(0);
    await strictGates(page, testInfo, 'addev-error', null);

    await fillKuis2(page);
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    expect(posts(api).map((c) => (c as { body: unknown }).body)).toEqual([
      KUIS_2,
    ]);
    await expect(
      toastText(
        page,
        'Acara ditambahkan ke kalender anggota IF3170 dan Google Calendar-nya.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/hari=2026-10-13/);
    await expect(page).not.toHaveURL(/tambah=/);
    if (desk(testInfo)) {
      // On desktop the new event is chosen in the side column (it's in Raka's own calendar).
      await expect(page).toHaveURL(/acara=e2e-event-/);
      await expect(
        side(page).getByRole('heading', { name: 'Kuis 2' }),
      ).toBeVisible();
    } else
      await expect(
        main(page).getByText('Kuis 2', { exact: true }),
      ).toBeVisible();
    await expectTitleFocused(page);
  });

  test('from Layanan’s Kelola row: the dialog over Kalender', async ({
    page,
  }) => {
    await page.goto('/layanan');
    await main(page)
      .getByRole('link', { name: /^Tambah acara Akademik/ })
      .click();
    await expect(page).toHaveURL(/\/kalender\?(.*&)?tambah=acara/);
    await expect(addDialog(page)).toBeVisible();
  });

  test('from the Kelola hub’s old address: forwarded to the dialog over Kalender', async ({
    page,
  }) => {
    await page.goto('/kelola/acara');
    await expect(page).toHaveURL(/\/kalender\?(.*&)?tambah=acara/);
    await expect(addDialog(page)).toBeVisible();
  });

  test('Selesai before Mulai: the error under Selesai, no request; equal times are a deadline', async ({
    page,
    api,
  }) => {
    api.on('POST /api/calendar/event', writes.createEvent);
    await page.goto('/kalender?tambah=acara');
    await fillKuis2(page);
    await field(page, 'Selesai').fill('12:00');
    const d = addDialog(page);
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(
      d.getByText('Jam selesai tidak boleh sebelum jam mulai.'),
    ).toBeVisible();
    await expect(field(page, 'Selesai')).toBeFocused();
    expect(posts(api)).toHaveLength(0);
    // Selesai equal to Mulai: a deadline ("Batas" in Kalender), allowed.
    await field(page, 'Selesai').fill('13:00');
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    expect(posts(api)).toHaveLength(1);
  });

  for (const { status, says } of FAILURES)
    test(`a ${status}: the dialog stays with what was typed, the error toast, still signed in`, async ({
      page,
      api,
    }) => {
      api.on('POST /api/calendar/event', failWith(status));
      await page.goto('/kalender?tambah=acara');
      await fillKuis2(page);
      const d = addDialog(page);
      await d.getByRole('button', { name: 'Tambahkan' }).click();
      await expect(toastText(page, says)).toBeVisible();
      await expect(page.getByText(/the API's own words/)).toHaveCount(0);
      await expect(d).toBeVisible();
      await expect(field(page, 'Judul')).toHaveValue('Kuis 2');
      await expect(field(page, 'Tanggal')).toHaveValue('2026-10-13');
      await expect(field(page, 'Mata kuliah')).toHaveValue('course-IF3170');
      await expectStillSignedIn(page);
    });

  test('a slow request: Tambahkan is busy and a second press sends nothing', async ({
    page,
    api,
  }) => {
    api.on('POST /api/calendar/event', slow(writes.createEvent));
    await page.goto('/kalender?tambah=acara');
    await fillKuis2(page);
    const button = addDialog(page).getByRole('button', { name: 'Tambahkan' });
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    // A second press and Enter while busy: aria-disabled keeps it focusable, so press it anyway.
    await button.click({ force: true });
    await field(page, 'Judul').press('Enter');
    await expect(addDialog(page)).toBeHidden();
    expect(posts(api)).toHaveLength(1);
  });

  for (const how of ['Batal', 'Escape', 'Back'] as const)
    test(`${how} closes without a request, focus back on Tambah acara${how === 'Back' ? ' @phone-only' : ''}`, async ({
      page,
      api,
    }) => {
      api.on('POST /api/calendar/event', writes.createEvent);
      await page.goto('/kalender');
      await tambahAcara(page).click();
      await field(page, 'Judul').fill('Kuis 2');
      if (how === 'Batal')
        await addDialog(page).getByRole('button', { name: 'Batal' }).click();
      else if (how === 'Escape') await page.keyboard.press('Escape');
      else await page.goBack();
      await expect(addDialog(page)).toBeHidden();
      await expect(page).not.toHaveURL(/tambah=/);
      await expect(tambahAcara(page)).toBeFocused();
      expect(posts(api)).toHaveLength(0);
    });
});

test.describe('the catalogue failing', () => {
  test.use({ persona: 'pengurus' });

  test('the error state in place of the form, then Coba lagi loads it', async ({
    page,
    api,
  }) => {
    let fail = true;
    api.on('GET /api/course', (req) =>
      fail ? reply.status(503) : defaultHandlers['GET /api/course'](req),
    );
    await page.goto('/kalender?tambah=acara');
    const d = addDialog(page);
    await expect(d.getByText('Mata kuliah gagal dimuat.')).toBeVisible();
    await expect(field(page, 'Judul')).toHaveCount(0);
    fail = false;
    await d.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(field(page, 'Mata kuliah')).toBeVisible();
    await expect(field(page, 'Judul')).toBeVisible();
  });
});

test.describe('who sees what', () => {
  test('Nadia: no Tambah acara, a tambah=acara link opens nothing, no options on an event', async ({
    page,
  }, testInfo) => {
    await page.goto('/kalender?tambah=acara');
    await expect(page).not.toHaveURL(/tambah=/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(tambahAcara(page)).toHaveCount(0);
    await page.goto('/kalender?hari=2026-10-07&acara=a1');
    await expect(
      detail(page, testInfo).getByRole('heading', { name: 'Kuis 1' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Opsi acara / }),
    ).toHaveCount(0);
  });

  test.describe('ring1 only', () => {
    test.use({ roles: { only: ['ring1'] } });

    test('the Himpunan form: no course, category himpunan, no courseId', async ({
      page,
      api,
    }, testInfo) => {
      api.on('POST /api/calendar/event', writes.createEvent);
      await page.goto('/kalender');
      await tambahAcara(page).click();
      const d = dialog(page, 'Tambah acara Himpunan');
      await expect(d).toBeVisible();
      await expect(d.getByLabel('Mata kuliah')).toHaveCount(0);
      await expect(d.getByRole('group', { name: 'Jenis acara' })).toHaveCount(
        0,
      );
      await expect(d.getByLabel('Judul', { exact: true })).toHaveAttribute(
        'placeholder',
        'Misalnya Rapat Anggota HMIF',
      );
      await strictGates(page, testInfo, 'addev-himpunan', null);
      await d.getByLabel('Judul', { exact: true }).fill('Rapat Anggota HMIF');
      await d.getByLabel('Tanggal', { exact: true }).fill('2026-10-13');
      await d.getByRole('button', { name: 'Tambahkan' }).click();
      await expect(d).toBeHidden();
      expect(posts(api).map((c) => (c as { body: unknown }).body)).toEqual([
        {
          category: 'himpunan',
          title: 'Rapat Anggota HMIF',
          description: '',
          start: '2026-10-13T06:00:00.000Z',
          end: '2026-10-13T08:00:00.000Z',
        },
      ]);
      await expect(
        toastText(
          page,
          'Acara ditambahkan ke kalender semua anggota dan Google Calendar-nya.',
        ),
      ).toBeVisible();
    });
  });

  test.describe('akademik and ring1', () => {
    test.use({ persona: 'pengurus', roles: ['ring1'] });

    test('the Seg chooses Akademik or Himpunan, and the title follows', async ({
      page,
    }, testInfo) => {
      await page.goto('/kalender?tambah=acara');
      const seg = page.getByRole('group', { name: 'Jenis acara' });
      await expect(seg).toBeVisible();
      await expect(seg.getByRole('radio', { name: 'Akademik' })).toBeChecked();
      await expect(addDialog(page)).toBeVisible();
      await seg.getByRole('radio', { name: 'Himpunan' }).check();
      const d = dialog(page, 'Tambah acara Himpunan');
      await expect(d).toBeVisible();
      await expect(d.getByLabel('Mata kuliah')).toHaveCount(0);
      await strictGates(page, testInfo, 'addev-seg', null);
    });
  });

  test.describe('Raka', () => {
    test.use({ persona: 'pengurus' });

    test('no options on the Sharing Session (Himpunan), options on Kuis 1 (IF3170)', async ({
      page,
    }, testInfo) => {
      await page.goto('/kalender?hari=2026-10-08&acara=h1');
      await expect(
        detail(page, testInfo).getByRole('heading', {
          name: 'Sharing Session: Magang di Startup',
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^Opsi acara / }),
      ).toHaveCount(0);
      await page.goto('/kalender?hari=2026-10-08&acara=b1');
      await expect(
        detail(page, testInfo).getByRole('button', {
          name: 'Opsi acara Kuis 1',
        }),
      ).toBeVisible();
    });
  });
});

test.describe('Raka changes and deletes Kuis 1 (IF3170)', () => {
  test.use({ persona: 'pengurus' });

  const open = async (page: Page, testInfo: TestInfo, item: string) => {
    await page.goto('/kalender?hari=2026-10-08&acara=b1');
    await detail(page, testInfo)
      .getByRole('button', { name: 'Opsi acara Kuis 1' })
      .click();
    await page.getByRole('menuitem', { name: item }).click();
  };

  test('Ubah acara: filled in WIB, only title, description, start and end sent, then its new day', async ({
    page,
    api,
  }, testInfo) => {
    api.on('PUT /api/calendar/event/:eventId', writes.updateEvent);
    await open(page, testInfo, 'Ubah acara');
    const d = dialog(page, 'Ubah acara');
    await expect(d).toBeVisible();
    // The course as plain text: the API can't move an event to another course.
    await expect(d.getByLabel('Mata kuliah')).toHaveCount(0);
    await expect(d.getByText(/^IF3170 /)).toBeVisible();
    await expect(d.getByRole('group', { name: 'Jenis acara' })).toHaveCount(0);
    const f = (name: string) => d.getByLabel(name, { exact: true });
    await expect(f('Judul')).toHaveValue('Kuis 1');
    await expect(f('Tanggal')).toHaveValue('2026-10-08');
    await expect(f('Mulai')).toHaveValue('10:00');
    await f('Tanggal').fill('2026-10-14');
    await strictGates(page, testInfo, 'ubah-acara', null);
    // The gates resize the window across 1024 px, where the detail moves between the sheet and the side column: the
    // dialog stays open with what was typed (review m3).
    await expect(d).toBeVisible();
    await expect(f('Tanggal')).toHaveValue('2026-10-14');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect(d).toBeHidden();
    const [put] = api.calls('PUT /api/calendar/event/:eventId');
    expect(put.path).toBe('/api/calendar/event/b1');
    expect(Object.keys(put.body as object).sort()).toEqual([
      'description',
      'end',
      'start',
      'title',
    ]);
    expect((put.body as { start: string }).start).toBe(
      '2026-10-14T03:00:00.000Z',
    );
    await expect(toastText(page, 'Acara diperbarui.')).toBeVisible();
    await expect(page).toHaveURL(/hari=2026-10-14/);
    // Kuis 1 on its new day (review m1): desktop's side column shows it (it's in the URL); on phones and tablets the
    // detail closes and the day's list has it. Focus on the page title, as after every other write.
    if (desk(testInfo)) {
      await expect(page).toHaveURL(/acara=b1/);
      await expect(
        side(page).getByRole('heading', { level: 2 }).first(),
      ).toContainText('14');
      await expect(
        side(page).getByRole('heading', { name: 'Kuis 1' }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole('dialog', { name: 'Detail acara' }),
      ).toHaveCount(0);
      await expect(
        main(page).getByText('Kuis 1', { exact: true }),
      ).toBeVisible();
    }
    await expectTitleFocused(page);
  });

  test('Hapus acara: Batal sends nothing; Hapus deletes it, the detail closes, the toast', async ({
    page,
    api,
  }, testInfo) => {
    api.on('DELETE /api/calendar/event/:eventId', writes.deleteEvent);
    await open(page, testInfo, 'Hapus acara');
    const confirm = page.getByRole('alertdialog', { name: 'Hapus acara ini?' });
    await expect(confirm).toBeVisible();
    await expect(
      confirm.getByText(
        'Acara hilang dari kalender anggota dan Google Calendar-nya. Ini tidak bisa diurungkan.',
      ),
    ).toBeVisible();
    await expect(confirm.getByRole('button', { name: 'Batal' })).toBeFocused();
    await strictGates(page, testInfo, 'hapus-acara', null);
    // As in Ubah acara: the confirmation stays open through the gates' resizing (review m3).
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Batal' }).click();
    await expect(confirm).toBeHidden();
    expect(api.calls('DELETE /api/calendar/event/:eventId')).toHaveLength(0);

    await detail(page, testInfo)
      .getByRole('button', { name: 'Opsi acara Kuis 1' })
      .click();
    await page.getByRole('menuitem', { name: 'Hapus acara' }).click();
    await confirm.getByRole('button', { name: 'Hapus' }).click();
    await expect(confirm).toBeHidden();
    const calls = api.calls('DELETE /api/calendar/event/:eventId');
    expect(calls.map((c) => c.path)).toEqual(['/api/calendar/event/b1']);
    await expect(toastText(page, 'Acara dihapus.')).toBeVisible();
    await expect(page).not.toHaveURL(/acara=/);
    if (desk(testInfo))
      await expect(
        side(page).getByRole('heading', { name: 'Kuis 1' }),
      ).toHaveCount(0);
    else
      await expect(
        page.getByRole('dialog', { name: 'Detail acara' }),
      ).toHaveCount(0);
    await expectTitleFocused(page);
  });
});

test.describe('Raka: what a change or a delete meets (review m10)', () => {
  test.use({ persona: 'pengurus' });

  const open = async (page: Page, testInfo: TestInfo, item: string) => {
    await page.goto('/kalender?hari=2026-10-08&acara=b1');
    await detail(page, testInfo)
      .getByRole('button', { name: 'Opsi acara Kuis 1' })
      .click();
    await page.getByRole('menuitem', { name: item }).click();
  };
  const ubah = (page: Page) => dialog(page, 'Ubah acara');
  const confirm = (page: Page) =>
    page.getByRole('alertdialog', { name: 'Hapus acara ini?' });

  for (const { status, says } of FAILURES)
    test(`Ubah acara answered ${status}: the dialog stays with what was typed, the error toast, still signed in`, async ({
      page,
      api,
    }, testInfo) => {
      api.on('PUT /api/calendar/event/:eventId', failWith(status));
      await open(page, testInfo, 'Ubah acara');
      const f = (name: string) => ubah(page).getByLabel(name, { exact: true });
      await f('Judul').fill('Kuis 1 (diundur)');
      await f('Tanggal').fill('2026-10-14');
      await ubah(page).getByRole('button', { name: 'Simpan' }).click();
      await expect(toastText(page, says)).toBeVisible();
      await expect(page.getByText(/the API's own words/)).toHaveCount(0);
      await expect(ubah(page)).toBeVisible();
      await expect(f('Judul')).toHaveValue('Kuis 1 (diundur)');
      await expect(f('Tanggal')).toHaveValue('2026-10-14');
      await expect(page).toHaveURL(/hari=2026-10-08/);
      await expectStillSignedIn(page);
    });

  test('Ubah acara while its request runs: Simpan is busy and sends once', async ({
    page,
    api,
  }, testInfo) => {
    api.on('PUT /api/calendar/event/:eventId', slow(writes.updateEvent));
    await open(page, testInfo, 'Ubah acara');
    await ubah(page).getByLabel('Judul', { exact: true }).fill('Kuis 1A');
    const button = ubah(page).getByRole('button', { name: 'Simpan' });
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.click({ force: true });
    await expect(ubah(page)).toBeHidden();
    const puts = api.calls('PUT /api/calendar/event/:eventId');
    expect(puts).toHaveLength(1);
    // Only the title changed: the event's start and end aren't sent (review m2).
    expect(puts[0].body).toEqual({
      title: 'Kuis 1A',
      description: 'Pencarian dan heuristik.',
    });
  });

  test('regression (review m4): Hapus acara while its request runs: Hapus is busy and deletes once', async ({
    page,
    api,
  }, testInfo) => {
    api.on('DELETE /api/calendar/event/:eventId', slow(writes.deleteEvent));
    await open(page, testInfo, 'Hapus acara');
    const button = confirm(page).getByRole('button', { name: 'Hapus' });
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.click({ force: true });
    await expect(confirm(page)).toBeHidden();
    await expect(toastText(page, 'Acara dihapus.')).toBeVisible();
    expect(api.calls('DELETE /api/calendar/event/:eventId')).toHaveLength(1);
  });

  for (const { status, says } of FAILURES)
    test(`Hapus acara answered ${status}: the confirmation stays, the error toast, the event stays, still signed in`, async ({
      page,
      api,
    }, testInfo) => {
      api.on('DELETE /api/calendar/event/:eventId', failWith(status));
      await open(page, testInfo, 'Hapus acara');
      await confirm(page).getByRole('button', { name: 'Hapus' }).click();
      await expect(toastText(page, says)).toBeVisible();
      await expect(confirm(page)).toBeVisible();
      await expect(
        confirm(page).getByRole('button', { name: 'Hapus' }),
      ).not.toHaveAttribute('aria-disabled', 'true');
      await confirm(page).getByRole('button', { name: 'Batal' }).click();
      await expect(confirm(page)).toBeHidden();
      await expect(page).toHaveURL(/acara=b1/);
      await expect(
        detail(page, testInfo).getByRole('heading', { name: 'Kuis 1' }),
      ).toBeVisible();
      await expectStillSignedIn(page);
    });

  test('regression (review m3): resizing across 1024 px (a tablet turned) keeps Ubah acara open with what was typed', async ({
    page,
  }, testInfo) => {
    await open(page, testInfo, 'Ubah acara');
    await ubah(page).getByLabel('Judul', { exact: true }).fill('Kuis 1A');
    const size = page.viewportSize()!;
    await page.setViewportSize(
      size.width >= 1024
        ? { width: 834, height: 1112 }
        : { width: 1194, height: 834 },
    );
    await expect(ubah(page)).toBeVisible();
    await expect(ubah(page).getByLabel('Judul', { exact: true })).toHaveValue(
      'Kuis 1A',
    );
    await page.setViewportSize(size);
    await expect(ubah(page).getByLabel('Judul', { exact: true })).toHaveValue(
      'Kuis 1A',
    );
  });

  test('regression (review m3): resizing across 1024 px keeps Tambah acara Akademik open with what was typed', async ({
    page,
  }) => {
    await page.goto('/kalender');
    await tambahAcara(page).click();
    await fillKuis2(page);
    const size = page.viewportSize()!;
    await page.setViewportSize(
      size.width >= 1024
        ? { width: 834, height: 1112 }
        : { width: 1194, height: 834 },
    );
    await expect(addDialog(page)).toBeVisible();
    await expect(field(page, 'Judul')).toHaveValue('Kuis 2');
    await page.setViewportSize(size);
    await expect(field(page, 'Judul')).toHaveValue('Kuis 2');
    await expect(field(page, 'Tanggal')).toHaveValue('2026-10-13');
    await expect(field(page, 'Mata kuliah')).toHaveValue('course-IF3170');
  });

  test('an event for a course outside your own, on desktop: its day, and the column chooses nothing @desktop-only', async ({
    page,
    api,
  }) => {
    api.on('POST /api/calendar/event', writes.createEvent);
    await page.goto('/kalender?tambah=acara');
    await field(page, 'Mata kuliah').selectOption('course-IF2110');
    await field(page, 'Judul').fill('Kuis 2');
    // Today: Raka's own events are there, and the column would otherwise choose the first.
    await field(page, 'Tanggal').fill('2026-10-08');
    await addDialog(page).getByRole('button', { name: 'Tambahkan' }).click();
    await expect(addDialog(page)).toBeHidden();
    await expect(
      toastText(
        page,
        'Acara ditambahkan ke kalender anggota IF2110 dan Google Calendar-nya.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/hari=2026-10-08/);
    await expect(page).not.toHaveURL(/acara=/);
    await expect(
      side(page).getByText('Pilih acara untuk melihat detailnya.'),
    ).toBeVisible();
    await expect(side(page).locator('.g-ev-card')).toHaveCount(0);
    await expect(
      side(page).getByRole('heading', { name: 'Kuis 2' }),
    ).toHaveCount(0);
    await expectTitleFocused(page);
  });

  test('akademik taken away mid-session: Tambahkan is refused, nobody is signed out, and Tambah acara goes', async ({
    page,
    api,
    db,
  }) => {
    api.on('POST /api/calendar/event', writes.createEvent);
    await page.goto('/kalender');
    await tambahAcara(page).click();
    await fillKuis2(page);
    const checks = api.calls('GET /api/me').length;
    // An admin takes the role away; the next write answers 403.
    db.me!.roles = db.me!.roles.filter((r) => r !== 'akademik');
    await addDialog(page).getByRole('button', { name: 'Tambahkan' }).click();
    await expect(toastText(page, FAILED.tanpaAkses)).toBeVisible();
    await expect
      .poll(() => api.calls('GET /api/me').length)
      .toBeGreaterThan(checks);
    await expect(tambahAcara(page)).toHaveCount(0);
    await expect(addDialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/tambah=/);
    await expectStillSignedIn(page);
  });

  test('akademik taken away mid-session: Ubah acara is refused, nobody is signed out, and the options go', async ({
    page,
    api,
    db,
  }, testInfo) => {
    api.on('PUT /api/calendar/event/:eventId', writes.updateEvent);
    await open(page, testInfo, 'Ubah acara');
    await ubah(page).getByLabel('Judul', { exact: true }).fill('Kuis 1A');
    const checks = api.calls('GET /api/me').length;
    db.me!.roles = db.me!.roles.filter((r) => r !== 'akademik');
    await ubah(page).getByRole('button', { name: 'Simpan' }).click();
    await expect(toastText(page, FAILED.tanpaAkses)).toBeVisible();
    await expect
      .poll(() => api.calls('GET /api/me').length)
      .toBeGreaterThan(checks);
    await expect(
      page.getByRole('button', { name: /^Opsi acara / }),
    ).toHaveCount(0);
    await expect(ubah(page)).toHaveCount(0);
    await expect(
      detail(page, testInfo).getByRole('heading', { name: 'Kuis 1' }),
    ).toBeVisible();
    await expectStillSignedIn(page);
  });
});

test.describe('Raka on a phone', () => {
  test.use({ persona: 'pengurus' });

  test('regression (review m5): after Back closes Tambah acara, a dialog from Layanan’s Kelola row closes in place @phone-only', async ({
    page,
  }) => {
    await page.goto('/kalender');
    await tambahAcara(page).click();
    await expect(addDialog(page)).toBeVisible();
    await page.goBack();
    await expect(addDialog(page)).toBeHidden();
    await expect(page).not.toHaveURL(/tambah=/);
    await navLink(page, 'Layanan').click();
    await expect(page).toHaveURL(/\/layanan$/);
    await main(page)
      .getByRole('link', { name: /^Tambah acara Akademik/ })
      .click();
    await expect(addDialog(page)).toBeVisible();
    await addDialog(page).getByRole('button', { name: 'Batal' }).click();
    await expect(addDialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/kalender/);
    await expect(page).not.toHaveURL(/tambah=/);
  });
});

test.describe('Raka: the event options button', () => {
  test.use({ persona: 'pengurus' });

  test('regression (review m8, m9): the tag row keeps the tag’s height; Ubah acara lines up with Hapus acara', async ({
    page,
  }, testInfo) => {
    await page.goto('/kalender?hari=2026-10-08&acara=b1');
    const button = detail(page, testInfo).getByRole('button', {
      name: 'Opsi acara Kuis 1',
    });
    await expect(button).toBeVisible();
    const { row, tag } = await button.evaluate((b) => ({
      row: b.parentElement!.getBoundingClientRect().height,
      tag: b.parentElement!.firstElementChild!.getBoundingClientRect().height,
    }));
    expect(row).toBe(tag);
    await button.click();
    const x = async (name: string) =>
      (await page
        .getByRole('menuitem', { name })
        .getByText(name, { exact: true })
        .boundingBox())!.x;
    expect(
      Math.abs((await x('Ubah acara')) - (await x('Hapus acara'))),
    ).toBeLessThan(1);
  });
});
