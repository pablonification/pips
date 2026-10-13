/**
 * A fake Google Identity Services script (P1-C), so journeys click the real Masuk dengan Google. It answers
 * `https://accounts.google.com/gsi/client` ahead of the mock layer, which blocks every other origin; without it the
 * script never loads, as when Google is unreachable.
 *
 * `initTokenClient(config).requestAccessToken()` calls back as Google's popup would:
 * - `'token'` (default): `config.callback({ access_token: E2E_GOOGLE_TOKEN, … })`;
 * - `'closed'`: the member closed the popup (`error_callback({ type: 'popup_closed' })`);
 * - `'blocked'`: the browser blocked the popup (`error_callback({ type: 'popup_failed_to_open' })`).
 * Switch with `googleAnswers(page, mode)`; read what the page asked for with `googleRequests(page)`.
 */
import type { BrowserContext, Page } from '@playwright/test';

export const E2E_GOOGLE_TOKEN = 'e2e-google-access-token';
export type GoogleMode = 'token' | 'closed' | 'blocked';

const SCRIPT = `(() => {
  const state = (window.__e2eGoogle = window.__e2eGoogle || { mode: 'token', requests: 0, clients: [] });
  window.google = window.google || {};
  window.google.accounts = {
    oauth2: {
      initTokenClient(config) {
        state.clients.push({ client_id: config.client_id, scope: config.scope });
        return {
          requestAccessToken() {
            state.requests += 1;
            setTimeout(() => {
              if (state.mode === 'closed') config.error_callback && config.error_callback({ type: 'popup_closed' });
              else if (state.mode === 'blocked') config.error_callback && config.error_callback({ type: 'popup_failed_to_open' });
              else config.callback({ access_token: ${JSON.stringify(E2E_GOOGLE_TOKEN)}, token_type: 'Bearer', expires_in: 3599, scope: config.scope });
            }, 50);
          },
        };
      },
    },
    id: { initialize() {}, prompt() {}, renderButton() {}, disableAutoSelect() {}, cancel() {} },
  };
})();`;

/** Serve the fake script to this context (call after the mock layer is installed: the later route wins). */
export async function fakeGoogle(context: BrowserContext) {
  await context.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: SCRIPT,
    }),
  );
}

export async function googleAnswers(page: Page, mode: GoogleMode) {
  await page.evaluate((m) => {
    const w = window as unknown as {
      __e2eGoogle?: { mode: string; requests: number; clients: unknown[] };
    };
    w.__e2eGoogle ??= { mode: 'token', requests: 0, clients: [] };
    w.__e2eGoogle.mode = m;
  }, mode);
}

/** How many times the page opened Google's popup, and the clients it made. */
export async function googleRequests(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __e2eGoogle?: { requests: number; clients: unknown[] };
    };
    return {
      requests: w.__e2eGoogle?.requests ?? 0,
      clients: w.__e2eGoogle?.clients ?? [],
    };
  });
}
