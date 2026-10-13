/**
 * Where each non-route locked screen (names.mjs EXTRA_SCREENS) lives in the real app. A task that builds one adds its
 * entry, as screens.ts does for route screens:
 *
 * ```ts
 * 'i-filter-sheet': {
 *   path: '/pengumuman',
 *   act: async (page) => page.getByRole('button', { name: 'Filter' }).click(),
 *   ready: (page) => page.getByRole('dialog', { name: 'Filter' }),
 * },
 * ```
 *
 * The capture runs in the `fidelity-<layout>-<theme>` project that names.mjs gives the screen, at its viewport.
 * Captures of the app area ('app') and of the window ('page') are viewport screenshots; for an 'element' screen,
 * `target` names the element. Unmapped screens show as "not built yet" in the report; PROTOTYPE_ONLY are skipped.
 */
import type { Locator, Page } from '@playwright/test';
import { pixelSections } from '../support/flows';
import { visibleText } from '../support/app';
import * as writes from '../support/writes';
import { liveAsLocked, type FidelityScreen } from './screens';

export interface ExtraCapture extends FidelityScreen {
  persona?: 'anggota' | 'pengurus' | null;
  /** The element to capture (required for 'element' screens). */
  target?: (page: import('@playwright/test').Page) => Locator;
}

/** P2-A: the PIXEL form as the prototype's check fills it (garis-check.mjs, "Form: required fields; …"). */
const lanjut = (p: Page) => p.getByRole('button', { name: 'Lanjut' }).click();
async function checkFill(p: Page, upTo: 'rating' | 'review') {
  await p.getByRole('radio', { name: 'PIXEL' }).check();
  await p.getByRole('radio', { name: 'IF', exact: true }).check();
  await p.getByRole('radio', { name: 'IF K2' }).check();
  await lanjut(p);
  await p.getByRole('checkbox', { name: 'Other' }).check();
  await p.getByLabel(/^Sebutkan yang kamu maksud/).fill('Main musik');
  await p.getByLabel(/^Selama ikut kegiatan HMIF/).fill('Welcoming party');
  await lanjut(p);
  await p.getByRole('checkbox', { name: 'Ada teman yang ikut' }).check();
  await p.getByLabel(/^Kapan kamu biasanya/).fill('Sabtu sore');
  await lanjut(p);
  await pixelSections[3](p);
  await lanjut(p);
  await p.getByRole('radio', { name: '5', exact: true }).check();
  if (upTo === 'review') await lanjut(p);
}
const fill = '/layanan/form/pixel';
const fillMain = (p: Page) => p.getByRole('main');

/** P0-C: Beranda at other window sizes, for the shell's chrome (bars, rail, sidebar, gold header); P1-A fills it. */
const beranda: ExtraCapture = {
  path: '/',
  ready: (p) => p.getByRole('heading', { name: 'Halo, Nadia' }),
};

export const EXTRAS: Partial<Record<string, ExtraCapture>> = {
  'page-phone-light': beranda,
  'page-phone-dark': beranda,
  'page-narrow320-light': beranda,
  'page-tablet768-light': beranda,
  'page-tablet768-dark': beranda,
  'page-tablet1000-light': beranda,
  'page-desktop-light': beranda,
  'page-desktop-dark': beranda,
  'page-desktop1024-light': beranda,
  'narrow320-beranda': beranda,
  'desk1024-beranda': beranda,
  // P1-C: "IF2211" typed and K2 picked. i-push-dialog waits for P1-A's Beranda (the prompt over it); until then the
  // ov-push captures compare the prompt over Notifikasi.
  'i-matkul-add': {
    path: '/profil/matkul/tambah',
    act: async (p) => {
      const main = p.getByRole('main');
      await main.getByText('Strategi Algoritma').waitFor();
      await main
        .getByRole('searchbox', { name: 'Cari mata kuliah' })
        .fill('IF2211');
      await main
        .getByRole('radiogroup', { name: 'Kelas IF2211' })
        .getByRole('radio', { name: 'K2' })
        .click();
      // The prototype's capture shows no focus ring: the search field and chip were used by pointer.
      await p.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
    },
    ready: (p) =>
      p
        .getByRole('button', { name: /^Tambahkan \(1\)/ })
        .locator('visible=true'),
  },
  // P0-A: the design-system gallery, against the prototype's design-system page.
  'system-cards': {
    path: '/dev/garis',
    persona: null,
    ready: (p) => p.getByTestId('garis-sys'),
    target: (p) => p.getByTestId('garis-sys'),
  },
  'system-kit': {
    path: '/dev/garis',
    persona: null,
    ready: (p) => p.getByTestId('garis-kit'),
    target: (p) => p.getByTestId('garis-kit'),
  },
  // P1-B: Pengumuman, reached as garis-check.mjs sections 4a and 4c reach them.
  'i-feed-reacted': {
    path: '/pengumuman',
    mock: (api) => api.on('PUT /api/reaction', writes.react),
    act: async (p) => {
      await visibleText(p, P1_TITLE).waitFor();
      const card = p.getByRole('article', {
        name: new RegExp(`^${P1_TITLE}`),
      });
      // The prototype's picker brings the card to the top of the page.
      await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await card.getByRole('button', { name: /Beri reaksi$/ }).click();
      await p
        .getByRole('group', { name: 'Pilih reaksi' })
        .getByRole('button', { name: 'Keren' })
        .click();
    },
    ready: (p) =>
      p
        .getByRole('article', { name: new RegExp(`^${P1_TITLE}`) })
        .getByRole('button', { name: /^Reaksimu Keren/ }),
  },
  'i-post-detail': {
    path: '/pengumuman/p1',
    mock: (api) => {
      api.on('POST /api/info/:infoId/read', writes.markRead);
      api.on('POST /api/comment', writes.comment);
      api.on('PUT /api/reaction', writes.react);
    },
    act: async (p) => {
      // Continues from i-feed-reacted: Keren is Nadia's.
      await p.getByRole('button', { name: 'Beri reaksi', exact: true }).click();
      await p
        .getByRole('group', { name: 'Pilih reaksi' })
        .getByRole('button', { name: 'Keren' })
        .click();
      await p
        .getByRole('button', { name: 'Ganti reaksi', exact: true })
        .waitFor();
      const field = p.getByRole('textbox', { name: 'Tulis komentar' });
      await field.fill('Kak, IF2120 K02 di ruang mana?');
      await p.getByRole('button', { name: 'Kirim komentar' }).click();
    },
    ready: (p) =>
      p.getByRole('main').getByText('Kak, IF2120 K02 di ruang mana?').first(),
  },
  'i-filter-sheet': {
    path: '/pengumuman',
    act: async (p) => {
      await visibleText(p, P1_TITLE).waitFor();
      await p.getByRole('button', { name: /^Kategori/ }).click();
      await p
        .getByRole('dialog', { name: 'Kategori yang ditampilkan' })
        .getByRole('switch', { name: 'Akademik' })
        .click();
    },
    ready: (p) =>
      p
        .getByRole('dialog', { name: 'Kategori yang ditampilkan' })
        .getByRole('switch', { name: 'Akademik', checked: false }),
  },
  'i-compose-anggota': {
    path: '/pengumuman/tulis',
    act: async (p) => {
      await p.getByRole('button', { name: 'Umumkan' }).click();
      await p
        .getByRole('textbox', { name: 'Isi pengumuman' })
        .fill(
          'Ada yang mau bareng ke Jatinangor Sabtu pagi? Berangkat dari Ganesha 06.30.',
        );
      await p.getByRole('checkbox', { name: 'Umum' }).click();
    },
    ready: (p) => p.getByRole('checkbox', { name: 'Umum', checked: true }),
  },
  'i-desk-own-menu': {
    path: '/pengumuman/p1',
    persona: 'pengurus',
    mock: (api) => api.on('POST /api/info/:infoId/read', writes.markRead),
    act: async (p) => {
      await p
        .locator('article.g-detail')
        .getByRole('button', { name: `Opsi untuk ${P1_TITLE}` })
        .click();
    },
    ready: (p) => p.getByRole('menuitem', { name: /Bisa lagi mulai 15\.30/ }),
  },
  // P2-A: the form's interaction captures (phone, light, Nadia).
  'i-form-required': {
    path: fill,
    act: async (p) => lanjut(p),
    ready: (p) => fillMain(p).getByText('Pertanyaan ini wajib diisi').first(),
  },
  'i-form-draft-restored': {
    path: fill,
    act: async (p) => {
      await p.getByRole('radio', { name: 'PIXEL' }).check();
      await p.getByRole('radio', { name: 'IF', exact: true }).check();
      await p.getByRole('radio', { name: 'IF K2' }).check();
      await fillMain(p).getByText('Draf tersimpan').waitFor();
      await p.reload();
    },
    ready: (p) => fillMain(p).getByText('Draf tersimpan'),
  },
  'i-form-rating': {
    path: fill,
    act: async (p) => checkFill(p, 'rating'),
    ready: (p) => fillMain(p).getByText('Draf tersimpan'),
  },
  'i-form-review': {
    path: fill,
    act: async (p) => checkFill(p, 'review'),
    ready: (p) => fillMain(p).getByText('Draf tersimpan'),
  },
  'i-form-done': {
    path: fill,
    mock: (api) => api.on('POST /api/form/:formId/response', writes.submitForm),
    act: async (p) => {
      await checkFill(p, 'review');
      await p.getByRole('button', { name: 'Kirim jawaban' }).click();
      await p.getByRole('button', { name: 'Kirim', exact: true }).click();
    },
    ready: (p) => p.getByText('Form berhasil dikirim!'),
  },
  // P3-A: Live Counting after one live event (desktop, light, Raka): 143 and the new top row at 13.32.
  'i-desk-live': {
    path: '/kelola/live/pixel',
    persona: 'pengurus',
    mock: liveAsLocked,
    act: async (p, { api }) => {
      await p.getByRole('main').getByText('Tidak tertarik').waitFor();
      await expectSocket(api);
      const event = {
        total: 143,
        nim: '13525243',
        fullName: 'Pengisi baru (contoh)',
        submittedAt: '2026-10-08T06:32:00.000Z',
      };
      api.db.adminResponses.pixel.unshift({
        id: 'resp-live',
        userId: 'user-13525243',
        major: 'IF',
        angkatan: 2025,
        answers: [],
        nim: event.nim,
        fullName: event.fullName,
        submittedAt: event.submittedAt,
      });
      api.socket.emit('form:new-response', event, (s) =>
        s.rooms.has('form-admin:pixel'),
      );
    },
    ready: (p) =>
      p
        .getByRole('main')
        .locator('li')
        .first()
        .getByText('Pengisi baru (contoh)'),
  },
};

/** The live page's socket is in the PIXEL form's admin room. */
async function expectSocket(api: import('../support/mock').ApiMock) {
  for (let i = 0; i < 100; i++) {
    if (
      [...api.socket.sessions.values()].some(
        (s) => s.connected && s.rooms.has('form-admin:pixel'),
      )
    )
      return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the live page never joined form-admin:pixel');
}

const P1_TITLE = 'Jadwal UTS Ganjil 2026/2027 sudah keluar';
