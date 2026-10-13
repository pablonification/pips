# PIPS! browser harness

Playwright drives a **production build** of the web app, served locally with `vite preview`. Every request the
app makes is answered from typed fixtures built from the locked Garis v4 prototype's sample data, with a fixed
clock. Nothing reaches a real API, Google, Sentry or any other site.

The Mac this runs on is shared and short of disk: run `ops/redesign/disk-guard.sh` (in the workspace) before each
command below, run one at a time, and use at most 2 workers (`E2E_WORKERS=2`, the default; WORKER-RULES.md).

## Commands

All from the repository root (or `pnpm run <script>` inside `apps/web`):

| Command                                | What it does                                                                                                                                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter web e2e`                | The journeys (`e2e/journeys/`) at phone, tablet and desktop size, light and dark, plus the visual references (`e2e/visual/`).                                                                                                                                  |
| `pnpm --filter web e2e:before`         | Recorded the **before set** of the app before the redesign to `ops/redesign/before-set/`: captures, `manifest.json` (with per-screen axe counts), `index.html` gallery. Refuses to overwrite an existing set.                                                  |
| `pnpm --filter web e2e:compare-before` | Re-captures the same states in the redesigned app and compares them with the before set. Writes `ops/redesign/compare/<timestamp>/` (report, side-by-side images, `index.html`). Exits 1 if any state changed or is missing; removed states are listed.        |
| `pnpm --filter web fidelity`           | Captures the screens mapped in `e2e/fidelity/screens.ts` at the locked prototype screens' sizes and pairs them with the 216 locked route screens and the 35 non-route ones in `e2e/fidelity/extras.ts`. Writes `ops/redesign/fidelity/<timestamp>/index.html`. |
| `pnpm --filter web fidelity:compare`   | Compares two fidelity runs (`<baseline> <final>` folders) screen by screen, pixel by pixel at compare-before's threshold. Writes `ops/redesign/compare/runs-<timestamp>/`. Exits 1 if any screen changed or went missing.                                        |
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
| `E2E_GATES=record`       | Only record the quality gates instead of failing on them (the capture scripts set it; see below).                                 |
| `E2E_COMPARE_THRESHOLD`  | Changed-pixel ratio above which a state counts as changed (default `0.0001`).                                                     |
| `E2E_BEFORE_OVERWRITE=1` | Let `e2e:before` replace an existing before set. Only for a set recorded wrongly.                                                 |
| `PIPS_OPS_DIR`           | Where `ops/` is. By default the scripts look for `ops/redesign/PLAN.md` above the app; without it (CI) records go to `e2e/.out/`. |

Outside the workspace (CI), `E2E_REUSE_BUILD` is unset and the web server builds first. Playwright's own output
goes to `e2e/.results/` and its HTML report to `e2e/.report/`.

## What every test gets

`support/test.ts` extends Playwright's `test`. Import `test` and `expect` from there:

- **Projects** (`playwright.config.ts`): `phone-light`, `phone-dark` (390 × 844, touch, device scale 2, a phone
  user agent), `tablet-light`, `tablet-dark` (834 × 1112, touch, device scale 2, a tablet user agent; P0-C) and
  `desktop-light`, `desktop-dark` (1440 × 900). Tag a test `@phone-only` or `@desktop-only` when only one layout
  has the feature; the other projects leave it out. Tablets are touch layouts below 1024 px, so they run
  `@phone-only` tests too. `support/app.ts` has `layoutOf(testInfo)` ('phone',
  'tablet' or 'desktop', the shell's three layouts) and `isPhone(testInfo)` (phone or tablet).
- **The shell** (P0-C): `navLink(page, 'Beranda' | 'Pengumuman' | 'Kalender' | 'Layanan' | 'Profil')` finds a
  destination in whichever navigation the layout shows (Profil: your avatar, or your name in the sidebar);
  `greeting(page, 'Nadia')` is Beranda's "Halo, Nadia"; `inMain(page, text)` finds text in the page, not the
  shell. On phones and tablets a drill-down page's title is also the top bar's `h1` (unless the screen shows its own
  `PageTitle`; then the top bar's title is hidden from screen readers), so look for a screen's own headings inside
  `page.getByRole('main')`.
- **The shell's test page** `/dev/shell` (`src/dev/shell/`, development, staging and the harness's build only): a
  page below Layanan with its own title, top-bar actions, a field and 30 buttons; `?judul=…` gives it a title from
  data. `journeys/shell-page.spec.ts` checks the shell's slots on it until real screens use them.
- **Defaults:** time zone `Asia/Jakarta`, locale `id-ID`, service workers blocked, reduced motion, CSS
  animations and transitions off, and a fixed clock: **Kamis, 8 Oktober 2026, 13.35 WIB** (the prototype's
  "now"; see `fixtures/NOTES.md`). Time then runs normally from there.
- **Options** (set with `test.use({...})`):
  - `persona`: `'anggota'` (Nadia Putri, IF 2025 PIXEL; default) or `'pengurus'` (Raka Pratama, IF 2024, with
    `akademik` and `admin`), or `null` for nobody.
  - `signedIn` (default `true`): signed out, the API answers 401 until the test sets `db.signedIn = true`.
  - `installed` (default `true`): runs as the installed PWA (`display-mode: standalone`), which the app reads for
    Pasang PIPS! and the iOS push step. `installed: false` runs as a phone browser (and checks the install tutorial
    P0-B removed stays gone).
  - `now`: another fixed time (ISO string), or `null` for the real clock.
  - `platform`: what `navigator.platform` reports (`'MacIntel'`, `'Linux x86_64'`), or `null` (default) for the
    browser's own. The app names the search shortcut by platform (⌘K on Apple, Ctrl K elsewhere); the fidelity
    captures run as `'Linux x86_64'`, where the locked screens were rendered.
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

Members' Curhat opens one socket.io connection for the whole area (`auth: { curhat: true }`, P2-C); so does
Welfare's inbox at /kelola/curhat (P3-C), whose handshake joins every room and the `curhat:welfare` group room.
Live Counting opens one with `auth.formAdminId`. The fake speaks P0-D's protocol: the handshake joins your rooms
(`FakeSocket.rooms`), `curhat:join` adds one, and `message` is acknowledged as the API does. It records what the app emits, and lets a test push events and steer answers:

```ts
expect(api.socket.emitted('message').map((e) => e.data)).toEqual([...]);
api.socket.emit('reply', message, (s) => s.rooms.has('r1'));
api.socket.answer('message', () => undefined); // hold acknowledgements back (a lost or late one)
api.socket.ack(api.socket.emitted('message')[0], { ok: true, message }); // answer a held one by hand
api.socket.answerAsApi('message'); // answer as the API again
api.socket.drop();     // the connection drops; reconnects fail until api.socket.restore()
```

The app waits 10 s for an acknowledgement; move the clock with `page.clock.fastForward()` instead of waiting.

## Adding a journey

1. Add `e2e/journeys/<area>.spec.ts`, importing `test` and `expect` from `../support/test`.
2. Find elements by role and accessible name (`getByRole`), never by class or DOM shape. Each screen is one tree
   for every layout; when the same text is in two places (a post's title in the feed and beside it), scope the
   locator to its landmark or list (`support/pengumuman.ts` `inFeed`).
3. Register a handler for every write the journey makes.
4. Assert the visible outcome, and what the API received when it matters (`api.calls`).
5. Call `checkGates(page, testInfo, '<name>')` on each screen the journey reaches.

## Quality gates

`support/audit.ts` measures axe (WCAG 2.2 A/AA and best practice), document horizontal overflow, text under 12 px
and `lang`. The gates are **strict** by default (since C1): a journey fails on any serious or critical axe
violation, any overflow, any text under 12 px or `lang` other than `id`; the results are attached to each test as
`gates-<name>.json`. `E2E_GATES=record` only attaches them; `e2e:before` and `e2e:compare-before` use it, since the
before set records the app as it was. `support/strict.ts` adds the redesign's stricter checks (focus, inputs on
touch, the lit navigation item, every window width).

## The before set and comparisons

- States live in `capture/states.ts`: each destination's main view, the empty, loading, error and offline states
  the app had before the redesign, open overlays, the form steps and the admin tables, each reached in the
  redesigned app by its path and steps. Each is captured at phone and desktop size in light and dark (the app
  before the redesign had no dark theme; the dark before captures show that). A state the new app no longer has
  carries a `removed` reason (the install tutorial): it is still captured at its path, and compare-before lists it
  as removed.
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
  (in `states.ts` but not in the before set) are listed, not failed. Against the redesigned app every state is
  expected to differ; F1 reports the before and after.
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
  what it shows (`app` area, whole `page` including the prototype's 44 px bar, or one `element`). A `page` capture
  has `protoBar: 44`: the app (which has no such bar) is captured in the window below it, and the report crops the
  bar off the locked image before comparing (P0-C). Map one in
  `fidelity/extras.ts` with the same fields as `screens.ts`, plus `persona` (null for signed out) and, for an element
  capture, `target`. The 11 `PROTOTYPE_ONLY` screens (the prototype's own bar, forced layouts and notes page) are
  never mapped.

- The report pairs each screen with its locked image: a perceptual similarity (SSIM on luminance; "close" at
  ≥ 0.95), the changed-pixel ratio, and a side-by-side image (prototype | app | difference). Unmapped screens
  show as "not built yet". Filter by layout, theme, persona and status.

## Visual references

`e2e/visual/visual.spec.ts` compares states with committed reference images (`toHaveScreenshot`, at most 0.1 %
of pixels may differ). References are per platform: record the macOS ones with `e2e:update`, and the Linux ones in
CI's container with the `visual references` workflow; review their diffs in the pull request.

## CI

The `e2e` job in `.github/workflows/check.yml` installs Chromium and runs the journeys and visual references in
four shards with strict gates on pull requests to `main` and `redesign`, and keeps the report as an artifact.
