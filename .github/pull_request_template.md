## Outcome

What can a member (or a maintainer) do or see now that they could not before? One or two sentences.

## Why

The problem this solves, in plain words. Link the issue if there is one.

## Before and after

For a screen: a picture of each, at phone width and in light and dark if it differs. For an API or logic change:
what the old behaviour was and what it is now.

## Verification

What you ran and what you saw, for example `pnpm check && pnpm test`, the journey files you ran, and what you tried
by hand against a local API. For a bug fix, the test that failed before the fix.

## Risk

What could this break, and who would notice? Say "none that I can see" only if you looked.

## Made with

If an AI tool wrote any of this description or the code, say which, truthfully: `Made with <model> in <harness>.`
Leave this section out otherwise.

## Checklist

- [ ] Nothing personal in the diff: no real name, student number, email, photo, `.env` or key
- [ ] Every new sentence on screen is in `apps/web/src/copy/`
- [ ] If an API route changed, I ran `pnpm --filter web api` and committed `apps/web/src/api/generated/`
- [ ] Docs this change makes wrong are fixed
