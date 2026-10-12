# PIPS! browser harness

Playwright drives a **production build** of the web app, served locally with `vite preview`. Every request the
app makes is answered from typed fixtures built from the locked Garis v4 prototype's sample data, with a fixed
clock. Nothing reaches a real API, Google, Sentry or any other site.

The Mac this runs on is shared and short of disk: run `ops/redesign/disk-guard.sh` (in the workspace) before each
command below, run one at a time, and use at most 3 workers (`E2E_WORKERS=3`).

## Commands

All from the repository root (or `pnpm run <script>` inside `apps/web`):

| Command                                | What it does                                                                                                                                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter web e2e`                | The journeys (`e2e/journeys/`) at phone and desktop size, light and dark, plus the visual references (`e2e/visual/`, empty until the redesign).                                                                                                                |
| `pnpm --filter web e2e:before`         | Records the **before set** of today's interface to `ops/redesign/before-set/`: captures, `manifest.json` (with per-screen axe counts), `index.html` gallery. Refuses to overwrite an existing set.                                                             |
| `pnpm --filter web e2e:compare-before` | Re-captures the same states and compares them with the before set. Writes `ops/redesign/compare/<timestamp>/` (report, side-by-side images, `index.html`). Exits 1 if any state changed.                                                                       |
| `pnpm --filter web fidelity`           | Captures the screens mapped in `e2e/fidelity/screens.ts` at the locked prototype screens' sizes and pairs them with the 216 locked route screens and the 35 non-route ones in `e2e/fidelity/extras.ts`. Writes `ops/redesign/fidelity/<timestamp>/index.html`. |
| `pnpm --filter web e2e:update`         | Records or updates the visual reference images (`toHaveScreenshot`).                                                                                                                                                                                           |
| `pnpm --filter web test`               | The Node unit tests in `tests/` (including the harness's own image and naming logic).                                                                                                                                                                          |

Arguments after the script name go to Playwright, e.g. `pnpm --filter web e2e --grep Curhat` or
`pnpm --filter web e2e:before --grep form-step`.

**Environment variables**

| Variable                 | Effect                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_REUSE_BUILD=1`      | Reuse the last build in `e2e/.build` instead of building again (builds take minutes here). Rebuild after changing app code.       |
| `E2E_WORKERS`            | Parallel browsers (default 2).                                                                                                    |
| `E2E_PORT`               | The preview port (default 4310, inside this worktree's range 4310–4319).                                                          |
| `E2E_GATES=strict`       | Make the quality gates fail tests (see below).                                                                                    |
| `E2E_COMPARE_THRESHOLD`  | Changed-pixel ratio above which a state counts as changed (default `0.0001`).                                                     |
| `E2E_BEFORE_OVERWRITE=1` | Let `e2e:before` replace an existing before set. Only for a set recorded wrongly.                                                 |
| `PIPS_OPS_DIR`           | Where `ops/` is. By default the scripts look for `ops/redesign/PLAN.md` above the app; without it (CI) records go to `e2e/.out/`. |

Outside the workspace (CI), `E2E_REUSE_BUILD` is unset and the web server builds first. Playwright's own output
goes to `e2e/.results/` and its HTML report to `e2e/.report/`.

## What every test gets

`support/test.ts` extends Playwright's `test`. Import `test` and `expect` from there:

- **Projects** (`playwright.config.ts`): `phone-light`, `phone-dark` (390 × 844, touch, device scale 2, a phone
  user agent) and `desktop-light`, `desktop-dark` (1440 × 900). Tag a test `@phone-only` or `@desktop-only`
  when only one layout has the feature; the other projects leave it out.
- **Defaults:** time zone `Asia/Jakarta`, locale `id-ID`, service workers blocked, reduced motion, CSS
  animations and transitions off, and a fixed clock: **Kamis, 8 Oktober 2026, 13.35 WIB** (the prototype's
  "now"; see `fixtures/NOTES.md`). Time then runs normally from there.
- **Options** (set with `test.use({...})`):
  - `persona`: `'anggota'` (Nadia Putri, IF 2025 PIXEL; default) or `'pengurus'` (Raka Pratama, IF 2024, with
    `akademik` and `admin`), or `null` for nobody.
  - `signedIn` (default `true`): signed out, the API answers 401 until the test sets `db.signedIn = true`.
  - `installed` (default `true`): runs as the installed PWA. Until P0-B removed it, the production build showed
    phone browsers an install tutorial instead of the app; `installed: false` checks it is gone.
  - `now`: another fixed time (ISO string), or `null` for the real clock.
- **Fixtures:** `db` is this test's own copy of the persona's data (`fixtures/api.ts`); `api` is the mock layer.

## Fixtures

- `fixtures/prototype.ts`: the prototype's `garis/data.js`, ported as is.
- `fixtures/api.ts`: the same data in the real API's shapes, typed with `src/api/generated`, so `pnpm typecheck`
  fails if the API changes shape. `buildDb(persona)` gives one persona's view (visibility, read state, courses,
  rooms, forms).
- `fixtures/NOTES.md`: every place where the prototype's data doesn't fit the API, and what the fixtures do.
- Images: avatars, posters and post photos are drawn by the mock layer at `/__e2e__/…` (`support/media.ts`).

## The mock layer and its guard

`support/mock.ts` answers every request:

- `/api/**`: the test's own handlers first, then the read-only defaults in `support/handlers.ts` (every GET the
  app makes, computed from `db`, each response type-checked against the generated client).
- A request with no handler is aborted and **fails the test**, listing its method and path.
- A **write** (POST, PUT, PATCH, DELETE) is answered only by a handler the test registered itself; otherwise it
  is aborted and fails the test. There are no default writes.
- `/socket.io/`: a fake socket.io server (`support/socketio.ts`, Engine.IO v4 long-polling, no WebSocket).
- Other origins (Google sign-in and fonts, Sentry, analytics, external links) are blocked and listed in
  `api.blocked`; that alone doesn't fail a test.
- Each test attaches `api-requests.json` (every request and how it was answered) to its result.

### Overriding answers

```ts
import { reply } from '../support/mock';
import * as writes from '../support/writes';

test('…', async ({ page, api, db }) => {
  api.on('GET /api/info', reply.status(503)); // an error
  api.on('GET /api/info', { infos: [] }); // an empty list (plain data = 200 JSON)
  api.on('GET /api/info', reply.delay(2000, { infos: db.infos })); // slow
  api.on('GET /api/info', reply.hang()); // loading forever
  api.on('GET /api/me', reply.abort('failed')); // a dropped request
  api.on('PUT /api/reaction', writes.react); // allow a write, acting on db
  api.on('POST /api/info/:infoId/read', ({ params }) => ({
    ok: params.infoId,
  }));
  await api.setOffline(true); // navigator.onLine false, every request fails
  // …
  expect(api.calls('PUT /api/reaction')[0].body).toEqual({
    reaction: 'party',
    infoId: 'p2',
  });
});
```

`support/writes.ts` has handlers that behave like the API on `db`: `markRead`, `react`, `comment`, `submitForm`.

### Sockets

The app opens one socket.io connection per Curhat room (`auth.chatroomId`) and one for Live Counting
(`auth.formAdminId`). The fake accepts them, records what the app emits, and lets a test push events:

```ts
expect(api.socket.emitted('message').map((e) => e.data)).toEqual([...]);
api.socket.emit('reply', message, (s) => s.auth.chatroomId === 'r1');
api.socket.drop();     // the connection drops; reconnects fail until api.socket.restore()
```

## Adding a journey

1. Add `e2e/journeys/<area>.spec.ts`, importing `test` and `expect` from `../support/test`.
2. Find elements by role and accessible name (`getByRole`), never by class or DOM shape. Today's app renders its
   phone and desktop layouts together and hides one; `support/app.ts` has helpers for the visible copy.
3. Register a handler for every write the journey makes.
4. Assert the visible outcome, and what the API received when it matters (`api.calls`).
5. Call `checkGates(page, testInfo, '<name>')` on each screen the journey reaches.

## Quality gates

`support/audit.ts` measures axe (WCAG 2.2 A/AA and best practice), document horizontal overflow, text under 12 px
and `lang`. Today's app fails many of them, so the gates **record** by default: the results are attached to each
test as `gates-<name>.json` and written into the before set. With `E2E_GATES=strict` they fail a test on any
serious or critical axe violation, any overflow, any text under 12 px or `lang` other than `id`. The redesign
makes strict the default.

## The before set and comparisons

- States live in `capture/states.ts`: each destination's main view, the empty, loading, error and offline states
  today's app has, open overlays, the form steps and the admin tables. Each is captured at phone and desktop size
  in light and dark (today's app has no dark theme; the dark captures show that).
- A capture is taken once fonts and images have loaded, every image has been painted again after decoding, and two
  screenshots in a row are identical. The repaint matters: Chromium sometimes keeps an image raster drawn before its
  decode finished, and an SVG at a fractional position then lands half a pixel apart between runs.
- A state's steps must wait for what they wait on to happen. To capture a page after a toast has gone, wait for the
  toast to appear and then to leave: waiting only for "hidden" passes at once while the request is still running.
- `e2e:compare-before` compares each pair with pixelmatch (colour tolerance 0.1, anti-aliasing ignored).
  **Threshold:** a state counts as changed when more than **0.01 %** of its pixels differ (about 130 pixels on
  either size), or when it is missing. An unchanged build is pixel-identical: on 2026-10-12 all 200 captures had
  0 changed pixels, reusing the build and after a clean rebuild. A toast or a changed word is several hundred
  pixels (the flaky toast above was 643, which the earlier 0.1 % would have let through); the margin only absorbs
  a few anti-aliased pixels. Never raise it to get green: find what moves and fix it in the harness. New states
  (in `states.ts` but not in the before set) are listed, not failed.
- The before set is a record and is never updated. It was recorded on the owner's Mac on 2026-10-12; rendering
  differs between machines, so compare on the same machine (or record a new set there with `E2E_BEFORE_OVERWRITE=1`).

## Fidelity against the locked prototype

- `fidelity/names.mjs` lists the locked screens as `ops/ui-revamp-review/tools/garis-check.mjs` names them:
  `<layout>-<persona>-<route>-<theme>` for 25 anggota and 11 pengurus routes, phone (390 × 800 @2x), tablet
  (834 × 1068) and desktop (1440 × 956), light and dark: 216 screens.
- `fidelity/screens.ts` maps `<persona>-<route>` to the app: URL, mock overrides, steps to reach the state, and
  what is visible when ready. **When you build a screen, add or update its entry**, e.g.:

  ```ts
  'anggota-ov-filter': {
    path: '/pengumuman',
    act: async (page) => page.getByRole('button', { name: 'Filter' }).click(),
    ready: (page) => page.getByRole('dialog', { name: 'Filter' }),
  },
  ```

  Use `layouts: ['phone']` when the entry only applies to some layouts.

- **Screens that aren't routes** (the `i-*` interactions, the `page-*` sizes, `narrow320-beranda`,
  `desk1024-beranda`, and the design-system page's `system-kit` and `system-cards`): `names.mjs` lists the 35 an app
  task owns in `EXTRA_SCREENS`, each with its project (`fidelity-<layout>-<theme>`), the viewport it was taken at and
  what it shows (`app` area, whole `page` including the prototype's 44 px bar, or one `element`). Map one in
  `fidelity/extras.ts` with the same fields as `screens.ts`, plus `persona` (null for signed out) and, for an element
  capture, `target`. The 11 `PROTOTYPE_ONLY` screens (the prototype's own bar, forced layouts and notes page) are
  never mapped.

- The report pairs each screen with its locked image: a perceptual similarity (SSIM on luminance; "close" at
  ≥ 0.95), the changed-pixel ratio, and a side-by-side image (prototype | app | difference). Unmapped screens
  show as "not built yet". Filter by layout, theme, persona and status.
- Today's entries point at today's screens at their new URLs (`/`, `/pengumuman`, …; P0-B), so they show as "different".

## Visual references

`e2e/visual/visual.spec.ts` compares states with committed reference images (`toHaveScreenshot`, at most 0.1 %
of pixels may differ). `VISUAL_STATES` is empty until the redesign adds finished screens; then record the
references with `e2e:update`, preferably from the CI container so fonts render the same, and review their diffs
in the pull request.

## CI

The `e2e` job in `.github/workflows/check.yml` installs Chromium and runs `pnpm --filter web e2e` on pull requests
to `main` and `redesign`, and keeps the report as an artifact.
