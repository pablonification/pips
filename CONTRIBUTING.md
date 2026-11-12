# Contributing to PIPS!

Thank you for helping. You do not need to know the whole app: most changes touch one screen or one route. If you use
a coding agent, it reads [AGENTS.md](AGENTS.md) first; the same rules apply to you.

## First run

You need Git, Node 22 or later, and a local PostgreSQL 16. About 30 minutes the first time.

**1. Get the code and the tools.**

```bash
git clone <the address from the green Code button on GitHub> pips && cd pips
corepack enable          # installs the pnpm version this repository pins
pnpm install
```

**2. Start a PostgreSQL.** Pick one.

With Docker:

```bash
docker run -d --name pips-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pips postgres:16
```

Without Docker (install PostgreSQL 16 first, for example `brew install postgresql@16` or your Linux package
manager; the commands `initdb`, `pg_ctl` and `createdb` come with it):

```bash
initdb -D ~/pips-pg -U postgres --auth=trust
pg_ctl -D ~/pips-pg -l ~/pips-pg/server.log start
createdb -h 127.0.0.1 -U postgres pips
```

Stop it later with `pg_ctl -D ~/pips-pg stop`. Windows: use Docker, or WSL.

**3. Set up the API.**

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fix the lines that say CHANGE: the database address, `JWT_SECRET`, the test-login password
hash, and the two web-push keys. Each has its command in a comment. The `.env` file is private to your machine.

```bash
pnpm --filter api db:migrate      # prints "Migrations applied"
pnpm --filter api dev             # prints "Server is running on port 5000"
```

Check it: `curl http://localhost:5000/` answers `Server runs successfully`, and `http://localhost:5000/swagger` lists
every route.

On a Mac, port 5000 belongs to AirPlay. Set `PORT=5100` in `apps/api/.env`, and put
`DEV_API_ORIGIN=http://127.0.0.1:5100` in `apps/web/.env.development.local`.

**4. Start the web app.** In a second terminal:

```bash
echo 'VITE_GOOGLE_CLIENT_ID=unused.apps.googleusercontent.com' > apps/web/.env.local
pnpm --filter web dev             # http://localhost:5173
```

Without that value the sign-in page crashes with "Missing required parameter client_id". Google's button then does
nothing, which is fine: use the test-login form on the same page. It appears because `apps/web/.env.development` sets
`VITE_ENABLE_TEST_LOGIN=true`. Sign in with `DEV_LOGIN_EMAIL` and the password you hashed. You land on the first-run
page, `/mulai`.

**5. Your account and some data.** The first test login creates one member, "Development Tester", with no roles.
Only people already in the `users` table can sign in with Google, so test login is your way in. Give yourself a role
to see the tools for pengurus (roles are in [CONTEXT.md](CONTEXT.md)), and add a category so announcements can be
written:

```bash
psql postgresql://postgres:postgres@127.0.0.1:5432/pips -c "insert into user_roles (user_id, role) select id, 'admin' from users where nim = 'DEVTEST01'"
psql postgresql://postgres:postgres@127.0.0.1:5432/pips -c "insert into categories (id, name, required_push, is_for_info) values ('akademik', 'Akademik', false, true)"
```

No `psql` on your machine? With Docker, run the same SQL with
`docker exec pips-db psql -U postgres pips -c "…"`.

Reload the page. There is no sample data beyond this: courses, calendar events and announcements start empty, and
`pnpm --filter api db:seed` only adds one form (it also never exits; press Ctrl+C). Add what you need with `psql` or
through the app. Never copy real members' data into your database.

## Your first change

Change one sentence and watch a test notice.

1. Find it: `grep -rn "Akun uji" apps/web/src/copy`. Every sentence lives in `apps/web/src/copy/`.
2. Edit `judul: 'Akun uji'` in `apps/web/src/copy/masuk.ts` to another word, in Indonesian and the *kamu* voice.
3. Run the unit tests that mention it: `pnpm --filter web exec tsx --test tests/test-login-form.test.ts tests/copy.test.ts`.
   One fails, because `tests/test-login-form.test.ts` still expects the old word. Fix that test too. The copy check
   in `tests/copy.test.ts` passes while the new word follows `src/copy/glossary.ts`.
4. Run `pnpm check && pnpm test`, then open a pull request.

## Commands

| Command (from the repository root) | What it does |
| --- | --- |
| `pnpm check` | Type check and lint, both apps. |
| `pnpm test` | Unit tests, both apps. The API's use no database. |
| `pnpm build` | Production build of both apps. |
| `pnpm --filter api test:db` | API tests against a real database. Needs `TEST_DATABASE_URL`. |
| `pnpm --filter web exec playwright test -c e2e --project=phone-light masuk` | One journey file at one size and theme. |
| `pnpm --filter web exec playwright install chromium` | Once, to download the browser journeys use. |
| `pnpm --filter web api` | Regenerate the web app's API client after an API route changed. |
| `pnpm --filter api db:migrations` | Write a migration after `apps/api/src/db/schema.ts` changed. |
| `pnpm --filter api db:migrate` | Apply migrations to `DATABASE_URL`. |

`TEST_DATABASE_URL` must point at a local database whose name starts with `pips_test`, for example
`postgresql://postgres:postgres@127.0.0.1:5432/pips_test`. Create it with `createdb -h 127.0.0.1 -U postgres pips_test`, or with Docker
`docker exec pips-db createdb -U postgres pips_test`. The
tests refuse any other database, because they write to it.

Journeys run a production build of the app against a pretend API, so they need no server. Do not run all of them:
that is over 5,000 tests and takes more than an hour. CI runs them. Run the files that cover your change.

## How the tests are layered

Web unit tests, API unit tests, database tests, journeys, quality gates and screenshot references each catch a
different kind of mistake. [docs/testing.md](docs/testing.md) says which to write when.

## Nothing personal in the repository

This repository is public and stays in Git history for good. Never commit a real member's name, student number,
email address, photo or message, a `.env` file, a key, or a path from your own computer. Use made-up people. A test
in `scripts/` fails on a real-looking student number or email address; CI runs it on every pull request.
If you committed something by mistake, tell the maintainers at once; do not just delete it in a later commit.

## Opening a pull request

1. Branch from the branch pull requests merge into (`redesign` today): `git switch -c fix/short-name`.
2. Commit in small steps. Every commit message is a Conventional Commit, `type(scope): what changes`, for example
   `fix(web): keep a typed comment when the request fails`. CI refuses any other form, and a first line over 100
   characters. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
3. Run `pnpm check && pnpm test` and the journey files you touched.
4. Push and open a pull request with the template. Say what changes for a member and why, and how you checked it.
   Pull requests are squash-merged, so the title becomes the commit: write it as one.
5. If an AI tool wrote the description or the code, end the description with a true
   `Made with <model> in <harness>.` line. Do not add a co-author for a tool.

## Who to ask

Open a GitHub issue with the Idea form or the Bug form, or comment on your pull request. Report a security problem
privately: see [SECURITY.md](SECURITY.md).
