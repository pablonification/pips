/**
 * The `test` every journey imports. It extends Playwright's with:
 * - `persona`: 'anggota' (Nadia Putri), 'pengurus' (Raka Pratama) or null (signed out). Default 'anggota'.
 * - `signedIn`: whether the persona starts signed in (default true). Signed out, the API answers 401 until a
 *   test sets `db.signedIn = true`.
 * - `installed`: whether the app runs as the installed PWA (default true). Until P0-B the production build
 *   showed a phone browser an install tutorial instead of the app; `installed: false` now checks it doesn't.
 * - `now`: the fixed clock (default: Kamis, 8 Oktober 2026, 13.35 WIB); null leaves the real clock.
 * - `api`: the mock layer (mock.ts). Its guard fails the test after it ends if any request went unanswered.
 */
import { test as base, expect } from '@playwright/test';
import { buildDb, NOW, type Db, type PersonaKey } from '../fixtures/api';
import { ApiMock } from './mock';

export interface HarnessOptions {
  persona: PersonaKey | null;
  signedIn: boolean;
  installed: boolean;
  now: string | null;
}

/** Freezes motion: no CSS animations or transitions, no smooth scrolling, no blinking caret. */
export const NO_MOTION_CSS =
  '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}';

export const test = base.extend<HarnessOptions & { db: Db; api: ApiMock }>({
  persona: ['anggota', { option: true }],
  signedIn: [true, { option: true }],
  installed: [true, { option: true }],
  now: [NOW, { option: true }],

  /** This test's own copy of the persona's fixture data; the default handlers answer from it. */
  db: async ({ persona, signedIn }, use) => {
    const db = buildDb(persona);
    db.signedIn = signedIn && !!db.me;
    await use(db);
  },

  context: async ({ context, db, installed, now }, use) => {
    if (now) await context.clock.install({ time: new Date(now) });
    await context.addInitScript(
      ({ css, installed, user, academic }) => {
        if (installed)
          Object.defineProperty(navigator, 'standalone', { get: () => true });
        // Seed the signed-in session once per context, as the app leaves it after a sign-in.
        if (user && !localStorage.getItem('e2e:seeded')) {
          localStorage.setItem('e2e:seeded', '1');
          localStorage.setItem('user', JSON.stringify(user));
          localStorage.setItem('userAcademic', JSON.stringify(academic));
        }
        const addStyle = () => {
          const style = document.createElement('style');
          style.dataset.e2e = 'no-motion';
          style.textContent = css;
          document.head.appendChild(style);
        };
        if (document.head) addStyle();
        else
          document.addEventListener('DOMContentLoaded', addStyle, {
            once: true,
          });
      },
      {
        css: NO_MOTION_CSS,
        installed,
        user: db.signedIn ? db.me : null,
        academic: db.academic,
      },
    );
    await use(context);
  },

  api: [
    async ({ context, db, baseURL }, use, testInfo) => {
      const api = new ApiMock(db, baseURL!);
      await api.install(context);
      await use(api);
      api.close();
      const counts = api.requests.reduce<Record<string, number>>(
        (n, r) => ((n[r.outcome] = (n[r.outcome] ?? 0) + 1), n),
        {},
      );
      await testInfo.attach('api-requests.json', {
        body: JSON.stringify({ counts, requests: api.requests }, null, 2),
        contentType: 'application/json',
      });
      expect(
        api.problems,
        `The mock guard caught requests with no handler:\n${api.problems.join('\n')}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
