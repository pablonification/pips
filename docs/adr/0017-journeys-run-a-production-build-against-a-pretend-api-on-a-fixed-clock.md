# 17. Browser journeys run a production build against a pretend API, on a fixed clock

Status: accepted.

## Context
The most useful tests drive a real browser through what a member does. They must be fast, give the same result
every time and need no secrets, so anyone can run them and CI can run them on every pull request.

## Decision
- Playwright drives a production build of the web app (`apps/web/e2e/`, journeys in `e2e/journeys/`). Nothing
  reaches a real API, Google, Sentry or any other site.
- A pretend API answers every request from sample data (`e2e/support/mock.ts`, `handlers.ts`, `writes.ts`; the
  sample data in `e2e/fixtures/`), and a pretend chat server answers the live connection
  (`e2e/support/socketio.ts`). A request that nothing was told to expect fails the test, and so does a write
  that the test did not set up itself.
- Every journey starts at one fixed moment, Thursday 8 October 2026, 13.35 WIB (`e2e/support/test.ts`), so
  "3 hari lagi" and every screenshot read the same on every run. A journey that must use the real timers sets
  `now: null`.
- Unit tests (`apps/web/tests/`, `apps/api/tests/`) cover rules with no browser.

## What else was possible
- Journeys against a real API and database: closer to production, but slow, hard to repeat and in need of secrets
  and setup.
- Component tests, or fewer browser tests and more unit tests: faster, but they miss what only a whole page shows.
- The real clock, with tests written to tolerate any date: no hidden timer bugs, but dates and screenshots change
  every day.

## What it costs
- The pretend API is a second implementation of the API that must be kept true by hand. Its data shapes are checked
  against the real API's types, but its behaviour (which status code, who gets a 401, when a form is closed) is
  copied. A passing journey does not prove the real API does the same.
- The fixed clock hides real timer bugs: the fake clock does not behave exactly like the browser's, so code that
  misuses a timer can pass every journey and fail for a member. Use `now: null` for anything that depends on timers.
  Be wary of dates too: a unit test that pins a date but reads the real one starts failing when the real date
  moves on.
- Every run uses Chromium, and the service worker is blocked in all but one project. Safari on iPhone, where an
  installed app and web push behave differently, is not exercised.
- The suite is as large as the app it tests, and takes several parallel CI machines (see 0019).

## When to revisit
When a bug appears that only a real API would have shown (a small CI job that runs the built app against the real
API and a database, for five or six core journeys, is the first step), or when Safari-only problems reach members.
