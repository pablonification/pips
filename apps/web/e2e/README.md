# PIPS! browser harness

Playwright drives a **production build** of the web app, served locally with `vite preview`. Every request the
app makes is answered from typed fixtures built from sample data (`fixtures/prototype.ts`), with a fixed clock.
Nothing reaches a real API, Google, Sentry or any other site.

The journeys are heavy: run one command at a time, and use at most 2 workers (`E2E_WORKERS=2`, the default). Never
run the whole suite on your own machine; CI does.

## Commands

All from the repository root (or `pnpm run <script>` inside `apps/web`):

| Command                        | What it does                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter web e2e`        | The journeys (`e2e/journeys/`) at phone, tablet and desktop size, light and dark, plus the visual references (`e2e/visual/`). |
| `pnpm --filter web e2e:update` | Records or updates the visual reference images (`toHaveScreenshot`).                                                          |
| `pnpm --filter web test`       | The Node unit tests in `tests/`.                                                                                              |

Arguments after the script name go to Playwright, e.g. `pnpm --filter web e2e --grep Curhat`.

**Environment variables**

| Variable            | Effect                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `E2E_REUSE_BUILD=1` | Reuse the last build in `e2e/.build` instead of building again (builds take minutes here). Rebuild after changing app code. |
| `E2E_WORKERS`       | Parallel browsers (default 2).                                                                                              |
| `E2E_PORT`          | The preview port (default 4310).                                                                                            |
| `E2E_GATES=record`  | Only record the quality gates instead of failing on them.                                                                   |

In CI, `E2E_REUSE_BUILD` is unset and the web server builds first. Playwright's own output goes to `e2e/.results/` and its HTML report to `e2e/.report/`.

## What every test gets

`support/test.ts` extends Playwright's `test`. Import `test` and `expect` from there:

- **Projects** (`playwright.config.ts`): `phone-light`, `phone-dark` (390 × 844, touch, device scale 2, a phone
  user agent), `tablet-light`, `tablet-dark` (834 × 1112, touch, device scale 2, a tablet user agent) and
  `desktop-light`, `desktop-dark` (1440 × 900). Tag a test `@phone-only` or `@desktop-only` when only one layout
  has the feature; the other projects leave it out. Tablets are touch layouts below 1024 px, so they run
  `@phone-only` tests too. `support/app.ts` has `layoutOf(testInfo)` ('phone',
  'tablet' or 'desktop', the shell's three layouts) and `isPhone(testInfo)` (phone or tablet).
- **Timed journeys:** tag a journey `@solo` when it times the main thread (long tasks, frame budgets). The journey
  projects leave it out; `pnpm --filter web e2e:solo` runs it in `solo-<layout>-<theme>` with one worker, so no
  neighbouring test competes for the CPU. CI runs it as its own job. The whole suite is `e2e`, then `e2e:solo`.
- **The shell:** `navLink(page, 'Beranda' | 'Pengumuman' | 'Kalender' | 'Layanan' | 'Profil')` finds a
  destination in whichever navigation the layout shows (Profil: your avatar, or your name in the sidebar);
  `greeting(page, 'Nadia')` is Beranda's "Halo, Nadia"; `inMain(page, text)` finds text in the page, not the
  shell. On phones and tablets a drill-down page's title is also the top bar's `h1` (unless the screen shows its own
  `PageTitle`; then the top bar's title is hidden from screen readers), so look for a screen's own headings inside
  `page.getByRole('main')`.
- **The shell's test page** `/dev/shell` (`src/dev/shell/`, development, staging and the harness's build only): a
  page below Layanan with its own title, top-bar actions, a field and 30 buttons; `?judul=…` gives it a title from
  data. `journeys/shell-page.spec.ts` checks the shell's slots on it until real screens use them.
- **Defaults:** time zone `Asia/Jakarta`, locale `id-ID`, service workers blocked, reduced motion, CSS
  animations and transitions off, and a fixed clock: **Kamis, 8 Oktober 2026, 13.35 WIB** (the sample data's
  "now"; see `fixtures/NOTES.md`). Time then runs normally from there.
- **Options** (set with `test.use({...})`):
  - `persona`: `'anggota'` (Nadia Putri, IF 2025 PIXEL; default) or `'pengurus'` (Raka Pratama, IF 2024, with
    `akademik` and `admin`), or `null` for nobody.
  - `signedIn` (default `true`): signed out, the API answers 401 until the test sets `db.signedIn = true`.
  - `installed` (default `true`): runs as the installed PWA (`display-mode: standalone`), which the app reads for
    Pasang PIPS! and the iOS push step. `installed: false` runs as a phone browser (and checks the removed install tutorial
    stays gone).
  - `now`: another fixed time (ISO string), or `null` for the real clock.
  - `platform`: what `navigator.platform` reports (`'MacIntel'`, `'Linux x86_64'`), or `null` (default) for the
    browser's own. The app names the search shortcut by platform (⌘K on Apple, Ctrl K elsewhere).
- **Fixtures:** `db` is this test's own copy of the persona's data (`fixtures/api.ts`); `api` is the mock layer.

## Fixtures

- `fixtures/prototype.ts`: the sample data (members, posts, events, courses, forms), as plain objects.
- `fixtures/api.ts`: the same data in the real API's shapes, typed with `src/api/generated`, so `pnpm typecheck`
  fails if the API changes shape. `buildDb(persona)` gives one persona's view (visibility, read state, courses,
  rooms, forms).
- `fixtures/NOTES.md`: every place where the sample data doesn't fit the API, and what the fixtures do.
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

Members' Curhat opens one socket.io connection for the whole area (`auth: { curhat: true }`); so does
Welfare's inbox at /kelola/curhat, whose handshake joins every room and the `curhat:welfare` group room.
Live Counting opens one with `auth.formAdminId`. The fake speaks the API's protocol: the handshake joins your rooms
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
and `lang`. The gates are **strict** by default: a journey fails on any serious or critical axe
violation, any overflow, any text under 12 px or `lang` other than `id`. The results are attached to each test as
`gates-<name>.json`. `E2E_GATES=record` only attaches them. `support/strict.ts` adds stricter checks
(focus, inputs on touch, the lit navigation item, every window width).

## Visual references

`e2e/visual/visual.spec.ts` compares states with committed reference images (`toHaveScreenshot`, at most 0.1 %
of pixels may differ). References are per platform: record the macOS ones with `e2e:update`, and the Linux ones in
CI's container with the `visual references` workflow; review their diffs in the pull request. That workflow's file
(`.github/workflows/visual-references.yml`) lives on `main`, because GitHub runs a hand-started workflow from the
default branch: start it with `gh workflow run visual-references.yml -f branch=<your branch>`.

## CI

The `e2e` job in `.github/workflows/check.yml` installs Chromium and runs the journeys and visual references in
four shards with strict gates on pull requests to `main` and `redesign`, and keeps the report as an artifact.
