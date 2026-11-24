/**
 * Writes public/og-image.png, the picture a link to PIPS! shows in WhatsApp, LINE, Discord, X and search results
 * (index.html's og:image): 1200 × 630, the size every one of them crops least.
 *
 * It is a capture of the real sign-in page, not a drawing: Masuk's gold keyboard header (its keys, pixel reactions
 * and halftone) and its brand (the official HMIF logo, whole, with the wordmark and HMIF ITB), in the light theme.
 * When Masuk changes, running this again keeps the picture true to the app; tests/seo.test.mjs checks its size and
 * shape.
 *
 * Run from apps/web after a production build of the harness (`E2E_BUILD_ONLY=1 node e2e/scripts/serve.mjs`):
 *   node scripts/og/build-og-image.mjs
 * It serves that build on OG_PORT (default 4570) with `vite preview`, answers the API with 401 (signed out) and
 * lets nothing reach another site.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.OG_PORT || 4570);
const OUT = fileURLToPath(
  new URL('../../public/og-image.png', import.meta.url),
);
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/**
 * What the picture leaves out of Masuk (the greeting, the slides and their arrows, the sign-in button), and the brand
 * (the official logo, scaled whole, with the wordmark and HMIF ITB) made large enough to read in a chat's small
 * preview.
 */
const PICTURE_CSS = `
  .g-mk-intro, .g-mk-car, .g-mk-act, .g-mk-alert { display: none !important; }
  .g-mk.desk .g-mk-hero { grid-template-rows: minmax(0, 1fr) !important; }
  .g-mk.desk .g-mk-side { padding: 32px !important; }
  .g-mk.desk .g-mk-form { width: auto !important; }
  .g-mk-brand { zoom: 2.6; }
`;

async function waitForServer(url, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Nothing answered at ${url}. Build the harness first.`);
}

const server = spawn('node', ['e2e/scripts/serve.mjs'], {
  env: { ...process.env, E2E_PORT: String(PORT), E2E_REUSE_BUILD: '1' },
  stdio: 'inherit',
});
const origin = `http://127.0.0.1:${PORT}`;
try {
  await waitForServer(`${origin}/`);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: OG_WIDTH, height: OG_HEIGHT },
    deviceScaleFactor: 1,
    // Still: the keys lit as the first slide lights them, and no reaction mid-flight.
    reducedMotion: 'reduce',
    colorScheme: 'light',
  });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    return route.continue();
  });
  await page.goto(`${origin}/login`);
  for (const selector of ['.g-mk.desk', '.g-mk-board', '.g-mk-brand img'])
    await page.locator(selector).first().waitFor();
  await page.addStyleTag({ content: PICTURE_CSS });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
  await page.screenshot({ path: OUT, type: 'png' });
  await browser.close();
  console.log(
    `public/og-image.png  ${OG_WIDTH}x${OG_HEIGHT}  ${Math.round(statSync(OUT).size / 1024)} KiB`,
  );
} finally {
  server.kill('SIGTERM');
}
