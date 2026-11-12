# Testing

PIPS! has six kinds of test. Each catches a different mistake, so pick the lowest one that can show the problem.
A bug fix always gets a test that fails on the old code first. Words such as journey and gate are in
[CONTEXT.md](../CONTEXT.md); why journeys work the way they do is in
[decision 17](adr/0017-journeys-run-a-production-build-against-a-pretend-api-on-a-fixed-clock.md) and
[18](adr/0018-every-journey-passes-quality-gates-and-screens-are-held-by-screenshots.md).

## The six kinds

| Kind | Where | It is for | Run one file |
| --- | --- | --- | --- |
| Web unit test | `apps/web/tests/*.test.ts`, `*.test.mjs` | Rules with no screen (`features/*/rules.ts`, `lib/`), the copy and design-system checks | `pnpm --filter web exec tsx --test tests/copy.test.ts` (`.mjs`: `pnpm --filter web exec node --test tests/garis-tokens.test.mjs`) |
| API unit test | `apps/api/tests/*.test.ts` | A route through its controller with fake storage, and `lib/` rules. No database. | `pnpm --filter api exec tsx --test tests/authorization.test.ts` |
| API database test | `apps/api/tests/db/*.test.ts` | What only a real database shows: SQL, locks, migrations, parallel requests | `TEST_DATABASE_URL=… pnpm --filter api exec tsx --test tests/db/info-read-all.test.ts` |
| Journey | `apps/web/e2e/journeys/*.spec.ts` | What a member sees and does, in a browser | `pnpm --filter web exec playwright test -c e2e --project=phone-light layanan` |
| Quality checks | `apps/web/e2e/qa/`, and the gates inside every journey | Accessibility, keyboard, zoom, errors, motion, offline | by the same command, with a `qa-` project |
| Visual reference | `apps/web/e2e/visual/` | A screen's look, kept as a screenshot | `pnpm --filter web exec playwright test -c e2e --project=visual-phone-light` |

`pnpm test` runs the first two kinds, for both apps. `pnpm check` is the type check and lint, and it covers the test
folders too (`apps/web` checks `tests/` and `e2e/` with their own tsconfig).

## Which one to write

1. **A rule or a calculation** (who may delete, when a form is open, how a draft is merged): a unit test of the
   function. Most bugs end here. Put the rule in `lib/` or `rules.ts` so it can be tested without a screen.
2. **An API route**: an API unit test that calls the router with a fake `deps` (`apps/api/tests/support/router.ts`;
   `programme-windows-route.test.ts` is a short example). Always include a member without the role and see 401 or
   403.
3. **A query, a lock or a migration**: an API database test.
4. **Something a member sees or does**: a journey, but only for what needs a browser (a layout, focus, a sheet that
   opens, a request that fails). Extend an existing spec before adding one.
5. **A new screen**: a journey that passes the gates (below). Add a visual reference only if the screen's look is
   worth guarding.

## Web and API unit tests

- Plain `node:test` and `node:assert/strict`; no other framework. A web test imports straight from `../src/...`.
- The API's route tests call `usePlaceholderEnv()` (`apps/api/scripts/placeholder-env.ts`) before importing the app,
  so no real setting is needed.
- `apps/web/tests/capabilities.test.ts` reads the API's source as text to check the web app's role table against the
  server's checks. If you add a capability, that test tells you where to mirror it.

## API database tests

They write to a real PostgreSQL, so they refuse any database that is not on `127.0.0.1` or `localhost` and not named
`pips_test…`. Make one and point at it:

```bash
createdb -h 127.0.0.1 -U postgres pips_test          # or: docker exec pips-db createdb -U postgres pips_test
export TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pips_test
pnpm --filter api test:db
```

The tests migrate that database from empty themselves and run one file at a time. The first lines of
`apps/api/tests/db/curhat.test.ts` show the setup to copy.

## Journeys

A journey runs a **production build** of the web app in Chromium, against a **pretend API**, on a **fixed clock**.

- **Build first.** Playwright builds the app into `apps/web/e2e/.build` and serves it with `vite preview`
  (`e2e/scripts/serve.mjs`). The first run takes minutes. Set `E2E_REUSE_BUILD=1` to reuse the last build; rebuild
  after any change to `src`.
- **Browser.** Once: `pnpm --filter web exec playwright install chromium`.
- **Projects.** Each journey runs at phone (390 px), tablet (834 px) and desktop (1440 px), in light and dark:
  `phone-light`, `phone-dark`, and so on. Tag a test `@phone-only` or `@desktop-only` when only one layout has the
  feature (tablets run the `@phone-only` ones).
- **The pretend API** (`e2e/support/mock.ts`, defaults in `handlers.ts`, data in `e2e/fixtures/`) answers every
  request from sample data. A request nobody answered fails the test, and so does any write the test did not allow
  with `api.on('POST /api/…', …)`. Nothing reaches a real server. The sample data is typed from the generated API
  client, so a changed API shape breaks `pnpm check` rather than hiding.
- **The fixed clock** is Thursday 8 October 2026, 13.35 WIB. A test can set another time with `test.use({ now })`,
  or `now: null` for the real clock.
- **Persona.** A test is a plain anggota by default. `test.use({ persona: 'pengurus' })`, `roles`, `signedIn: false`
  and other options are listed at the top of `e2e/support/test.ts`.
- **Write one** by importing `test` and `expect` from `../support/test` (never from `@playwright/test`).
  `e2e/journeys/services.spec.ts` is the shortest example; `layanan.spec.ts` shows a full screen.

Do not run every journey on your machine. There are over 5,000 of them across the projects, and a full run takes
more than an hour. Run the spec you changed in one or two projects, with `E2E_WORKERS=2` or fewer. CI runs the rest.

### Gates

Every journey that ends in `strictGates(page, testInfo, name, lit)` (`e2e/support/strict.ts`) checks the screen for:
no serious or critical accessibility problem (axe), no sideways scroll, no text under 12 px, `lang="id"`, inputs of at
least 16 px on touch layouts, a visible focus ring at every Tab stop, the right navigation item lit, and no overflow
or clipped control at 320, 390, 768, 1024 and 1440 px and at 200 % zoom. `E2E_GATES=record` only records problems;
CI leaves it unset, which is strict. A new screen needs a journey that calls `strictGates`.

### Quality checks

`e2e/qa/` sweeps every page rather than one screen: the Tab walk, error and not-found states, each role's tools,
400 % zoom, reduced motion, the service worker offline, and times in WIB on a device in another time zone. Its
README has the table. They run in CI; run one with its project, for example
`pnpm --filter web exec playwright test -c e2e --project=qa-reflow`.

### Timed journeys

A journey tagged `@solo` times the browser's main thread, and another test running beside it spoils the number. Solo
journeys run on their own: `pnpm --filter web e2e:solo` (one worker), and CI gives them their own job. Do not tag a
journey `@solo` for anything but timing.

## Visual references

`e2e/visual/visual.spec.ts` screenshots chosen screens and compares them with images kept in
`e2e/visual/visual.spec.ts-snapshots/`. A screen may differ by at most 0.1 % of its pixels.

- **They are per platform.** Every image exists as `…-darwin.png` (recorded on a Mac) and `…-linux.png` (what CI
  compares against). Fonts and rendering differ between machines, so never copy one into the other.
- **Update on purpose.** `pnpm --filter web e2e:update` re-records every reference on your machine; review the
  changed pictures in your pull request. For the Linux ones, run the **visual references** workflow from the
  Actions tab on your branch: it records them in CI's container and commits them to the branch. Then trigger CI
  again on that commit.
- A reference that changes with no change of yours means the screen changed by accident.

## What CI runs

`.github/workflows/check.yml` runs on every pull request (and on `main` and `redesign` when they change):

| Job | What |
| --- | --- |
| `commit messages` | The repository's own checks (`node --test scripts/*.test.mjs`, which includes the privacy check that refuses a real person's details), then every commit is a Conventional Commit (`scripts/commit-messages.mjs`). |
| `check, test and build` | The repository's own checks (`scripts/*.test.mjs`), install, type check and lint, the generated API client matches the API, unit tests, production build, the bundle checks (no test login or gallery in production, route size cap). |
| `api database tests` | The database tests on a throwaway PostgreSQL 16, and a check that the migrations match `schema.ts`. |
| `docker images` | Both images build and start. The API stays up with no database and stops cleanly. |
| `e2e shard 1/4` … `4/4` | Every journey and quality check in all projects, strict gates, split in four. |
| `e2e solo` | The timed journeys, alone. |
| `e2e (web journeys)` | One result that is green only when the four shards and the solo run all passed. |

## Traps

- **The clock is fake and the API is pretend, so a bug in a real timer or a real response can pass every journey.**
  When your change involves timers, sockets, push or data shaped by the real server, also try it once by hand against
  a local API ([CONTRIBUTING.md](../CONTRIBUTING.md), "First run").
- **A journey passing offline from a pretend API says nothing about the real API.** The API's own tests and the
  generated client are what keep the two honest.
- **Screenshots are per platform.** See above.
- **A timing budget that fails only when other tests run beside it** belongs in a `@solo` journey.
- **Never skip, weaken or delete a test to get green.** If a test asserts the old behaviour, change the test and say
  why in the pull request.
