# Add a migration

A change to the database: here, one new nullable column. The steps were tried on a made-up `note` column on the
`angkatan` table, on a throwaway database. Replace the table and column with yours. Everything is under `apps/api/`
unless the path starts with `apps/web`.

**Migrations only add things.** Never drop or rename a column or a table in one, and give a new column no
`notNull()` unless it has a default: the old app keeps running on the migrated database for a while and knows nothing
about your column ([DEPLOY.md](../../DEPLOY.md) has the order of the day). Never run a migration against a database that
is not yours.

## Steps

1. **Change the schema**, `src/db/schema.ts`. The tables are written with drizzle, like `angkatan`:
   ```ts
   export const angkatan = pgTable('angkatan', {
     id: text('id').primaryKey().$defaultFn(createId),
     year: integer('year').unique().notNull(),
     name: text('name').unique().notNull(),
   });
   ```
   Add `note: text('note'),` after `name`. With no `.notNull()` the column is nullable, so existing rows stay valid.
2. **Write the migration**: `pnpm --filter api db:migrations --name angkatan_note`. It needs no database and no
   `.env`. It prints the tables it knows and ends with `[✓] Your SQL migration file ➜ drizzle/0031_angkatan_note.sql`.
   Without `--name` it picks a random one (`0031_flippant_sleepwalker.sql`); a name that says what changed is easier to
   read later, as `0030_pixel_form_prefill.sql` is.
   Three files change, and all three are committed: the new `drizzle/<number>_<name>.sql`, a new
   `drizzle/meta/<number>_snapshot.json` and a new entry in `drizzle/meta/_journal.json`. Read the SQL. For this
   change it is one line: `ALTER TABLE "angkatan" ADD COLUMN "note" text;`. Never edit an old migration.
3. **Apply it to a database of your own.** Make a throwaway one on the local PostgreSQL, named `pips_test_` and your
   name, as [testing](../testing.md) shows (`createdb -h 127.0.0.1 -U postgres pips_test_mine`), then give the address
   on the command line so a `.env` can never point this at another database:
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pips_test_mine pnpm --filter api db:migrate
   ```
   You should see `Migrations applied` in under a second. Running it again changes nothing.
4. **Run the database tests** against the same database. They migrate the whole `drizzle/` folder from empty,
   so a migration that doesn't apply cleanly fails here:
   ```bash
   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/pips_test_mine pnpm --filter api test:db
   ```
   `tests/db/migrate.test.ts` is the one about migrations; a change that needs its own proof (a lock, a backfill, a
   constraint) gets a test beside it in `tests/db/`, set up as `tests/db/curhat.test.ts` is.
5. **Run the check CI runs** to see the migrations agree with `schema.ts`. From `apps/api`:
   ```bash
   rm -rf .drizzle-check && cp -R drizzle .drizzle-check
   DATABASE_URL=unused pnpm exec drizzle-kit generate --dialect postgresql --schema ./src/db/schema.ts --out .drizzle-check
   diff -r drizzle .drizzle-check && echo "no drift"; rm -rf .drizzle-check
   ```
   You should see `No schema changes, nothing to migrate` and then `no drift`.
6. **See who else sees the column.** A type built with `createSelectSchema(table)` (for example `types/category.types.ts`,
   which then `.omit({ … })`s the private columns) now includes the new column in the API's answers. Regenerate the
   client and read the difference: `pnpm --filter web api && git diff apps/web/src/api/generated`. In the trial,
   `models/Angkatan.ts` gained `note: string | null`, and the web type check then failed in the pretend API's sample
   data, `error TS2322 … Property 'note' is missing` in `apps/web/e2e/fixtures/api.ts`. Either `.omit` a private column
   from the answer, or add the field to the sample data. Commit the regenerated client.
7. **Drop your throwaway database** and check `git status` shows only what you meant to commit.

## What will stop you

| You skipped | What prints |
| --- | --- |
| Step 2 (changed `schema.ts`, no migration) | CI, "The migrations match the schema": `Only in .drizzle-check: 0031_….sql` and `schema.ts has changes no migration covers: run 'pnpm --filter api db:migrations' and commit the result.` |
| A `.env` pointing somewhere real | Nothing stops `db:migrate`: it reads `DATABASE_URL` from the environment, then from `apps/api/.env`. Always pass the address yourself. |
| Step 6 | `pnpm --filter web check`: `Property 'note' is missing in type …`; or, worse, a private column in an answer, which no check catches. |

A new column that holds personal data of members is subject to the repository's privacy rules: no real values in tests or
seeds ([AGENTS.md](../../AGENTS.md)).
