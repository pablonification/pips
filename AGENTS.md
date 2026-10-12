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

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
