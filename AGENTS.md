# PIPS!

PIPS! is the members app of HMIF ITB, the Informatics students' association at Institut Teknologi Bandung. It has a
web app that installs on a phone (`apps/web`, React and Vite) and an API (`apps/api`, Hono on PostgreSQL).
Members read announcements, see the calendar, use services and talk to HMIF Welfare. Words like angkatan, pengurus,
Garis and journey are explained in [CONTEXT.md](CONTEXT.md). Read it once.

## Never compromise

- **Curhat Yuk! stays anonymous to Welfare.** The API never sends who owns a room or sent a message
  (`apps/api/src/lib/curhat.ts`). A notification must carry no message text. Treat a privacy problem here as a
  security problem.
- **A member sees only what their angkatan and roles allow, and the server decides.** The web app only mirrors it
  (`apps/web/src/lib/capabilities.ts`). Every new route needs its own role or audience check in the API.
- **No real person's data in the repository.** Not in code, tests, fixtures, comments or commit messages. Use made-up
  names and numbers. A test in `scripts/` fails on a real-looking student number or email.
- **HMIF's logo is only the official file, whole**: `/logo/hmif.png`, shown through
  `apps/web/src/components/garis/HmifLogo.tsx`. Never redraw, crop, recolour or imitate it.
- **The look is Garis, written by hand.** No component or icon library; lint rules in
  `apps/web/eslint-rules/garis.mjs` refuse raw colours, odd text sizes and image icons. See `docs/design-system.md`.
- **Every sentence on screen is Indonesian, in the *kamu* voice, and lives in `apps/web/src/copy/`.**
  `apps/web/tests/copy.test.ts` checks it against `copy/glossary.ts`. Keep service names exactly: Ding Dong, Testi
  Matkul, NIM Finder, Info Lomba, Curhat Yuk!.

## The map

| Path | What |
| --- | --- |
| `apps/api/src/routes`, `controllers`, `repositories`, `lib` | A route describes an address; its controller handles it; a repository holds the queries; `lib` holds rules with no database. |
| `apps/api/src/db/schema.ts`, `apps/api/drizzle/` | Every table, and the migrations that build them. |
| `apps/api/src/websocket/` | The live connection for Curhat and Live Counting. |
| `apps/web/src/routes/` | One small file per address; it names a screen. |
| `apps/web/src/features/<name>/` | One folder per area members know. Copy `beranda` or `kalender`. |
| `apps/web/src/components/garis/`, `components/icons/`, `styles/garis/` | The design system. |
| `apps/web/src/components/shell/`, `lib/shell/routes.ts` | The frame around every page, and the table of pages. |
| `apps/web/src/lib/services.ts`, `lib/capabilities.ts` | The service list, and who may do what. |
| `apps/web/src/api/generated/` | The API client. Generated; never edit by hand. |
| `apps/web/tests/`, `apps/api/tests/`, `apps/web/e2e/` | Unit tests, API tests and browser journeys. See `docs/testing.md`. |
| `.github/workflows/check.yml`, `DEPLOY.md` | What CI runs, and how both apps are deployed. |

## Commands

Run them from the repository root, with Node 22 or later and `corepack enable`.

```bash
pnpm install
pnpm --filter api dev                    # the API; needs apps/api/.env (CONTRIBUTING.md, "First run")
pnpm --filter web dev                    # the web app on port 5173
pnpm check && pnpm test                  # type check, lint and unit tests, both apps. Run before every pull request.
pnpm build                               # production build of the web app (the API runs its TypeScript directly)
pnpm --filter api test:db                # real-database tests; needs TEST_DATABASE_URL (docs/testing.md)
pnpm --filter web exec playwright test -c e2e --project=phone-light masuk   # one journey file, one project
pnpm --filter web api                    # regenerate the API client after a route changed
pnpm --filter api db:migrations          # write a migration after a schema.ts change
```

## Ways to hurt yourself

- **Changed a route? Regenerate the client** (`pnpm --filter web api`) and commit `apps/web/src/api/generated/`. CI fails if you forget.
- **Migrations only add things.** Never drop or rename a column or table in one. Never run one against a database that is not yours.
- **Run the API as exactly one process.** Curhat rooms and reminders live in its memory (`docs/adr/0010-*`).
- **Journeys run on a fixed clock against a pretend API** (`apps/web/e2e/support/mock.ts`). Timers, sockets and real
  data need one real check by hand: sign in to a local API and try it.
- **Never run the whole journey suite on your machine.** It takes over an hour; CI runs it. Run the file you changed.
- **Screenshot references are per platform** (`*-darwin.png`, `*-linux.png`). CI records the Linux ones.
- **A role check lives in the API first**, then is mirrored in `capabilities.ts`. A route with no check is open to every member.
- **Copying `apps/api/.env.example` is a development setup.** Never put a real secret in a file Git tracks.

## Before you call it done

Check every surface your change can touch:

- phone, tablet and desktop; light and dark
- signed out, a plain anggota, and each role that matters
- slow, offline and failed requests (every list has loading, empty and error states)
- every new sentence is in `apps/web/src/copy/`; every server check has its mirror
- the docs this change makes wrong are fixed in the same pull request

## Rules for every change

- Write the test at the lowest layer that shows the behaviour. A bug fix gets a test that fails first.
- Extend a test before adding a new file. A journey is only for what needs a browser.
- A comment says a constraint or trap the code can't show. No history, no task labels, no dates.
- No new dependency or abstraction without a need you can name.
- Never skip, weaken or delete a test to get green.

## Pull requests

- Branch from the branch pull requests merge into (`redesign` today). Title it as a Conventional Commit in plain words that say why it matters to a member:
  `fix(api): refuse a push device that isn't a push service`. Pull requests are squash-merged.
- Fill in `.github/pull_request_template.md`.
- Tools are not authors: no `Co-authored-by` for an AI tool. If an AI tool wrote the body or the code, end the body
  with a true line, `Made with <model> in <harness>.`, naming what really ran. Never copy it from an example.

## Read next

[CONTEXT.md](CONTEXT.md) (words), [docs/README.md](docs/README.md) (index), [docs/adr/](docs/adr/README.md) (why),
[CONTRIBUTING.md](CONTRIBUTING.md) (first run), [DEPLOY.md](DEPLOY.md) (deployment).
