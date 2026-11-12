/**
 * Masuk: the keyboard header, the four slides, Masuk dengan Google with
 * Google's one-colour G, the loader, every real error state, at phone, tablet and desktop in light and dark. The
 * sign-in flow itself (redirects, Coba lagi's token, Google's popup) is sign-in.spec.ts's. Motion with no preference is in qa/motion.spec.ts.
 */
import type { Locator, Page } from '@playwright/test';
import { layoutOf } from '../support/app';
import { fakeGoogle, googleAnswers, googleRequests } from '../support/google';
import { reply } from '../support/mock';
import { strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const SLIDES = ['Pengumuman', 'Kalender', 'Layanan', 'Curhat Yuk!'];
/** The keys each slide lights in the header. */
const LIT = [
  ['pengumuman'],
  ['kalender'],
  ['folder', 'testi', 'nim'],
  ['curhat'],
];
const MSG = {
  401: 'Akun ini belum bisa masuk. Pakai email mahasiswa (NIM@std.stei.itb.ac.id); kalau sudah, akunmu mungkin belum ada di daftar anggota HMIF.',
  gagal: 'PIPS! belum bisa memproses masuk. Periksa koneksimu, lalu coba lagi.',
  popup:
    'Jendela masuk Google diblokir browser. Izinkan pop-up untuk PIPS!, lalu coba lagi.',
};

const google = (page: Page) =>
  page.getByRole('button', { name: 'Masuk dengan Google' });
const carousel = (page: Page) =>
  page.getByRole('region', { name: 'Kenalan dengan PIPS!' });
const track = (page: Page) =>
  carousel(page).getByLabel('Geser untuk slide berikutnya');
const dot = (page: Page, i: number) =>
  carousel(page).getByRole('button', { name: SLIDES[i], exact: true });
const googleReady = (page: Page) =>
  expect.poll(async () => (await googleRequests(page)).clients.length).toBe(1);

/** The keys lit in the header now. */
const lit = (page: Page) =>
  page
    .locator('.g-mk-key.on')
    .evaluateAll((keys) => keys.map((k) => (k as HTMLElement).dataset.key));

/** Slide i is the one shown: its dot is current, its keys are lit, and the track has scrolled to it. */
async function onSlide(page: Page, i: number) {
  await expect(dot(page, i)).toHaveAttribute('aria-current', 'true');
  await expect(carousel(page).locator('[aria-current]')).toHaveCount(1);
  await expect.poll(() => lit(page)).toEqual(LIT[i]);
  await expect
    .poll(() =>
      track(page).evaluate((t) => Math.round(t.scrollLeft / t.clientWidth)),
    )
    .toBe(i);
  await expect(
    carousel(page).getByRole('group', { name: `${i + 1} dari 4` }),
  ).toBeInViewport();
}

const box = async (l: Locator) => (await l.boundingBox())!;

/** Presses a header key and reads, on the next frame, whether it shows pressed (for 160 ms only). */
const pressKey = (key: Locator) =>
  key.evaluate(async (k) => {
    k.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    return k.classList.contains('down');
  });

test.use({ signedIn: false });

test('the keyboard header, the greeting, the slides and Masuk dengan Google, in this layout', async ({
  page,
}, testInfo) => {
  await page.goto('/login');
  await expect(page).toHaveTitle('Masuk · PIPS!');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Halo, Pips!',
  );
  await expect(page.locator('h1:visible')).toHaveCount(1);
  // The slides: the features' own names and one plain line each, in a labelled carousel.
  await expect(carousel(page).getByRole('heading', { level: 2 })).toHaveText(
    SLIDES,
  );
  await expect(
    carousel(page).getByText('Info dari HMIF untuk angkatan dan grupmu.'),
  ).toBeVisible();
  await expect(carousel(page)).toHaveAttribute(
    'aria-roledescription',
    'carousel',
  );
  await expect(carousel(page).getByRole('group')).toHaveCount(4);
  // There is no hint under the greeting.
  await expect(
    page.getByText(/Pakai akun Google email mahasiswamu/),
  ).toHaveCount(0);
  // The header: nine keys (eight services and the gold PIPS! key) and four pixel reactions, hidden from screen
  // readers; the first slide's key is lit.
  const board = page.locator('.g-mk-board');
  await expect(board).toHaveAttribute('aria-hidden', 'true');
  await expect(board.locator('.g-mk-key')).toHaveCount(9);
  await expect(board.locator('.g-mk-key.home')).toContainText('PIPS');
  await expect(board.locator('.g-mk-px')).toHaveCount(4);
  await onSlide(page, 0);

  // Google's G: whole (four paths), one colour (the button's ink), no backing, hidden from screen readers.
  const g = await google(page).evaluate((b) => {
    const svg = b.querySelector('.g-mk-g svg')!;
    const r = svg.getBoundingClientRect();
    return {
      paths: svg.querySelectorAll('path').length,
      fills: [...svg.querySelectorAll('path')].map((p) =>
        p.getAttribute('fill'),
      ),
      tint: getComputedStyle(svg).fill,
      ink: getComputedStyle(b).color,
      bg: getComputedStyle(svg.parentElement!).backgroundColor,
      hidden: svg.parentElement!.getAttribute('aria-hidden'),
      w: r.width,
      h: r.height,
    };
  });
  expect(g).toEqual({
    paths: 4,
    fills: [null, null, null, null],
    tint: g.ink,
    ink: g.ink,
    bg: 'rgba(0, 0, 0, 0)',
    hidden: 'true',
    w: 20,
    h: 20,
  });

  // HMIF's logo: the official file, once, whole; on the gold hero (phones and tablets) on an ink plate.
  const logo = page.locator('img[src="/logo/hmif.png"]');
  await expect(logo).toHaveCount(1);
  const l = await logo.evaluate((img: HTMLImageElement) => {
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    const pts = [
      [r.left + 2, r.top + 2],
      [r.right - 2, r.top + 2],
      [r.left + 2, r.bottom - 2],
      [r.right - 2, r.bottom - 2],
      [r.left + r.width / 2, r.top + r.height / 2],
    ];
    return {
      natural: img.naturalWidth,
      ratio: Math.abs(r.width / r.height - 800 / 533) < 0.02,
      w: r.width,
      filter: cs.filter,
      opacity: cs.opacity,
      uncovered: pts.every(([x, y]) => document.elementFromPoint(x, y) === img),
      plate: getComputedStyle(img.parentElement!).backgroundColor,
    };
  });
  const desk = layoutOf(testInfo) === 'desktop';
  expect(l).toMatchObject({
    natural: 800,
    ratio: true,
    w: desk ? 54 : 48,
    filter: 'none',
    opacity: '1',
    uncovered: true,
  });
  if (!desk) expect(l.plate).toBe('rgb(27, 21, 8)');

  // The layout: desktop splits the window (the hero and its slides left, signing in right); phones and tablets stack
  // the hero over the sheet, the tablet in one 520 px column. The button is in view without scrolling.
  const hero = await box(page.locator('.g-mk-hero'));
  const vp = page.viewportSize()!;
  const go = await box(google(page));
  expect(go.y + go.height).toBeLessThanOrEqual(vp.height);
  if (desk) {
    const side = await box(page.locator('.g-mk-side'));
    expect(hero.x + hero.width).toBeLessThanOrEqual(side.x + 1);
    expect(Math.abs(hero.y - side.y)).toBeLessThan(1);
    expect((await box(carousel(page))).y).toBeGreaterThan(hero.y);
    await expect(
      carousel(page).getByRole('button', { name: 'Slide berikutnya' }),
    ).toBeVisible();
  } else {
    const sheet = await box(page.locator('.g-mk-sheet'));
    expect(sheet.y).toBeGreaterThan(hero.y);
    const slide = await box(carousel(page).getByRole('group').first());
    if (layoutOf(testInfo) === 'tablet') {
      expect(slide.width).toBeLessThanOrEqual(520.5);
      expect(slide.width).toBeGreaterThan(400);
    } else expect(go.width).toBeGreaterThan(vp.width - 60);
    await expect(
      carousel(page).getByRole('button', { name: 'Slide berikutnya' }),
    ).toHaveCount(0);
  }
  await strictGates(page, testInfo, 'masuk', null);
});

test('the slides move by dot, arrow key and swipe, and the header answers each', async ({
  page,
}) => {
  await page.goto('/login');
  await onSlide(page, 0);
  await dot(page, 2).click();
  await onSlide(page, 2);
  await track(page).focus();
  await page.keyboard.press('ArrowRight');
  await onSlide(page, 3);
  // Past the last slide: it stays.
  await page.keyboard.press('ArrowRight');
  await onSlide(page, 3);
  await page.keyboard.press('ArrowLeft');
  await onSlide(page, 2);
  // A swipe is the track's own scrolling.
  await track(page).evaluate((t) =>
    t.scrollTo({ left: t.clientWidth, behavior: 'instant' }),
  );
  await onSlide(page, 1);
  await track(page).evaluate((t) =>
    t.scrollTo({ left: 0, behavior: 'instant' }),
  );
  await onSlide(page, 0);
});

test('a real swipe on a touch screen moves to the next slide @phone-only', async ({
  page,
}) => {
  await page.goto('/login');
  await onSlide(page, 0);
  const t = await box(track(page));
  const y = t.y + t.height / 2;
  // A finger drags 60 % of the track to the left in small steps, as touch events through the browser's input
  // pipeline. (CDP's synthesizeScrollGesture scrolls nothing in CI's Linux headless shell, so it isn't used.)
  const cdp = await page.context().newCDPSession(page);
  const x0 = Math.round(t.x + t.width * 0.8);
  const dx = Math.round(t.width * 0.6);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y: Math.round(y) }],
    });
  await touch('touchStart', x0);
  for (let s = 1; s <= 12; s++) await touch('touchMove', x0 - (dx * s) / 12);
  await touch('touchEnd', x0 - dx);
  await onSlide(page, 1);
});

test('desktop arrows move the slides and keep focus @desktop-only', async ({
  page,
}) => {
  await page.goto('/login');
  const next = carousel(page).getByRole('button', { name: 'Slide berikutnya' });
  const prev = carousel(page).getByRole('button', { name: 'Slide sebelumnya' });
  await next.click();
  await onSlide(page, 1);
  await expect(next).toBeFocused();
  await prev.click();
  await onSlide(page, 0);
  // Before the first slide: it stays.
  await prev.click();
  await onSlide(page, 0);
  // By keyboard too.
  await next.focus();
  await page.keyboard.press('Enter');
  await onSlide(page, 1);
  await expect(next).toBeFocused();
});

test('tapping a key in the header presses it; with reduced motion no reaction rises', async ({
  page,
}) => {
  await page.goto('/login');
  const nim = page.locator('.g-mk-key[data-key="nim"]');
  expect(await pressKey(nim), 'the key pressed down').toBe(true);
  await expect(nim).not.toHaveClass(/\bdown\b/);
  await expect(page.locator('.g-mk-float')).toHaveCount(0);
});

test('signing in: the keys type, the loader says Masuk…, and a second tap does nothing', async ({
  page,
  api,
}) => {
  await fakeGoogle(page.context());
  api.on('POST /api/auth/login/accesstoken', reply.hang());
  await page.goto('/login');
  await googleReady(page);
  await google(page).click();
  const busy = page.getByRole('button', { name: 'Masuk…', exact: true });
  await expect(busy).toHaveAttribute('aria-disabled', 'true');
  await expect(busy.locator('.g-mk-load i')).toHaveCount(3);
  await expect(busy.locator('.g-mk-g')).toHaveCount(0);
  await expect(page.getByRole('main')).toHaveClass(/\bbusy\b/);
  await busy.click({ force: true });
  await busy.click({ force: true });
  await page.waitForTimeout(300);
  expect(api.calls('POST /api/auth/login/accesstoken')).toHaveLength(1);
  expect((await googleRequests(page)).requests).toBe(1);
  await expect(page).toHaveURL(/\/login$/);
});

test('the four error states: icon, words and colour, Coba lagi where the app has it, focus on the next step', async ({
  page,
  api,
}, testInfo) => {
  const alert = page.getByRole('alert');
  const retry = page.getByRole('button', { name: 'Coba lagi' });
  const shows = async (text: string, withRetry: boolean) => {
    await expect(alert.locator('.g-mk-err')).toHaveText(text);
    await expect(alert.locator('.g-mk-err svg')).toHaveCount(1);
    const colour = await alert
      .locator('.g-mk-err')
      .evaluate((p) => getComputedStyle(p).color);
    const token = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--text-danger')
        .trim(),
    );
    const probe = await page.evaluate((c) => {
      const s = document.createElement('span');
      s.style.color = c;
      document.body.append(s);
      const out = getComputedStyle(s).color;
      s.remove();
      return out;
    }, token);
    expect(colour).toBe(probe);
    await expect(retry).toHaveCount(withRetry ? 1 : 0);
    await expect(google(page)).not.toHaveAttribute('aria-disabled');
    await expect(withRetry ? retry : google(page)).toBeFocused();
  };

  // Google's script never loaded (blocked or offline): the failed-connection message, as the app has always said.
  await page.goto('/login');
  await google(page).click();
  await shows(MSG.gagal, true);
  await strictGates(page, testInfo, 'masuk-skrip', null);

  await fakeGoogle(page.context());
  await page.reload();
  await googleReady(page);
  // 401: both causes, nothing to retry.
  api.on('POST /api/auth/login/accesstoken', writes.loginNotAMember);
  await google(page).click();
  await shows(MSG[401], false);
  await strictGates(page, testInfo, 'masuk-401', null);
  // A failed server: Coba lagi.
  api.on('POST /api/auth/login/accesstoken', writes.loginServerError);
  await google(page).click();
  await shows(MSG.gagal, true);
  await strictGates(page, testInfo, 'masuk-gagal', null);
  // Google's popup blocked.
  await googleAnswers(page, 'blocked');
  await google(page).click();
  await shows(MSG.popup, false);
  await strictGates(page, testInfo, 'masuk-popup', null);
});

test.describe('a short phone', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('on a 320 × 568 phone the button stays on screen, with nothing sideways @phone-only', async ({
    page,
  }) => {
    await page.goto('/login');
    const go = await box(google(page));
    expect(go.y + go.height).toBeLessThanOrEqual(568);
    expect(go.x).toBeGreaterThanOrEqual(0);
    expect(go.x + go.width).toBeLessThanOrEqual(320);
    const over = await page.evaluate(() => {
      const root = document.querySelector('.g-mk')!;
      return [
        document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        root.scrollWidth - root.clientWidth,
      ];
    });
    expect(over).toEqual([0, 0]);
    await expect(
      page.getByRole('heading', { name: 'Halo, Pips!' }),
    ).toBeVisible();
  });
});

test('after resizing across 1024 px the slide shown stays the same @desktop-only', async ({
  page,
}) => {
  await page.goto('/login');
  await dot(page, 2).click();
  await onSlide(page, 2);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator('.g-mk-sheet')).toBeVisible();
  await onSlide(page, 2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.g-mk-side')).toBeVisible();
  await onSlide(page, 2);
});

// The header's glyphs and halftone must not come from the build's shared `ui` chunk: it brings the
// push prompt, the dialogs and their libraries before sign-in's first render (/login 144 → 190 KiB gzip).
test('a cold first load of sign-in leaves out the shared ui chunk', async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(new URL(r.url()).pathname);
  });
  await page.goto('/login');
  await expect(page.locator('.g-mk-key.on')).toHaveCount(1);
  await page.waitForLoadState('networkidle');
  expect(scripts.some((s) => /\/assets\/login-/.test(s))).toBe(true);
  expect(scripts.filter((s) => /\/assets\/ui-/.test(s))).toEqual([]);
});
