/**
 * The `test` every journey imports. It extends Playwright's with:
 * - `persona`: 'anggota' (Nadia Putri), 'pengurus' (Raka Pratama) or null (signed out). Default 'anggota'.
 * - `signedIn`: whether the persona starts signed in (default true). Signed out, the API answers 401 until a
 *   test sets `db.signedIn = true`.
 * - `installed`: whether the app runs as the installed PWA (`display-mode: standalone`, default true). The app reads
 *   it (lib/platform.ts) for Pasang PIPS! and the iOS push step; `installed: false` runs as a phone browser, which
 *   also checks the install tutorial P0-B removed stays gone.
 * - `now`: the fixed clock (default: Kamis, 8 Oktober 2026, 13.35 WIB); null leaves the real clock.
 * - `platform`: what `navigator.platform` reports ('MacIntel', 'Linux x86_64'); null leaves the browser's own. The
 *   app names the search shortcut by platform (⌘K on Apple, Ctrl K elsewhere), so fidelity captures run as Linux,
 *   where the locked screens were rendered.
 * - `push` (P1-C): this device's notifications, `'off'` (permission default, not subscribed), `'on'` (granted and
 *   subscribed) or `'blocked'` (denied); null (default) follows the persona as the prototype does: off for Nadia, on
 *   for Raka. See push.ts for the stub and its helpers (`answerPermission`, `pushDevice`).
 * - `roles` (P3-A): the persona's roles for this test. A list adds roles (`roles: ['peoplemanage']`); `{ only: [...] }`
 *   replaces them (`roles: { only: ['peoplemanage'] }` is a peoplemanage-only member). Applied in the `db` fixture
 *   before the context seeds the session, so `GET /api/me` and the cached user agree. null (default) keeps them.
 * - `motion` (F1): `'off'` (default) adds the no-motion stylesheet below; `'on'` leaves the app's own transitions, for
 *   the review recordings (pair it with `reducedMotion: 'no-preference'`).
 * - `api`: the mock layer (mock.ts). Its guard fails the test after it ends if any request went unanswered.
 */
import { test as base, expect } from '@playwright/test';
import {
  buildDb,
  NOW,
  type Db,
  type PersonaKey,
  type RolesOption,
} from '../fixtures/api';
import { ApiMock } from './mock';
import { installPushStub, type PushMode } from './push';

export interface HarnessOptions {
  persona: PersonaKey | null;
  signedIn: boolean;
  installed: boolean;
  now: string | null;
  platform: string | null;
  push: PushMode | null;
  roles: RolesOption | null;
  motion: 'off' | 'on';
}

/** Freezes motion: no CSS animations or transitions, no smooth scrolling, no blinking caret. */
export const NO_MOTION_CSS =
  '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}';

export const test = base.extend<HarnessOptions & { db: Db; api: ApiMock }>({
  persona: ['anggota', { option: true }],
  signedIn: [true, { option: true }],
  installed: [true, { option: true }],
  now: [NOW, { option: true }],
  platform: [null, { option: true }],
  push: [null, { option: true }],
  roles: [null, { option: true }],
  motion: ['off', { option: true }],

  /** This test's own copy of the persona's fixture data; the default handlers answer from it. */
  db: async ({ persona, signedIn, roles }, use) => {
    const db = buildDb(persona, roles);
    db.signedIn = signedIn && !!db.me;
    await use(db);
  },

  context: async (
    { context, db, installed, now, platform, push, persona, motion },
    use,
  ) => {
    if (now) await context.clock.install({ time: new Date(now) });
    await installPushStub(
      context,
      push ?? (persona === 'pengurus' ? 'on' : 'off'),
    );
    if (platform)
      await context.addInitScript((p) => {
        Object.defineProperty(Navigator.prototype, 'platform', {
          get: () => p,
          configurable: true,
        });
      }, platform);
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
        if (!css) return;
        if (document.head) addStyle();
        else
          document.addEventListener('DOMContentLoaded', addStyle, {
            once: true,
          });
      },
      {
        css: motion === 'on' ? '' : NO_MOTION_CSS,
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
