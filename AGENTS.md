# PIPS! monorepo

`apps/web` (web app) and `apps/api` (API) live here with their full history. The workspace notes in
`/home/pabs/coding/hmif-app/AGENTS.md` and `/home/pabs/AGENTS.md` apply: run installs, builds, type checks,
test suites and browser runs through `/home/pabs/.local/bin/host-heavy`, one at a time.

- This checkout (`/home/pabs/coding/hmif-app/pips`, branch `main`) is what https://staging.hmif.dev serves.
  Saved web changes reload at once; restart `hmif-backend` after API changes.
- The redesign is built on the `redesign` branch in separate worktrees; see `ops/redesign/PLAN.md`.
- Always tested: every change ships with tests, and nothing merges unless type check, lint, unit tests and
  the production build pass for every app it touches (`pnpm check`, `pnpm test`, `pnpm build`).
- Commit on your own branch; never push without the owner's go.
