/** The shell, search and theme (P0-C, P1-A, P0-A, P1-C): navigation, search, theme, keyboard, reduced-motion. */
import type { Page } from '@playwright/test';
import { greeting, navLink } from '../../support/app';
import { focusIsVisible } from '../../support/p1a';
import * as writes from '../../support/writes';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');
const mainNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigasi utama' });
const crumbs = (page: Page) =>
  page.getByRole('navigation', { name: 'Jejak halaman' });
const backButton = (page: Page) =>
  page.getByRole('button', { name: /^Kembali ke / });
const palette = (page: Page) =>
  page.getByRole('dialog', { name: 'Pencarian global' });
const field = (page: Page) =>
  palette(page).getByRole('combobox', { name: 'Cari di PIPS!' });
const options = (page: Page) => palette(page).getByRole('option');

async function expectLit(page: Page, name: string) {
  const lit = mainNav(page).locator('[aria-current="page"]');
  await expect(lit).toHaveCount(1);
  await expect(lit).toHaveAccessibleName(new RegExp(`^${name}`));
}

flow('navigation', 'nadia', {}, async ({ page, f, api, layout }) => {
  api.on('POST /api/info/:infoId/read', writes.markRead);
  const desk = layout === 'desktop';
  await f.step(
    'Beranda, lit in the navigation; the browser tab says "Beranda · PIPS!"',
    async () => {
      await f.open('/');
      await expect(greeting(page)).toBeVisible();
      await expectLit(page, 'Beranda');
      await expect(page).toHaveTitle('Beranda · PIPS!');
      await f.gate('beranda');
    },
  );
  await f.step('Pengumuman carries the unread badge: 4', async () => {
    await expect(navLink(page, 'Pengumuman')).toHaveAccessibleName(
      desk ? 'Pengumuman 4 belum dibaca' : 'Pengumuman, 4 belum dibaca',
    );
    await f.hold();
  });
  for (const [name, url, title] of [
    ['Pengumuman', /\/pengumuman$/, 'Pengumuman · PIPS!'],
    ['Kalender', /\/kalender/, 'Kalender · PIPS!'],
    ['Layanan', /\/layanan$/, 'Layanan · PIPS!'],
  ] as const)
    await f.step(`${name}: lit, with its own title`, async () => {
      await navLink(page, name).click();
      await expect(page).toHaveURL(url);
      await expectLit(page, name);
      await expect(page).toHaveTitle(title);
      await f.gate(name.toLowerCase());
    });
  await f.step(
    desk
      ? 'Your name at the sidebar’s foot opens Profil'
      : 'The avatar opens Profil',
    async () => {
      await navLink(page, 'Profil').click();
      await expect(page).toHaveURL(/\/profil$/);
      await expect(page).toHaveTitle('Profil · PIPS!');
      await expect(main(page).getByText('Nadia Putri').first()).toBeVisible();
    },
  );
  await f.step(
    desk
      ? 'Back through history'
      : 'Back returns to Layanan, where Profil was opened',
    async () => {
      if (desk) await page.goBack();
      else await backButton(page).click();
      await expect(page).toHaveURL(/\/layanan$/);
      await expectLit(page, 'Layanan');
    },
  );
  await f.step(
    'Drill down: Layanan, Ding Dong (Layanan stays lit)',
    async () => {
      await main(page)
        .getByRole('link', { name: /^Ding Dong/ })
        .first()
        .click();
      await expect(page).toHaveURL(/\/layanan\/dingdong$/);
      await expectLit(page, 'Layanan');
      await expect(page).toHaveTitle('Ding Dong · PIPS!');
      if (desk) {
        await expect(crumbs(page).getByRole('link')).toHaveText(['Layanan']);
        await expect(crumbs(page).locator('[aria-current="page"]')).toHaveText(
          'Ding Dong',
        );
      }
      await f.hold();
    },
  );
  await f.step(
    desk
      ? 'Jejak halaman: Layanan goes up'
      : 'Back goes to the page you came from',
    async () => {
      if (desk)
        await crumbs(page).getByRole('link', { name: 'Layanan' }).click();
      else {
        await expect(backButton(page)).toHaveAccessibleName(
          'Kembali ke Layanan',
        );
        await backButton(page).click();
      }
      await expect(page).toHaveURL(/\/layanan$/);
    },
  );
  await f.step(
    'A deep link with nothing before it: back goes to the parent page',
    async () => {
      await page.goto('/profil/matkul/tambah');
      await expect(page).toHaveTitle('Tambah mata kuliah · PIPS!');
      if (desk) {
        await expect(crumbs(page).getByRole('link')).toHaveText([
          'Profil',
          'Mata kuliahku',
        ]);
        await f.hold();
        await crumbs(page).getByRole('link', { name: 'Mata kuliahku' }).click();
      } else {
        await expect(backButton(page)).toHaveAccessibleName(
          'Kembali ke Mata kuliahku',
        );
        await f.hold();
        await backButton(page).click();
      }
      await expect(page).toHaveURL(/\/profil\/matkul$/);
      await expect(page).toHaveTitle('Mata kuliahku · PIPS!');
      await f.hold();
    },
  );
});

flow('search', 'nadia', {}, async ({ page, f, api, layout }) => {
  api.on('POST /api/info/:infoId/read', writes.markRead);
  const desk = layout === 'desktop';
  const open = async () => {
    if (desk) await page.keyboard.press('ControlOrMeta+k');
    else await page.getByRole('button', { name: 'Cari di PIPS!' }).click();
    await expect(palette(page)).toBeVisible();
  };
  await f.step(
    desk
      ? 'Ctrl/⌘ K opens search: Tindakan, then Pintasan'
      : 'Cari di PIPS! opens search: Tindakan, then Pintasan',
    async () => {
      await f.open('/');
      await expect(greeting(page)).toBeVisible();
      await open();
      await expect(field(page)).toBeFocused();
      await expect(options(page)).toHaveText([
        /^Buat pengumuman/,
        /^Tambah mata kuliah/,
        /^Ding Dong/,
        /^Testi Matkul/,
        /^NIM Finder/,
        /^Bayar Kas!/,
      ]);
      await f.gate('search-start');
      await f.hold();
    },
  );
  await f.step('"kas" finds Bayar Kas!', async () => {
    await f.type(field(page), 'kas');
    await expect(
      options(page).filter({ hasText: /^Bayar Kas!/ }),
    ).toBeVisible();
    await f.hold();
  });
  await f.step('"IF2110" finds the course', async () => {
    await f.type(field(page), 'IF2110');
    await expect(
      options(page).filter({
        hasText: 'IF2110 Algoritma dan Pemrograman II',
      }),
    ).toBeVisible();
    await f.hold();
  });
  await f.step(
    'Arrow keys move the highlight; up from the first goes back to the field',
    async () => {
      await f.type(field(page), 'uts');
      await expect(options(page).first()).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.keyboard.press('ArrowDown');
      await expect(options(page).nth(1)).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.keyboard.press('ArrowUp');
      await expect(options(page).first()).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(field(page)).toBeFocused();
    },
  );
  await f.step('An announcement opens with Enter', async () => {
    await f.type(field(page), 'gemastik');
    const post = options(page).filter({
      hasText: 'Cari tim Gemastik XIX? Isi form ini',
    });
    await expect(post).toBeVisible();
    await expect(post).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/pengumuman\/p2$/);
    await f.hold();
  });
  await f.step(
    '"Rak" finds people; one opens NIM Finder filled in',
    async () => {
      await page.goBack();
      await expect(greeting(page)).toBeVisible();
      await open();
      await f.type(field(page), 'Rak');
      const raka = options(page).filter({ hasText: 'Raka Pratama' });
      await expect(raka).toBeVisible();
      await f.hold();
      await raka.click();
      await expect(page).toHaveURL(/\/layanan\/nim\?q=Raka(\+|%20)Pratama$/);
      await expect(
        main(page).getByRole('searchbox', { name: 'Cari nama atau NIM' }),
      ).toHaveValue('Raka Pratama');
      await f.hold();
    },
  );
  if (desk)
    await f.step('"/" opens search too, when not typing', async () => {
      await page.locator('#isi').focus();
      await page.keyboard.press('/');
      await expect(palette(page)).toBeVisible();
      await page.keyboard.press('Escape');
    });
  await f.step('A search with no result says so', async () => {
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await open();
    await f.type(field(page), 'zzzz');
    await expect(
      palette(page).getByText('Tidak ada hasil untuk “zzzz”.'),
    ).toBeVisible();
    await f.gate('search-empty');
    await f.hold();
    await page.keyboard.press('Escape');
    await expect(palette(page)).toHaveCount(0);
  });
});

flow('theme', 'nadia', {}, async ({ page, f }) => {
  const seg = main(page).getByRole('group', { name: 'Tampilan aplikasi' });
  const state = () =>
    page.evaluate(() => ({
      dark: document.documentElement.classList.contains('dark'),
      themeColor: document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content'),
    }));
  await f.step('Profil, Tampilan: Sistem (light here)', async () => {
    await f.open('/profil');
    await seg.scrollIntoViewIfNeeded();
    await expect(seg.getByRole('radio', { name: 'Sistem' })).toBeChecked();
    expect((await state()).dark).toBe(false);
    await f.hold();
  });
  await f.step(
    'Gelap: dark at once, and the browser’s colour follows',
    async () => {
      await seg.getByText('Gelap').click();
      await expect.poll(state).toEqual({ dark: true, themeColor: '#0A0907' });
      await f.gate('profil-gelap');
      await f.hold();
    },
  );
  await f.step('A reload keeps Gelap', async () => {
    await page.reload();
    await expect(seg.getByRole('radio', { name: 'Gelap' })).toBeChecked();
    expect((await state()).dark).toBe(true);
    await f.hold();
  });
  await f.step('Terang', async () => {
    await seg.getByText('Terang').click();
    await expect.poll(state).toEqual({ dark: false, themeColor: '#FCFBF8' });
    await f.hold();
  });
  await f.step(
    'Search’s action "Ganti ke tampilan gelap" switches it too',
    async () => {
      await page.keyboard.press('ControlOrMeta+k');
      await expect(palette(page)).toBeVisible();
      await f.type(field(page), 'gelap');
      const action = options(page).filter({
        hasText: 'Ganti ke tampilan gelap',
      });
      await expect(action).toBeVisible();
      await action.click();
      await expect.poll(async () => (await state()).dark).toBe(true);
      await f.hold();
    },
  );
  await f.step('Sistem again', async () => {
    await seg.getByText('Sistem').click();
    await expect.poll(async () => (await state()).dark).toBe(false);
    await f.hold();
  });
});

flow('keyboard', 'nadia', {}, async ({ page, f }) => {
  const grid = main(page).getByRole('group', { name: 'Oktober 2026' });
  const day = (name: RegExp, month = 'Oktober 2026') =>
    main(page)
      .getByRole('group', { name: month })
      .getByRole('button', { name });
  await f.step('Tab: the skip link comes first', async () => {
    await f.open('/');
    await expect(greeting(page)).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Langsung ke isi halaman' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await f.hold();
  });
  await f.step(
    'Tab through the sidebar: a visible ring at every stop',
    async () => {
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        expect(await focusIsVisible(page), `Tab stop ${i + 2}`).toBe(true);
        await f.hold(400);
      }
    },
  );
  await f.step('Kalender from the sidebar with Enter', async () => {
    await mainNav(page)
      .getByRole('link', { name: /^Kalender/ })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/kalender/);
    await expect(grid).toBeVisible();
    await f.gate('kalender');
  });
  await f.step('The date grid: arrows, Home and End', async () => {
    await day(/^Kamis, 8 Oktober/).focus();
    await page.keyboard.press('ArrowRight');
    await expect(day(/^Jumat, 9 Oktober/)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(day(/^Jumat, 16 Oktober/)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(day(/^Senin, 12 Oktober/)).toBeFocused();
    await page.keyboard.press('End');
    await expect(day(/^Minggu, 18 Oktober/)).toBeFocused();
    expect(await focusIsVisible(page)).toBe(true);
    await f.hold();
  });
  await f.step('Page Down and Page Up change the month', async () => {
    await page.keyboard.press('PageDown');
    await expect(day(/^Rabu, 18 November/, 'November 2026')).toBeFocused();
    await page.keyboard.press('PageUp');
    await expect(day(/^Minggu, 18 Oktober/)).toBeFocused();
    await f.hold();
  });
  await f.step('Enter chooses Jumat 9', async () => {
    for (const key of ['Home', 'ArrowUp', 'End', 'ArrowLeft', 'ArrowLeft'])
      await page.keyboard.press(key);
    await expect(day(/^Jumat, 9 Oktober/)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(day(/^Jumat, 9 Oktober/)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  await f.step(
    'Search is a dialog: focus stays inside; Escape closes it and gives focus back',
    async () => {
      const opener = page.getByRole('button', { name: /^Cari/ });
      await opener.focus();
      await page.keyboard.press('Enter');
      await expect(palette(page)).toBeVisible();
      await expect(field(page)).toBeFocused();
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab');
        expect(
          await page.evaluate(
            () => !!document.activeElement?.closest('[role="dialog"]'),
          ),
        ).toBe(true);
      }
      await f.gate('search-keyboard');
      await page.keyboard.press('Escape');
      await expect(palette(page)).toHaveCount(0);
      await expect(opener).toBeFocused();
      await f.hold();
    },
  );
});

flow(
  'reduced-motion',
  'nadia',
  { reducedMotion: 'reduce' },
  async ({ page, f }) => {
    const running = () =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === 'running')
            .length,
      );
    await f.step(
      'Beranda: the agenda’s bars appear without drawing',
      async () => {
        await f.open('/');
        const bar = page
          .getByRole('region', { name: '8 hari ke depan' })
          .locator('.g-mbars i')
          .first();
        await expect(bar).toBeVisible();
        expect(
          await bar.evaluate((el) => getComputedStyle(el).animationName),
        ).toBe('none');
        expect(await running()).toBe(0);
        await f.hold();
      },
    );
    await f.step('A tab switch: nothing moves', async () => {
      await navLink(page, 'Pengumuman').click();
      await expect(page).toHaveURL(/\/pengumuman$/);
      expect(await running()).toBe(0);
      await f.hold();
    });
    await f.step('A sheet opens without sliding', async () => {
      await page.getByRole('button', { name: /^Kategori/ }).click();
      const sheet = page.getByRole('dialog', {
        name: 'Kategori yang ditampilkan',
      });
      await expect(sheet).toBeVisible();
      expect(await running()).toBe(0);
      await f.gate('filter-sheet-reduced');
      await f.hold();
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
    });
  },
);
