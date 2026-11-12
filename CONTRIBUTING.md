# Contributing to PIPS!

Thank you for helping. You do not need to know the whole app: most changes touch one screen or one route. If you use
a coding agent, it reads [AGENTS.md](AGENTS.md) first; the same rules apply to you.

## First run

You need Git, Node 22 or later, and a local PostgreSQL 16. About 30 minutes the first time.

**1. Get the code and the tools.**

```bash
git clone -b redesign <the address from the green Code button on GitHub> pips && cd pips
corepack enable          # installs the pnpm version this repository pins
pnpm install
```

`-b redesign` matters for now: the redesigned app lives on the `redesign` branch until it replaces `main`.

**2. Start a PostgreSQL.** Pick one.

With Docker:

```bash
docker run -d --name pips-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pips postgres:16
```

If port 5432 is already taken on your machine, change the first number in `-p 5432:5432` (say to `5433`) and use that
port in every database address below.

Without Docker, install PostgreSQL 16 first (for example `brew install postgresql@16`, or your Linux package
manager). Its commands `initdb`, `pg_ctl`, `createdb` and `psql` come with it. Homebrew doesn't put them on your
PATH, so on a Mac run this once per terminal:

```bash
export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
```

```bash
initdb -D ~/pips-pg -U postgres --auth=trust
pg_ctl -D ~/pips-pg -l ~/pips-pg/server.log start
createdb -h 127.0.0.1 -U postgres pips
```

If port 5432 is taken, start it on another one (`pg_ctl -D ~/pips-pg -l ~/pips-pg/server.log -o "-p 5433" start`,
then `createdb -h 127.0.0.1 -p 5433 -U postgres pips`) and use that port in every database address below. Stop it
later with `pg_ctl -D ~/pips-pg stop`. Windows: use Docker, or WSL.

**3. Set up the API.**

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fix the lines that say CHANGE: the database address, `JWT_SECRET` (at least 32 characters, or
the API will not start), the test-login password hash, and the two web-push keys. Each has its command in a comment. The `.env` file is private to your machine.

```bash
pnpm --filter api db:migrate      # prints "Migrations applied"
pnpm --filter api dev             # prints "Server is running on port 5000"
```

Check it: `curl http://localhost:5000/` answers `{"message":"Server runs successfully"}`, and
`http://localhost:5000/swagger` lists every route. A warning at start that `GOOGLE_CALENDAR_SECRET_PATH` names no
file is normal on your machine: only Kalender's add, change and delete need that file.

On a Mac, port 5000 belongs to AirPlay. Set `PORT=5100` in `apps/api/.env`, and start the web app in step 4 with
`DEV_API_ORIGIN=http://127.0.0.1:5100 pnpm --filter web dev`. Give it on the command line, not in a file: a unit
test reads the web app's env files and expects the default port.

**4. Start the web app.** In a second terminal:

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter web dev             # http://localhost:5173
```

`apps/web/.env.example` says what each setting is for; a first run needs only `VITE_GOOGLE_CLIENT_ID`, which the copy
already has. Without it the sign-in page fails to load ("Bagian ini gagal dimuat"). With it, Google's button does
nothing, which is fine: use the test-login form on the same page. It appears because `apps/web/.env.development` sets
`VITE_ENABLE_TEST_LOGIN=true`. Sign in with `DEV_LOGIN_EMAIL` and the password you hashed. You land on the first-run
page, `/mulai`.

**5. Some data, and a member with roles.** Fill your database with a small made-up HMIF:

```bash
pnpm --filter api db:seed         # prints what it added; run it again later to move its events to this month
```

It adds four made-up members, two angkatan, categories, announcements with a comment and reactions, courses,
calendar events this month and next, a competition, a testimonial, the PIXEL form and a Curhat room. Everything in it
is invented (`apps/api/src/db/seed/sample-hmif.ts`). It refuses to run unless `APP_ENV` is `development`.
Never copy real members' data into your database.

The test login from step 4 is its own member, "Development Tester", with no roles and none of that data. To be one of
the seeded members instead, set `LOGIN_BYPASS_KEY` in `apps/api/.env` (its comment has the command), restart the API,
and open this address in the browser you use for the app, with your key:

```
http://localhost:5173/api/auth/login/bypass?token=<your key>&nim=13525901
```

It answers with the member's details and keeps you signed in; then open `http://localhost:5173/`. Pick the member by
student number (roles are in [CONTEXT.md](CONTEXT.md)):

| Student number | Who |
| --- | --- |
| `13525901` | Nadia, a plain anggota of angkatan 2025, with two courses, the open form and a Curhat room |
| `13524901` | Raka, a pengurus with `admin` and `akademik` |
| `18224902` | Sari, HMIF Welfare (`curhatadmin`): the Curhat inbox |
| `13524903` | Bima, a plain anggota of angkatan 2024 |

The route exists only on a development or staging API with a key of 32 characters or more; production never has it.

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
| `pnpm build` | Production build of the web app. The API has no build step: it runs its TypeScript directly. |
| `pnpm --filter api test:db` | API tests against a real database. Needs `TEST_DATABASE_URL`. |
| `pnpm --filter web exec playwright test -c e2e --project=phone-light masuk` | One journey file at one size and theme. |
| `pnpm --filter web exec playwright install chromium` | Once, to download the browser journeys use. |
| `pnpm --filter web api` | Regenerate the web app's API client after an API route changed. |
| `pnpm --filter api db:migrations` | Write a migration after `apps/api/src/db/schema.ts` changed. |
| `pnpm --filter api db:migrate` | Apply migrations to `DATABASE_URL`. |
| `pnpm --filter api db:seed` | Fill `DATABASE_URL` with the made-up sample data. Development only. |
| `pnpm --filter web e2e:real` | The journeys against the real API. Needs `E2E_REAL_DATABASE_URL` ([docs/testing.md](docs/testing.md)). |

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
email address, photo or message, a `.env` file, a key, or a path from your own computer. Use made-up people. A made-up
student number has a sequence of 900 or more (`13525901`, never `13525001`), and a made-up email uses that number at
`std.stei.itb.ac.id` or is an `example.com` address. `scripts/repo-privacy.test.mjs` refuses any other student
number, an email address that could be real, a path under someone's home folder, and a table of names beside numbers;
run it with `node --test scripts/repo-privacy.test.mjs`. CI runs it on every pull request.
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
