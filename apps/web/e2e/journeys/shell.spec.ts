/**
 * The app shell (P0-C): the tab bar on phones, the rail on tablets, the sidebar on desktop, the top bar and back,
 * the desktop breadcrumbs, Beranda's gold header, focused flows, global search, and their accessibility. The
 * pages inside are today's screens until their redesign tasks; these journeys check the shell around them.
 * "@phone-only" journeys run on phones and tablets (the touch layouts), "@desktop-only" ones on desktop.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { greeting, layoutOf } from '../support/app';
import { AXE_TAGS } from '../support/audit';
import { expect, test } from '../support/test';

const mainNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Navigasi utama' });
const navItem = (page: Page, name: string) =>
  mainNav(page).getByRole('link', { name: new RegExp(`^${name}`) });
const crumbs = (page: Page) =>
  page.getByRole('navigation', { name: 'Jejak halaman' });
const topTitle = (page: Page) => page.locator('.g-top-title');
const backButton = (page: Page) =>
  page.getByRole('button', { name: /^Kembali ke / });
const palette = (page: Page) =>
  page.getByRole('dialog', { name: 'Pencarian global' });
const isDark = (t: TestInfo) => t.project.name.endsWith('dark');

/** Exactly one item lit (aria-current="page") in the main navigation, and it is `name`. */
async function expectLit(page: Page, name: string) {
  const lit = mainNav(page).locator('[aria-current="page"]');
  await expect(lit).toHaveCount(1);
  await expect(lit).toHaveAccessibleName(new RegExp(`^${name}`));
}

/** No serious or critical axe violation in the shell; today's screens inside (`data-legacy`) are left out. */
async function expectShellAccessible(page: Page, where: string) {
  const result = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('[data-legacy]')
    .setLegacyMode(true)
    .analyze();
  const bad = result.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    );
  expect(bad, `axe on ${where}`).toEqual([]);
}

/** Neither the window nor the shell's scrolling area scrolls sideways, and no shell text is under 12 px. */
async function expectFits(page: Page, where: string) {
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const scroller = document.querySelector<HTMLElement>(
      '[data-scroll-restoration-id="isi"]',
    );
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      '.g-shell *, .g-desk *',
    )) {
      if (el.closest('[data-legacy]') || !el.childNodes.length) continue;
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent?.trim(),
      );
      if (!own || !el.checkVisibility()) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 12) small.push(`${el.className}: ${size}px`);
    }
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      scroller: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
      small,
    };
  });
  expect(m, where).toEqual({ doc: 0, scroller: 0, small: [] });
}

/** The navigation's destinations in order, by name; Pengumuman may add its unread count (P1-B). */
async function expectDestinations(nav: Locator, names: string[]) {
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(names.length);
  for (const [i, name] of names.entries())
    await expect(links.nth(i)).toHaveAccessibleName(
      name === 'Pengumuman' ? /^Pengumuman(,? \d+\+? belum dibaca)?$/ : name,
    );
}

test.describe('navigation', () => {
  test('the four destinations, the one you are on lit, in the layout’s own navigation', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    const layout = layoutOf(testInfo);
    const nav = mainNav(page);
    await expect(nav).toHaveCount(1);
    // By name: since P1-B, Pengumuman carries the unread count ("Pengumuman, 4 belum dibaca").
    await expectDestinations(nav, [
      'Beranda',
      'Pengumuman',
      'Kalender',
      'Layanan',
    ]);
    const box = (await nav.boundingBox())!;
    const vp = page.viewportSize()!;
    if (layout === 'phone') {
      // A bar across the bottom, every label at least 12 px.
      expect(box.x).toBe(0);
      expect(box.width).toBe(vp.width);
      expect(Math.round(box.y + box.height)).toBe(vp.height);
    } else if (layout === 'tablet') {
      // An 88 px rail down the left.
      const rail = (await page.locator('.g-tabbar').boundingBox())!;
      expect(rail).toMatchObject({ x: 0, y: 0, width: 88, height: vp.height });
    } else {
      // The sidebar: the official logo, the wordmark, HMIF ITB, search and you at the foot.
      const side = (await page.locator('.g-side').boundingBox())!;
      expect(side).toMatchObject({ x: 0, width: 248, height: vp.height });
      const logo = page.locator('.g-side-brand img');
      await expect(logo).toHaveAttribute('src', '/logo/hmif.png');
      expect((await logo.boundingBox())!.width).toBe(54);
      await expect(page.locator('.g-side-brand')).toContainText('PIPS!');
      await expect(page.locator('.g-side-brand')).toContainText('HMIF ITB');
      await expect(
        page.getByRole('button', { name: /^Cari/ }).locator('kbd'),
      ).toHaveText(/^(Ctrl K|⌘K)$/);
      await expect(
        page.getByRole('link', { name: 'Nadia Putri Profil' }),
      ).toBeVisible();
    }
    await expectLit(page, 'Beranda');
    for (const [name, url] of [
      ['Pengumuman', /\/pengumuman$/],
      ['Kalender', /\/kalender/],
      ['Layanan', /\/layanan$/],
      ['Beranda', /\/$/],
    ] as const) {
      await navItem(page, name).click();
      await expect(page).toHaveURL(url);
      await expectLit(page, name);
    }
  });

  test('the tab bar is there at once, never animated in', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/pengumuman');
    const nav = mainNav(page);
    await expect(nav).toBeVisible();
    const moving = await nav.evaluate(
      (el) =>
        el
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === 'running').length,
    );
    expect(moving).toBe(0);
  });

  test('a page below a destination lights it and shows its title; the document title names it', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan/dingdong');
    await expectLit(page, 'Layanan');
    await expect(page).toHaveTitle('Ding Dong · PIPS!');
    if (layoutOf(testInfo) === 'desktop') {
      // "Layanan › Ding Dong", Layanan a link, Ding Dong the current page.
      await expect(crumbs(page)).toBeVisible();
      await expect(crumbs(page).getByRole('link')).toHaveText(['Layanan']);
      await expect(crumbs(page).locator('[aria-current="page"]')).toHaveText(
        'Ding Dong',
      );
      await expect(crumbs(page).locator('svg')).toHaveCount(1);
      await crumbs(page).getByRole('link', { name: 'Layanan' }).click();
      await expect(page).toHaveURL(/\/layanan$/);
      await expect(crumbs(page)).toHaveCount(0);
    } else {
      await expect(topTitle(page)).toHaveText('Ding Dong');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Ding Dong' }),
      ).toBeVisible();
      await expect(crumbs(page)).toHaveCount(0);
    }
  });

  test('a deeper page’s breadcrumbs follow its route @desktop-only', async ({
    page,
  }) => {
    await page.goto('/profil/matkul/tambah');
    await expect(crumbs(page).getByRole('link')).toHaveText([
      'Profil',
      'Mata kuliahku',
    ]);
    await expect(crumbs(page).locator('[aria-current="page"]')).toHaveText(
      'Tambah mata kuliah',
    );
    await expect(
      page.getByRole('link', { name: 'Nadia Putri Profil' }),
    ).toHaveAttribute('aria-current', 'page');
    await crumbs(page).getByRole('link', { name: 'Mata kuliahku' }).click();
    await expect(page).toHaveURL(/\/profil\/matkul$/);
    await expect(page).toHaveTitle('Mata kuliahku · PIPS!');
  });
});

test.describe('back', () => {
  test('with no page of the app before it, back goes up to the page above, replacing this one @phone-only', async ({
    page,
  }) => {
    await page.goto('/layanan/dingdong');
    const length = await page.evaluate(() => history.length);
    await expect(backButton(page)).toHaveAccessibleName('Kembali ke Layanan');
    await backButton(page).click();
    await expect(page).toHaveURL(/\/layanan$/);
    expect(await page.evaluate(() => history.length)).toBe(length);
    // A tab's own page has search and your avatar instead of back.
    await expect(backButton(page)).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Cari di PIPS!' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Profil, Nadia Putri' }),
    ).toBeVisible();
  });

  test('after moving inside the app, back returns to the page you came from @phone-only', async ({
    page,
  }) => {
    await page.goto('/kalender');
    await page.getByRole('button', { name: 'Cari di PIPS!' }).click();
    await palette(page).getByRole('combobox').fill('ding');
    await palette(page)
      .getByRole('option', { name: /Ding Dong/ })
      .click();
    await expect(page).toHaveURL(/\/layanan\/dingdong$/);
    await expectLit(page, 'Layanan');
    await expect(backButton(page)).toHaveAccessibleName('Kembali ke Kalender');
    await backButton(page).click();
    await expect(page).toHaveURL(/\/kalender/);
    await expectLit(page, 'Kalender');
  });

  test('Profil opens from your avatar, keeps your tab lit, and back returns there @phone-only', async ({
    page,
  }) => {
    await page.goto('/kalender');
    await page.getByRole('link', { name: 'Profil, Nadia Putri' }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(topTitle(page)).toHaveText('Profil');
    await expectLit(page, 'Kalender');
    await expect(backButton(page)).toHaveAccessibleName('Kembali ke Kalender');
    await backButton(page).click();
    await expect(page).toHaveURL(/\/kalender/);
    // Opened from a link with nothing before it, Profil goes back to the tab you were last on.
    await page.goto('/profil');
    await expect(backButton(page)).toHaveAccessibleName('Kembali ke Kalender');
  });
});

test.describe('focused flows', () => {
  for (const [path, title] of [
    ['/pengumuman/tulis', 'Buat pengumuman'],
    ['/layanan/form/pixel', 'Form'],
    ['/layanan/curhat/r1', 'Ruang'],
  ] as const) {
    test(`${path} hides the tab bar and rail and keeps back @phone-only`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(topTitle(page)).toHaveText(title);
      await expect(backButton(page)).toBeVisible();
      await expect(mainNav(page)).toHaveCount(0);
      await expect(page.locator('.g-tabbar')).toHaveCount(0);
    });
  }

  test('the sidebar stays in a focused flow on desktop @desktop-only', async ({
    page,
  }) => {
    await page.goto('/layanan/form/pixel');
    await expect(mainNav(page)).toBeVisible();
    await expectLit(page, 'Layanan');
    await expect(crumbs(page).getByRole('link')).toHaveText([
      'Layanan',
      'Form',
    ]);
  });
});

test.describe('today’s screens inside the shell', () => {
  // Regression: today's screens fill "the screen" (h-screen), built for a navbar that floated over them. Inside
  // the shell they ran under the tab bar: Curhat's new-room button was half hidden and the page scrolled twice.
  test('a screen that fills the window fits between the bars, its own scrolling intact', async ({
    page,
  }) => {
    await page.goto('/layanan/form');
    await expect(
      page.getByRole('main').getByText('Form Analisis Kondisi PIXEL').first(),
    ).toBeVisible();
    const overflow = await page
      .locator('[data-scroll-restoration-id="isi"]')
      .evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('Curhat’s new-room button sits above the tab bar @phone-only', async ({
    page,
  }) => {
    await page.goto('/layanan/curhat');
    const button = page.getByRole('button', { name: 'create chatroom' });
    await expect(button).toBeVisible();
    const b = (await button.boundingBox())!;
    const bar = (await page.locator('.g-tabbar').boundingBox())!;
    const vp = page.viewportSize()!;
    // Phones: above the bottom bar. Tablets: the rail is at the side, so above the window's bottom.
    const limit = bar.y > 0 ? bar.y : vp.height;
    expect(b.y + b.height).toBeLessThanOrEqual(limit);
  });
});

test.describe('Beranda’s gold header', () => {
  test('search and your avatar in a gold bar that stays at the top; the browser bar turns gold @phone-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    const bar = page.locator('header.g-top.gold');
    const hero = isDark(testInfo) ? 'rgb(51, 39, 11)' : 'rgb(248, 194, 73)';
    await expect(bar).toHaveCSS('background-color', hero);
    await expect(page.locator('.g-hero')).toHaveCSS('background-color', hero);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      isDark(testInfo) ? '#33270B' : '#F8C249',
    );
    const search = bar.getByRole('button', { name: 'Cari di PIPS!' });
    const avatar = bar.getByRole('link', { name: 'Profil, Nadia Putri' });
    expect((await search.boundingBox())!.height).toBe(44);
    expect(await avatar.boundingBox()).toMatchObject({
      width: 44,
      height: 44,
    });
    // The halftone at the header's right edge, decorative; no logo in the header.
    const ht = page.locator('.g-hero-ht');
    await expect(ht.locator('[aria-hidden="true"]')).toHaveCount(1);
    const htBox = (await ht.boundingBox())!;
    expect(Math.round(htBox.x + htBox.width)).toBe(page.viewportSize()!.width);
    await expect(page.locator('.g-top img, .g-hero img')).toHaveCount(0);
    // It stays at the top while the page scrolls.
    await page
      .locator('[data-scroll-restoration-id="isi"]')
      .evaluate((el) => el.scrollTo({ top: 400 }));
    expect((await bar.boundingBox())!.y).toBe(0);
    // Leaving Beranda gives the browser bar the page colour back.
    await page
      .getByRole('navigation', { name: 'Navigasi utama' })
      .getByRole('link', { name: /^Layanan/ })
      .click();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      isDark(testInfo) ? '#0A0907' : '#FCFBF8',
    );
  });

  test('on tablets the gold bar and the greeting keep the locked screens’ edges beside the rail @phone-only', async ({
    page,
  }, testInfo) => {
    // Review M1: they were pulled into the 720 px column (31 px from the rail at 834 px, 115 px at 1000 px).
    test.skip(layoutOf(testInfo) !== 'tablet', 'the rail is the tablet layout');
    for (const width of [834, 1000]) {
      await page.setViewportSize({ width, height: 1112 });
      await page.goto('/');
      await expect(greeting(page)).toBeVisible();
      const rail = (await page.locator('.g-tabbar').boundingBox())!;
      const edge = rail.x + rail.width;
      const field = (await page
        .locator('header.g-top.gold')
        .getByRole('button', { name: 'Cari di PIPS!' })
        .boundingBox())!;
      const hello = (await page.locator('.g-hero-hi').boundingBox())!;
      expect(Math.round(field.x - edge), `field at ${width} px`).toBe(16);
      expect(Math.round(hello.x - edge), `greeting at ${width} px`).toBe(18);
    }
  });

  test('no gold header on desktop; the greeting is the page title @desktop-only', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await expect(page.locator('.g-top')).toHaveCount(0);
    await expect(page.locator('.g-hero')).toHaveCount(0);
    await expect(greeting(page)).toHaveClass(/t-display-l/);
  });
});

test.describe('global search', () => {
  test('opens from the keyboard, starts with Pintasan, finds a service and opens it', async ({
    page,
  }, testInfo) => {
    await page.goto('/pengumuman');
    await expect(mainNav(page)).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette(page)).toBeVisible();
    const field = palette(page).getByRole('combobox', {
      name: 'Cari di PIPS!',
    });
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute(
      'placeholder',
      'Cari layanan, pengumuman, acara, orang…',
    );
    await expect(palette(page).getByRole('option')).toHaveText([
      /^Ding Dong/,
      /^Testi Matkul/,
      /^NIM Finder/,
      /^Bayar Kas!Situs luar$/,
    ]);
    await expect(palette(page).getByText('Pintasan')).toBeVisible();
    // Key hints on desktop; phones and tablets have Tutup instead.
    const hints = palette(page).getByText('Enter buka');
    if (layoutOf(testInfo) === 'desktop') await expect(hints).toBeVisible();
    else await expect(hints).toBeHidden();
    await field.fill('kas');
    await expect(palette(page).getByRole('option')).toHaveText([/^Bayar Kas!/]);
    await field.fill('nim');
    await expect(palette(page).getByRole('option').first()).toHaveText(
      /^NIM Finder/,
    );
    // The first result is chosen; arrows move; Enter opens.
    await expect(palette(page).getByRole('option').first()).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Enter');
    await expect(palette(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/layanan\/nim$/);
    await expect(page).toHaveTitle('NIM Finder · PIPS!');
    // Focus moves to the new page's title (phones and tablets) or its main landmark (desktop, today's screen).
    if (layoutOf(testInfo) === 'desktop')
      await expect(page.locator('#isi')).toBeFocused();
    else await expect(topTitle(page)).toBeFocused();
  });

  test('Escape closes it and focus goes back to what opened it; nothing found says so', async ({
    page,
  }, testInfo) => {
    await page.goto('/layanan');
    await expect(mainNav(page)).toBeVisible();
    const opener =
      layoutOf(testInfo) === 'desktop'
        ? page.getByRole('button', { name: /^Cari/ })
        : page.getByRole('button', { name: 'Cari di PIPS!' });
    await opener.click();
    await expect(palette(page)).toBeVisible();
    const field = palette(page).getByRole('combobox');
    await field.fill('zzz');
    await expect(palette(page).getByRole('option')).toHaveCount(0);
    await expect(palette(page)).toContainText('Tidak ada hasil untuk “zzz”.');
    await page.keyboard.press('Escape');
    await expect(palette(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
    // Tutup closes it too.
    await opener.click();
    await palette(page).getByRole('button', { name: 'Tutup' }).click();
    await expect(palette(page)).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('arrows move through the results and “/” opens search when not typing', async ({
    page,
  }) => {
    await page.goto('/kalender');
    await expect(mainNav(page)).toBeVisible();
    await page.locator('body').press('/');
    await expect(palette(page)).toBeVisible();
    const options = palette(page).getByRole('option');
    await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/layanan\/nim$/);
  });

  test('an external service opens in a new tab and PIPS! stays', async ({
    page,
  }) => {
    await page.goto('/layanan');
    await expect(mainNav(page)).toBeVisible();
    // The harness keeps the outside world out, so record what the app asks the browser to open.
    await page.evaluate(() => {
      (window as unknown as { opened: unknown[] }).opened = [];
      window.open = (...args: unknown[]) => {
        (window as unknown as { opened: unknown[] }).opened.push(args);
        return null;
      };
    });
    await page.keyboard.press('ControlOrMeta+k');
    await palette(page)
      .getByRole('option', { name: /^Bayar Kas!/ })
      .click();
    await expect(palette(page)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { opened: unknown[] }).opened,
      ),
    ).toEqual([
      ['https://s.hmif.dev/BayarKasHMIF', '_blank', 'noopener,noreferrer'],
    ]);
    await expect(page).toHaveURL(/\/layanan$/);
    // Review m1: focus was left on nothing. Opened from the keyboard, it goes to the page.
    await expect(page.locator('#isi')).toBeFocused();
  });

  test('opening something that leaves you on this page gives focus back to what opened search', async ({
    page,
  }, testInfo) => {
    const desk = layoutOf(testInfo) === 'desktop';
    // Phones and tablets have the search button on a tab's own page; the desktop sidebar has it everywhere.
    await page.goto(desk ? '/layanan/nim' : '/layanan');
    await expect(mainNav(page)).toBeVisible();
    await page.evaluate(() => {
      window.open = () => null;
    });
    const opener = desk
      ? page.getByRole('button', { name: /^Cari/ })
      : page.getByRole('button', { name: 'Cari di PIPS!' });
    // An outside service, then (desktop) the page you are already on.
    for (const name of desk
      ? [/^Bayar Kas!/, /^NIM Finder/]
      : [/^Bayar Kas!/]) {
      await opener.click();
      await palette(page).getByRole('option', { name }).click();
      await expect(palette(page)).toHaveCount(0);
      await expect(page).toHaveURL(desk ? /\/layanan\/nim$/ : /\/layanan$/);
      await expect(opener).toBeFocused();
    }
    if (desk) return;
    // Opened from the keyboard on the page you then choose: focus goes to the page's title.
    await page.goto('/layanan/nim');
    await expect(topTitle(page)).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await palette(page)
      .getByRole('option', { name: /^NIM Finder/ })
      .click();
    await expect(palette(page)).toHaveCount(0);
    await expect(topTitle(page)).toBeFocused();
  });
});

test.describe('the search shortcut’s name follows the platform, as the prototype’s', () => {
  for (const [platform, label] of [
    ['MacIntel', '⌘K'],
    ['Linux x86_64', 'Ctrl K'],
    ['Win32', 'Ctrl K'],
  ] as const) {
    test.describe(platform, () => {
      test.use({ platform });
      test(`${label} on ${platform} @desktop-only`, async ({ page }) => {
        await page.goto('/');
        await expect(
          page.getByRole('button', { name: /^Cari/ }).locator('kbd'),
        ).toHaveText(label);
      });
    });
  }
});

test.describe('Kelola', () => {
  test.use({ persona: 'pengurus' });

  test('one sidebar item, lit on Kelola’s pages, with breadcrumbs from it @desktop-only', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(greeting(page, 'Raka')).toBeVisible();
    await expectDestinations(mainNav(page), [
      'Beranda',
      'Pengumuman',
      'Kalender',
      'Layanan',
      'Kelola',
    ]);
    await navItem(page, 'Kelola').click();
    await expect(page).toHaveURL(/\/kelola$/);
    await expectLit(page, 'Kelola');
    await expect(crumbs(page)).toHaveCount(0);
    await page.goto('/kelola/live');
    await expectLit(page, 'Kelola');
    await expect(crumbs(page).getByRole('link')).toHaveText(['Kelola']);
    // The prototype's titleOf and the locked desk-pengurus-live screen: "Kelola › Live Counting".
    await expect(crumbs(page).locator('[aria-current="page"]')).toHaveText(
      'Live Counting',
    );
  });

  test('on phones and tablets Kelola belongs to Layanan @phone-only', async ({
    page,
  }) => {
    await page.goto('/kelola');
    await expect(mainNav(page).getByRole('link')).toHaveCount(4);
    await expectLit(page, 'Layanan');
    await expect(backButton(page)).toHaveAccessibleName('Kembali ke Layanan');
  });
});

test.describe('Nadia, anggota', () => {
  test('no Kelola in the sidebar for a member @desktop-only', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await expect(navItem(page, 'Kelola')).toHaveCount(0);
  });
});

test.describe('accessibility', () => {
  test('a skip link, one main landmark, and the shell passes axe with search open', async ({
    page,
  }) => {
    await page.goto('/layanan/dingdong');
    await expect(mainNav(page)).toHaveCount(1);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Langsung ke isi halaman' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('#isi')).toBeFocused();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'id');
    await expectShellAccessible(page, 'a drill-down page');
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await expectShellAccessible(page, 'Beranda');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette(page)).toBeVisible();
    await expectShellAccessible(page, 'search');
  });

  test('every shell control on a touch layout has a 44 px target @phone-only', async ({
    page,
  }) => {
    const sizes = async (selector: string) =>
      page.evaluate(
        (selector) =>
          [...document.querySelectorAll<HTMLElement>(selector)].map((el) => {
            const r = el.getBoundingClientRect();
            const before = getComputedStyle(el, '::before');
            const hit =
              before.content !== 'none' && before.position === 'absolute'
                ? {
                    w: r.width - 2 * Math.min(0, parseFloat(before.left)),
                    h: r.height - 2 * Math.min(0, parseFloat(before.top)),
                  }
                : { w: r.width, h: r.height };
            return {
              name: el.getAttribute('aria-label') ?? el.textContent,
              ok: hit.w >= 44 && hit.h >= 44,
            };
          }),
        selector,
      );
    for (const path of ['/', '/pengumuman', '/layanan/dingdong']) {
      await page.goto(path);
      await expect(page.locator('.g-top')).toBeVisible();
      const all = await sizes('.g-tab, .g-top a, .g-top button');
      expect(all.length).toBeGreaterThan(2);
      expect(all.filter((s) => !s.ok)).toEqual([]);
    }
    // Review m2: search's Tutup had a 32 px target.
    await page.goto('/');
    await page.getByRole('button', { name: 'Cari di PIPS!' }).click();
    await expect(palette(page)).toBeVisible();
    const close = await sizes('.g-palette button');
    expect(close.map((s) => s.name)).toContain('Tutup');
    expect(close.filter((s) => !s.ok)).toEqual([]);
  });

  test('the shell fits, without sideways scrolling, at 320, 390, 768, 1024 and 1440 px and at 200% zoom', async ({
    page,
  }, testInfo) => {
    test.skip(
      layoutOf(testInfo) !== 'desktop',
      'one run covers every width; the desktop project resizes the window',
    );
    for (const [width, height] of [
      [320, 640],
      [390, 844],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      // 1440 × 900 at 200% zoom shows 720 × 450 CSS px.
      [720, 450],
    ]) {
      await page.setViewportSize({ width, height });
      for (const path of ['/', '/layanan/dingdong']) {
        await page.goto(path);
        await expect(page.locator('#isi')).toBeAttached();
        await expect(mainNav(page)).toBeVisible();
        await expectFits(page, `${path} at ${width} px`);
      }
    }
  });
});
