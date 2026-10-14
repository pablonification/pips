/**
 * F2 (brief steps 9, 10 and 12): sign-in's redirect check against every unsafe target, the installed app's
 * manifest, and the theme colour.
 */
import type { Page } from '@playwright/test';
import { greeting, layoutOf } from '../support/app';
import { fakeGoogle, googleRequests } from '../support/google';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';
import { QA_LAYOUT } from './probe';

/** Brief step 9: each must end on Beranda, after sign-in and when a signed-in member opens it. */
const UNSAFE = [
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  'javascript:alert(1)',
  '/.//evil.com',
  '/%2e%2e//evil.com',
  '/\t/evil.example',
];

const onBeranda = async (page: Page) => {
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  await expect(greeting(page)).toBeVisible();
};

test.describe('redirect validation', () => {
  // Playwright reads the fixtures from an object pattern, so it stays, empty.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !/^qa-(phone|desktop)-light$/.test(testInfo.project.name),
      'phone and desktop, light',
    );
  });

  for (const target of UNSAFE) {
    test(`signed in, /login?redirect=${JSON.stringify(target)} opens Beranda`, async ({
      page,
      api,
    }) => {
      await page.goto(`/login?redirect=${encodeURIComponent(target)}`);
      await onBeranda(page);
      expect(api.blocked.filter((b) => /evil/.test(b.path))).toEqual([]);
    });

    test.describe('signed out', () => {
      test.use({ signedIn: false });
      test(`sign-in with redirect=${JSON.stringify(target)} ends on Beranda`, async ({
        page,
        api,
      }) => {
        await fakeGoogle(page.context());
        await page.goto(`/login?redirect=${encodeURIComponent(target)}`);
        api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
        await expect
          .poll(async () => (await googleRequests(page)).clients.length)
          .toBe(1);
        await page.getByRole('button', { name: 'Masuk dengan Google' }).click();
        // A first sign-in with no courses set goes to first run (P1-C), else Beranda: never the other site.
        await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/(mulai)?$/);
        await expect(page.locator('h1:visible')).toHaveCount(1);
        expect(api.blocked.filter((b) => /evil/.test(b.path))).toEqual([]);
      });
    });
  }
});

test.describe('the installed app', () => {
  // Playwright reads the fixtures from an object pattern, so it stays, empty.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'qa-phone-light', 'once');
  });

  test('the manifest: start, scope and shortcuts on today’s URLs, Indonesian, the theme’s colours', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = (await (await request.get(href!)).json()) as {
      start_url: string;
      scope: string;
      lang?: string;
      theme_color: string;
      background_color: string;
      shortcuts: { name: string; url: string }[];
      screenshots?: {
        src: string;
        label?: string;
        type: string;
        sizes: string;
      }[];
    };
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.lang, 'SPEC: the app is Indonesian').toBe('id');
    expect(manifest.theme_color).toBe('#FCFBF8');
    expect(manifest.background_color).toBe('#1B1508');
    for (const s of manifest.shortcuts) {
      await page.goto(s.url);
      await expect(page).toHaveURL(new RegExp(`${s.url}$`));
      await expect(page.locator('h1:visible')).toHaveCount(1);
    }
    // An install screenshot shows the app as it is now (F2-008: it was today's green English sign-in, "Login page"):
    // labelled in Indonesian, a real JPEG or PNG of the size it says.
    for (const shot of manifest.screenshots ?? []) {
      expect(shot.label ?? '', `screenshot ${shot.src}`).not.toMatch(
        /\b(login|page)\b/i,
      );
      expect(shot.type).toMatch(/^image\/(jpeg|png)$/);
      await page.goto(shot.src);
      const size = await page.evaluate(() => {
        const img = document.querySelector('img');
        return img ? `${img.naturalWidth}x${img.naturalHeight}` : null;
      });
      expect(size).toBe(shot.sizes);
    }
  });
});

test.describe('the theme colour', () => {
  test('follows the theme; gold on Beranda on phones and tablets', async ({
    page,
  }, testInfo) => {
    test.skip(!QA_LAYOUT.test(testInfo.project.name), 'a qa layout');
    const dark = testInfo.project.name.endsWith('-dark');
    const themeColour = () =>
      page.locator('meta[name="theme-color"]').getAttribute('content');
    await page.goto('/pengumuman');
    await expect(page.locator('h1:visible')).toHaveCount(1);
    await expect.poll(themeColour).toBe(dark ? '#0A0907' : '#FCFBF8');
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    if (layoutOf(testInfo) === 'desktop')
      await expect.poll(themeColour).toBe(dark ? '#0A0907' : '#FCFBF8');
    else await expect.poll(themeColour).not.toBe(dark ? '#0A0907' : '#FCFBF8');
  });

  test('no flash of the other theme: the first frame already has the chosen theme', async ({
    page,
  }, testInfo) => {
    test.skip(!QA_LAYOUT.test(testInfo.project.name), 'a qa layout');
    const dark = testInfo.project.name.endsWith('-dark');
    // The member chose the opposite of the system's setting: the first frame must follow the choice. Before the
    // stylesheet the browser paints its own canvas by `color-scheme`, so that and the theme class are what count.
    // The state is read the moment <body> is created, before anything of the page can be drawn. Not in a
    // requestAnimationFrame: the harness's fake clock (context.clock) drives those, and about 1 in 40 loads it never
    // ran one, so the check read nothing (CI on #23, then 3 of 120 local runs).
    await page.addInitScript(
      (choice) => {
        localStorage.setItem('pips:theme', choice);
        const w = window as unknown as { __firstFrame?: string };
        new MutationObserver((_, observer) => {
          if (!document.body) return;
          const root = document.documentElement;
          w.__firstFrame = `${root.classList.contains('dark')}|${root.style.colorScheme}`;
          observer.disconnect();
        }).observe(document, { childList: true, subtree: true });
      },
      dark ? 'light' : 'dark',
    );
    await page.goto('/pengumuman');
    await expect(page.locator('h1:visible')).toHaveCount(1);
    const first = await page.evaluate(
      () => (window as unknown as { __firstFrame?: string }).__firstFrame,
    );
    expect(first).toBe(dark ? 'false|light' : 'true|dark');
  });
});
