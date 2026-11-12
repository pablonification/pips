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

Step-by-step guides for the common changes. Each was written by doing the job once on a small made-up example, so
the paths, commands and error messages in them are real.

- [Add a screen](recipes/add-a-screen.md)
- [Add an API route](recipes/add-an-api-route.md)
- [Add a migration](recipes/add-a-migration.md)
- [Add a service to Layanan](recipes/add-a-service-to-layanan.md)

## Running it

[DEPLOY.md](../DEPLOY.md) says how both apps are built and deployed, with every setting.
