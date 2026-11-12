# 6. Database migrations only add things, and run before the new code goes live

Status: accepted.

## Context
The database changes as the app grows. A migration that deletes or renames something breaks the version of the
app that is still running while the new one is being deployed.

## Decision
- The tables are described in `apps/api/src/db/schema.ts` with Drizzle. `pnpm --filter api db:migrations` writes a
  SQL file for each change into `apps/api/drizzle/`; `pnpm --filter api db:migrate` applies them
  (`apps/api/src/db/migrate.ts`).
- Migrations only add (a table, a column, an index). The old version of the app keeps working on a migrated
  database, so the order of a deploy is: back up, migrate, then switch the code (`DEPLOY.md`).
- Migrations are not run when the API starts. A person runs them.
- `migrate.ts` first repairs the counter in Drizzle's own record of applied migrations. Two older migrations were
  recorded by hand, so the counter was behind the rows and every later migration failed. The repair is harmless on
  any other database. `apps/api/tests/db/migrate.test.ts` covers it, and CI runs it (the `api-db` job).

## What else was possible
- Migrate automatically at start-up: nobody forgets, but a bad migration then takes the server down with it, and
  two copies starting at once would race.
- Another tool (Prisma, plain SQL files): no reason strong enough to move away from what the code already used.

## What it costs
- A person must remember to migrate before deploying.
- Three migrations in the middle of the sequence (`0022`–`0024`) have no snapshot in `apps/api/drizzle/meta/`, so
  the history is not uniform. Check a generated migration by reading it before you commit it.
- Drizzle does not stop you committing a schema change with no migration, so CI checks it: after the database
  tests, the `api-db` job asks `drizzle-kit generate` for a migration and fails if it would write a new file. When
  that step fails, run `pnpm --filter api db:migrations` and commit the result.
- Drizzle is held at an old version (0.33); newer versions change some behaviour.

## When to revisit
When a deploy goes wrong because a migration was missed, or when a change truly needs to remove or rename
something. That needs a two-step release (add and copy first, remove in a later release).
