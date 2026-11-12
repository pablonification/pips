# 19. Every pull request runs every journey in all six projects, on five machines

Status: accepted.

## Context

A journey is run at three sizes (phone, tablet, desktop) in two themes (light, dark): six Playwright "projects". The
whole suite is thousands of runs, too many for one machine to finish quickly.

## Decision

- `.github/workflows/check.yml` runs on every pull request: commit messages and the repository's own checks in
  `scripts/` (including one that fails when a real person's details are committed), type check and lint, a check that
  the generated API client is current, unit tests, a production build, a bundle check and the size budgets (see 0012),
  the API's database tests and a check that the migrations match the schema (see 0004 and 0006), both Docker images
  built and started, and the journeys.
- The journeys are split over four machines, each running a quarter of them (a "shard": `--shard=N/4`). The tests that
  time the main thread run alone, one at a time, on a fifth (`e2e:solo`), because a neighbouring test was enough to push
  them over their limit.
- Every journey runs in all six projects (`apps/web/e2e/playwright.config.ts`). A journey that makes sense only on one
  layout is tagged `@phone-only` or `@desktop-only`.
- A push to `main` or `redesign` runs the checks and the images, not the journeys: the pull request already ran them on
  that code.
- Pull requests are squash-merged: one commit per pull request on the shared branches, titled by the pull request. A
  check refuses a pull request whose commits are not Conventional Commits (`scripts/commit-messages.mjs`). Nothing
  checks the pull request's title, which becomes the commit on the shared branch, so write it in the same form. (Squash
  merging is a setting of the repository on GitHub, not something in the code.)

## What else was possible

- Run only the tests a change touches: faster, but a shared style change touches everything, and picking the right tests
  is itself a source of mistakes.
- One layout and one theme per pull request, the full set nightly: much cheaper, but a dark-mode or tablet break would
  reach the branch and be found later.

## What it costs

- Every pull request, even a one-word fix, uses five machines and takes about 20 minutes. If the account's CI is ever
  stopped (a quota, a billing problem), nothing can merge.
- Each part has a time limit (45 minutes in `check.yml`). When the suite outgrew a limit, the limit was raised rather
  than the suite made smaller.
- Many journeys repeat across six projects with no new information. That is where to save time if it is needed.

## When to revisit

When waiting for CI slows contributors down more than a late break would. The first step would be one layout per pull
request and the full matrix on the release branch.
