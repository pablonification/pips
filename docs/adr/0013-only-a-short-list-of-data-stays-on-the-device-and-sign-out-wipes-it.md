# 13. Only a short list of data stays on the device, and sign-out wipes all of it

Status: accepted.

## Context
Members open the app on trains and in lifts. Showing yesterday's agenda beats showing a blank page. But phones are
sometimes shared or lost, and some of what the app holds (Curhat messages, form answers) is private.

## Decision
- The query cache is saved in the browser's IndexedDB for at most seven days (`apps/web/src/api/persister.ts`).
- `apps/web/src/api/persistence-policy.ts` lists exactly what is saved: the member's profile, their semester, this
  semester's courses, calendar months near today, and the first page of announcements (with Beranda's unread
  list). Everything else, Curhat and forms included, is never written there. A test pins the list
  (`apps/web/tests/persistence-policy.test.ts`).
- The service worker stores the app's own files so it opens offline, and same-origin images. It does not store the
  API's answers (`apps/web/src/sw.ts`).
- Sign-out, a 401 from the session check, and a new sign-in each wipe everything of the member: the saved cache,
  what is in memory, the member's `localStorage` keys and the form drafts (`apps/web/src/lib/forget-member.ts`).
  Sign-out and a session that ended also remove content someone shared to PIPS! and had not posted yet. A new
  sign-in keeps it, so a person who shares to PIPS! while signed out finds it in Buat after signing in.
- A storage that is full, missing or never answers must not break the app: it carries on without the cache, after a
  3-second limit.

## What else was possible
- Save nothing: simplest and safest, but the app is empty offline.
- Save everything: fast offline, but private data would stay on a device after sign-out.
- Let the service worker cache the API's answers: less code, but no control over what stays.

## What it costs
- The list is short on purpose, so most pages have nothing to show offline.
- The member is stored twice: the old way in `localStorage` (`user`, `userAcademic`, `apps/web/src/lib/session.ts`)
  and the new way in the cache. `apps/web/src/routes/_app.tsx` copies one into the other.
- The wipe also takes unsent form drafts. A member whose session ends in the middle of a long form loses it.

## When to revisit
When a new screen has data worth keeping offline (add it to the list and its test deliberately), or when the
`localStorage` copy can finally be removed.
