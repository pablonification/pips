# 1. The web app and the API live in one repository

Status: accepted.

## Context
PIPS! is two programs: the web app members open (`apps/web`) and the server behind it (`apps/api`). They used to be
two repositories. A change that touched both (a new field on a post, say) needed two pull requests that had to be
merged in the right order.

## Decision
- Both apps live in this repository under `apps/`.
- pnpm workspaces (`pnpm-workspace.yaml`) give one install and one lockfile (`pnpm-lock.yaml`).
- Turborepo (`turbo.json`) runs each app's `build`, `check`, `test` and `e2e` tasks from the root and caches them.
- There is no shared package. When both apps need the same rule (which files may be uploaded, which role may do
  what), each has its own copy and a test keeps the two equal (`apps/web/tests/upload-policy.test.ts`,
  `apps/web/tests/capabilities.test.ts`).

## What else was possible
- Two repositories, as before: simpler to deploy separately, but every cross-cutting change is two pull requests.
- One repository with a shared package: no copies, but a third thing to build, version and explain.

## What it costs
- With two apps and no shared package, Turborepo adds little over `pnpm -r`. It is one more tool to learn.
- The copied rules are only as safe as the tests that compare them. The role test reads the API's route table, and its
  source as text for the checks inside handlers, so a rename in the API can break it for a reason that looks
  unrelated.
- Both apps deploy from the same repository, so a broken commit blocks both even when only one app changed.

## When to revisit
When a third piece of code needs the same rules (a mobile app, a bot), or when the copy-and-compare tests start
failing often. Then a small shared package for the role lists and the upload policy replaces them.
