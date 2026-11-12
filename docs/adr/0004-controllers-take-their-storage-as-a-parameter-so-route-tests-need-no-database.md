# 4. Controllers take their storage as a parameter, so route tests need no database

Status: accepted.

## Context
A request in the API travels route → controller → repository (the database queries) → `lib` (rules with no database
and no HTTP). To test a controller's logic (who gets a 401, when a form is closed) you would normally need a running
PostgreSQL. That makes tests slow and awkward on a student's laptop.

## Decision
- Repository functions are plain functions that take the database as their first argument
  (`apps/api/src/repositories/`).
- Newer controllers are built by a function that takes the storage they need, for example `createCurhatRouter(deps)`
  in `apps/api/src/controllers/curhat.controller.ts`. `apps/api/src/controllers/deps.ts` has the helpers
  (`withDb` binds a repository function to the real database; `WithoutDb` is its type).
- A route test passes pretend storage and calls the router directly with `apps/api/tests/support/router.ts`. No
  server and no database.
- The same rules are also tested against a real throwaway PostgreSQL in `apps/api/tests/db/` (`pnpm --filter api
  test:db`).
- Rules that need neither (when a form is open, who may delete) live in `apps/api/src/lib/` and are unit-tested
  alone.

## What else was possible
- Every test on a real database: honest, but slow and it needs setup before anyone can run a test.
- Queries written inside handlers: fewer files, but then nothing can be tested without a database.

## What it costs
- It is only half done. About half the controllers still import the database directly
  (`grep "db/drizzle" apps/api/src/controllers`) and can only be tested with one. A contributor meets both styles.
- A test with pretend storage proves the handler's logic, not the SQL. A wrong query passes it.
- The tests that do run SQL (`tests/db/`) are not run by CI yet.

## When to revisit
When a bug gets through that only a real query would have shown. Move a controller to the new style whenever you
change it, and add the database tests to CI.
