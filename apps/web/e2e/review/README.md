# PIPS! redesign: the review package

This folder is the owner's review package for the go or no-go on the redesign. It shows everything the redesign does, as it really runs: a recording of every user flow, each locked prototype screen next to the app, today's app next to the redesign, the screens the prototype doesn't show, every check's result, every open question, and where each of SPEC's 157 stories can be seen.

It is private, like the rest of the workspace. Items tagged **security** on the open-questions page are holes still open in production: take them out before the package is shown to anyone but the owner.

## Opening it

Open `index.html` in Safari or Chrome, straight from the folder. It needs no server and no network: everything it loads is inside this folder.

- The videos and images are in `media/`, which isn't in Git. Download the release named on the page (`review-<date>.zip`, on the private `pablonification/pips-workspace`) and unzip it here as `media/`. Without it, each video and image says which file to download.
- Your notes (OK or not OK, and a short note per flow) stay in your browser. **Copy my notes** copies them as a Markdown list to send back.

## What's in it

| Path | What |
| --- | --- |
| `index.html` | Everything, by flow: the summary, the flows, prototype versus app, before and after, screens with no locked target, new copy, checks, open questions, story coverage, sizes |
| `assets/` | The page's own CSS and script |
| `data/` | `flows.json`, `fidelity.json`, `before-after.json`, `stills.json`, `checks.json`, `questions.json`, `coverage.json`, `sizes.json` |
| `media/` | Not in Git. `flows/<flow>/<layout>-<theme>.mp4` and posters, `fidelity/`, `before-after/`, `stills/`, and `traces/<finding>.zip` for each flow marked failing |

Sizes, and the budget they were kept within, are on the page's Sizes section and in `data/sizes.json`.

## How it was made

- Every recording, capture and check ran against a production build of the app at the commit the page names, served on the owner's Mac.
- Every request went to the harness's API mock (`apps/web/e2e/support/mock.ts`), answered from the locked prototype's sample people and posts (Nadia Putri, IF 2025 PIXEL; Raka Pratama, IF 2024 pengurus). No real member data, no secrets, no tokens. The mock's guard counted every request, and none left it.
- The clock is fixed at **Kamis, 8 Oktober 2026, 13.35 WIB**.
- The recordings keep the app's own motion. Each flow is also a test: every step asserts what it shows, and every screen passes the strict audit (axe, overflow, text size, `lang`).
- A flow that shows a known bug stays failing and is marked so (`F1-<n>`), with its trace in `media/traces/`.

The tooling is in `apps/web/e2e/`: the catalogue `review/flows.ts`, the flows `review/flows/*.flow.ts`, `review/coverage.ts`, `review/stills.ts`, `review/sweep.spec.ts`, `review/lab.spec.ts`, `review/package.spec.ts` and the command `scripts/review.mjs`.

## Rebuilding it

From `apps/web` in a worktree of `pips` with its dependencies installed, after any fix:

```bash
pnpm --filter web review
```

It builds the app once for the commit, then records, captures and checks everything, and writes this folder. Parts can run alone (`review record`, `fidelity`, `after`, `stills`, `checks`, `lab`, `questions`, `index`, and `pilot` to measure sizes first), and `review record --only <flow-id>` re-records one flow. An interrupted run picks up where it stopped (`REVIEW_FORCE=1` re-records). It stops before the disk falls under 1 GiB free. It needs `/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/cwebp`, and installs nothing.

The whole run takes hours on the shared Mac, mostly the journey suite (`checks`). Run it in the background.

## For Dev 1

1. Commit the small files (`index.html`, `README.md`, `.gitignore`, `assets/`, `data/`) in the workspace repository.
2. Check `df -h /` first. If `media/` plus 1 GiB doesn't fit, zip and upload one `media/` subfolder at a time, deleting each zip after its upload.
3. Upload `media/` as a release, without compression (the videos and images are already compressed):

   ```bash
   cd ops/redesign/review
   zip -0 -r "$TMPDIR/review-<date>.zip" media
   gh release create review-<date> "$TMPDIR/review-<date>.zip" --repo pablonification/pips-workspace \
     --title "Review package media, <date>" --notes "media/ for ops/redesign/review (F1)."
   rm "$TMPDIR/review-<date>.zip"
   ```

4. Fill the checks page's slots for Dev 1 (the staging smoke test, CI if `gh` couldn't read it).
5. After F2's fixes, rebuild the package with `pnpm --filter web review` before the owner reviews it.
