# Docs

Docs here keep what the code cannot explain: decisions, constraints and traps. Most changes need no doc update. A
change that makes a doc wrong fixes that doc in the same pull request.

## Working on PIPS!

| Read | When |
| --- | --- |
| [CONTEXT.md](../CONTEXT.md) | A word confuses you: angkatan, pengurus, Garis, journey, gate. |
| [architecture.md](architecture.md) | You need to find where something lives, or how a request travels from the phone to the database and back. |
| [testing.md](testing.md) | You are about to write or run a test, or a check failed in CI. |
| [design-system.md](design-system.md) | You are building or changing a screen. |
| [adr/](adr/README.md) | You wonder why something is the way it is, or want to change a big choice. |

First time here: [CONTRIBUTING.md](../CONTRIBUTING.md) gets you from `git clone` to a running app and a first change.
Coding agents start at [AGENTS.md](../AGENTS.md).

## Recipes

Step-by-step guides for the common changes. They are not written yet:

- Add a screen
- Add an API route
- Add a migration
- Add a service to Layanan

Until then, copy a neighbour: `apps/web/src/features/beranda/` for a screen, and the route files named in
[architecture.md](architecture.md) for an API route.

## Running it

[DEPLOY.md](../DEPLOY.md) says how both apps are built and deployed, with every setting.
