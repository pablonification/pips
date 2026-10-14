/** Beranda's flows (P1-A, P1-C): beranda, beranda-pengurus, beranda-no-courses, beranda-push. */
import type { Page } from '@playwright/test';
import { greeting } from '../../support/app';
import * as writes from '../../support/writes';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');
const agenda = (page: Page) =>
  page.getByRole('region', { name: '8 hari ke depan' });
const stripDay = (page: Page, name: RegExp | string) =>
  agenda(page)
    .getByRole('group', { name: 'Pilih hari' })
    .getByRole('button', { name });
const agendaRows = (page: Page) =>
  agenda(page)
    .getByRole('listitem')
    .locator('.g-agenda-item > span:last-child > .block');
const attentionTitles = (page: Page) =>
  main(page).locator('.g-att > .grow > .t-sub').allTextContents();
const attentionRow = (page: Page, title: string | RegExp) =>
  main(page).locator('.g-att').filter({ hasText: title });
const section = (page: Page, name: string) =>
  main(page).getByRole('heading', { name, exact: true }).locator('xpath=../..');

flow('beranda', 'nadia', {}, async ({ page, f, db, layout }) => {
  await f.step(
    'Beranda opens with the greeting and Cari di PIPS!',
    async () => {
      await f.open('/');
      await expect(greeting(page)).toBeVisible();
      await expect(page).toHaveTitle('Beranda · PIPS!');
      if (layout !== 'desktop')
        await expect(
          page.getByRole('button', { name: 'Cari di PIPS!' }),
        ).toBeVisible();
      await f.gate('beranda');
    },
  );
  await f.step(
    'The agenda card starts on today: Kuis 2 and the Sharing Session',
    async () => {
      await expect(
        stripDay(page, 'Kamis, 8 Oktober, hari ini, 2 acara'),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(agendaRows(page)).toHaveText([
        'Kuis 2',
        'IF2123 Aljabar Linier dan Geometri',
        'Sharing Session: Magang di Startup',
        'Acara Himpunan',
      ]);
    },
  );
  await f.step('Sabtu shows Bakti Sosial HMIF', async () => {
    await stripDay(page, /^Sabtu, 10 Oktober/).click();
    await expect(agendaRows(page)).toHaveText([
      'Bakti Sosial HMIF',
      'Acara Himpunan',
    ]);
  });
  await f.step('Minggu has nothing: "Tidak ada acara."', async () => {
    await stripDay(page, 'Minggu, 11 Oktober, tidak ada acara').click();
    await expect(agenda(page).getByText('Tidak ada acara.')).toBeVisible();
  });
  await f.step('Back to today', async () => {
    await stripDay(page, /^Kamis, 8 Oktober, hari ini/).click();
    await expect(agendaRows(page).first()).toHaveText('Kuis 2');
  });
  await f.step('Kuis 2’s detail opens', async () => {
    await agenda(page)
      .getByRole('button', { name: /^15\.00.*Kuis 2/ })
      .click();
    if (layout === 'desktop') {
      // On desktop the event opens in Kalender's side panel.
      await expect(page).toHaveURL(/\/kalender\?.*acara=/);
      await expect(
        page
          .getByRole('region', { name: 'Acara hari terpilih' })
          .getByRole('heading', { name: 'Kuis 2' }),
      ).toBeVisible();
      await f.hold();
      await page.goBack();
      await expect(greeting(page)).toBeVisible();
    } else {
      const sheet = page.getByRole('dialog', { name: 'Detail acara' });
      await expect(
        sheet.getByRole('heading', { name: 'Kuis 2' }),
      ).toBeVisible();
      await expect(sheet).toContainText('15.00–16.40 WIB');
      await f.gate('beranda-event');
      await f.hold();
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
    }
  });
  await f.step(
    layout === 'desktop'
      ? 'Pintasan: four shortcuts'
      : 'The eight service tiles, in the real Home’s order',
    async () => {
      if (layout === 'desktop') {
        await expect(section(page, 'Pintasan').locator('.g-svc')).toHaveText([
          'Ding Dong',
          'Testi Matkul',
          'NIM Finder',
          'Bayar Kas! (situs luar)',
        ]);
      } else {
        const tiles = page.getByRole('region', { name: 'Layanan' });
        await tiles.scrollIntoViewIfNeeded();
        await expect(tiles.getByRole('link')).toHaveText([
          'Ding Dong',
          'NIM Finder',
          'Testi Matkul',
          'Info Lomba',
          'Curhat Yuk!',
          'Beasiswa (situs luar)',
          'Bayar Kas! (situs luar)',
          'Lainnya',
        ]);
      }
    },
  );
  await f.step(
    'Perlu ditindaklanjuti, most urgent first, never a Curhat message',
    async () => {
      const heading = main(page).getByRole('heading', {
        name: 'Perlu ditindaklanjuti',
        exact: true,
      });
      await heading.scrollIntoViewIfNeeded();
      await expect
        .poll(() => attentionTitles(page))
        .toEqual([
          'Deadline Tugas Besar 1 · IF2110',
          'Balasan baru dari Welfare',
          'Form Analisis Kondisi PIXEL',
          'Notifikasi belum menyala',
        ]);
      await expect(attentionRow(page, 'Deadline Tugas')).toContainText(
        'Besok, 23.59',
      );
      await expect(attentionRow(page, 'PIXEL')).toContainText('5 bagian');
      await expect(
        attentionRow(page, 'PIXEL').getByRole('link', { name: 'Isi' }),
      ).toBeVisible();
      const text = await page.evaluate(() => document.body.innerText);
      for (const room of Object.values(db.chatrooms))
        for (const m of room.messages ?? [])
          expect(text).not.toContain(m.content);
    },
  );
  await f.step('Pengumuman belum dibaca: the three newest titles', async () => {
    const unread = section(page, 'Pengumuman belum dibaca');
    await unread.scrollIntoViewIfNeeded();
    await expect(unread.getByRole('listitem').getByRole('link')).toHaveCount(3);
    await f.gate('beranda-scrolled');
    await f.hold();
  });
});

flow('beranda-pengurus', 'raka', {}, async ({ page, f, layout }) => {
  await f.step('Raka’s Beranda: his own course’s event, Kuis 1', async () => {
    await f.open('/');
    await expect(greeting(page, 'Raka')).toBeVisible();
    await expect(agendaRows(page)).toHaveText([
      'Kuis 1 (selesai)',
      'IF3170 Inteligensi Buatan',
      'Sharing Session: Magang di Startup',
      'Acara Himpunan',
    ]);
    await f.gate('beranda-raka');
  });
  await f.step('Only his deadline needs action', async () => {
    await expect
      .poll(() => attentionTitles(page))
      .toEqual(['Deadline Tugas Besar 1 · IF3110']);
  });
  await f.step('The Kelola card with the live count: 142', async () => {
    const kelola = main(page).getByRole('link', { name: /Live Counting/ });
    await kelola.scrollIntoViewIfNeeded();
    await expect(kelola).toContainText('Form Analisis Kondisi PIXEL');
    await expect(kelola).toContainText('142');
    await f.hold();
  });
  if (layout === 'desktop')
    await f.step('Pintasan on desktop', async () => {
      await expect(
        main(page).getByRole('heading', { name: 'Pintasan' }),
      ).toBeVisible();
    });
  await f.step('The card opens Live Counting', async () => {
    await main(page)
      .getByRole('link', { name: /Live Counting/ })
      .click();
    await expect(page).toHaveURL(/\/kelola\/live\/pixel$/);
    await f.hold();
  });
});

flow('beranda-no-courses', 'nadia', {}, async ({ page, f, db }) => {
  db.myCourses = [];
  db.events = db.events.filter((e) => e.category === 'himpunan');
  await f.step('With no courses, Beranda asks for them', async () => {
    await f.open('/');
    await expect(greeting(page)).toBeVisible();
    await expect(attentionRow(page, 'Atur mata kuliah')).toContainText(
      'Ding Dong dan acara Akademik masih kosong.',
    );
    await f.gate('beranda-no-courses');
  });
  await f.step('The card shows only Himpunan events', async () => {
    await expect(agendaRows(page)).toHaveText([
      'Sharing Session: Magang di Startup',
      'Acara Himpunan',
    ]);
    await f.hold();
  });
  await f.step('Atur opens Mata kuliahku', async () => {
    const row = attentionRow(page, 'Atur mata kuliah');
    await row.scrollIntoViewIfNeeded();
    await row.getByRole('link', { name: 'Atur' }).click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await f.hold();
  });
});

flow('beranda-push', 'nadia', {}, async ({ page, f, api }) => {
  api.on('POST /api/push/register', writes.registerPush);
  await f.step(
    'Beranda: "Notifikasi belum menyala" is the last row',
    async () => {
      await f.open('/');
      const row = attentionRow(page, 'Notifikasi belum menyala');
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
    },
  );
  await f.step('Nyalakan explains first', async () => {
    await attentionRow(page, 'Notifikasi belum menyala')
      .getByRole('button', { name: 'Nyalakan' })
      .click();
    const prompt = page.getByRole('dialog', { name: 'Nyalakan notifikasi?' });
    await expect(prompt).toContainText(
      'Pengumuman baru, pengingat H-1, dan balasan Curhat akan sampai ke perangkat ini.',
    );
    await f.gate('beranda-push-prompt');
    await f.hold();
  });
  await f.step('Allowed: the row goes and a toast confirms', async () => {
    await page
      .getByRole('dialog', { name: 'Nyalakan notifikasi?' })
      .getByRole('button', { name: 'Nyalakan' })
      .click();
    await expect(
      page
        .locator('.g-toast')
        .filter({ hasText: 'Notifikasi menyala di perangkat ini.' }),
    ).toBeVisible();
    await expect(attentionRow(page, 'Notifikasi belum menyala')).toHaveCount(0);
    expect(api.calls('POST /api/push/register')).toHaveLength(1);
    await f.hold();
  });
});
