# 24. s.hmif.dev short links live in PIPS!, and share one set of names with forms

Status: accepted. Replaces how decision 23 names a form's link.

## Context

HMIF's link shortener, s.hmif.dev, ran on its own (Lynx, on MongoDB): 2,449 links, 392 accounts with bcrypt
passwords, about 714,000 clicks. The owner approved moving it into PIPS! as **Tautan pendek** (the prototype
`shortlink-v1`, 2026-11-24), with these rules: every existing link keeps working, unchanged; any member may make
links; old accounts are matched to members by email or a NIM in them, or claimed with the old password until about
three months after the switch; admin sees and manages every link and the owner is told by push; a renamed link keeps
its old names; a deleted name is never given out again; one rule for new names (letters, numbers and hyphens, 3 to 50,
compared without capitals); and a published form's link moves to `s.hmif.dev/<name>`, so forms and short links share
one set of names.

The old data breaks the new rule: 255 names have characters the rule refuses, a few are too short or too long, and
four pairs differ only in capitals. They must keep working exactly as they are.

## Decision

- **Four tables** (migration 0037, `apps/api/src/db/schema.ts`):
  - `short_links`: the destination (null for a form's link), `form_id` (unique), `owner_id` (null while nobody in
    PIPS! holds it; a form's link takes its form's owner), `previous_owner_id` (so the push after an admin's move opens
    a page that says so), `account_id` (the old account), the import's keys (`lynx_id`, `lynx_visits`,
    `lynx_modified_at`), `clicks`, the dates and `deleted_at`. Deleting only sets `deleted_at`.
  - `short_link_names`: every name s.hmif.dev answers or answered, one row each: `name` (the primary key, exact),
    `folded` (generated, `lower(name)`), the link, `is_current` (one per link, a partial unique index) and
    `holds_fold`. **Exactly one row of each folded form holds it**, and a partial unique index over `folded` where
    `holds_fold` refuses a second, so two members typing `Makrab` and `makrab` at once can't both get it. The old
    twins keep their extra rows with `holds_fold` false: they still open by their exact names. Older names and the
    names of deleted links stay rows, so they stay reserved.
  - `short_link_accounts`: the old account's Lynx id, username, email, the NIM found in them, the bcrypt hash (deleted
    when claiming ends), the two-factor flag (its secret is never imported), and who claimed it, when and how
    (`email`, `nim`, `password`, `admin`).
  - `short_link_claim_locks`: wrong claim passwords per old account and per member.
- **One SQL function sets a name**: `short_link_set_name(link, name, keep_old)`. It keeps the old name as an older one
  (or drops it, for a draft form), lets a link go back to one of its own names in any capitals, and leaves the
  uniqueness to the indexes (a clash is error 23505, which the API answers as `taken`). The API calls it for short
  links; **triggers on `forms` call it for forms**, so `forms.slug` and the names can't drift whoever writes the form
  (the API, the seed, a hand-written insert). A published form keeps its old names; a draft's name follows its title
  and is let go; a deleted published form's names stay reserved. `GET /form-link/{name}` and the redirect read the
  names, so `app.hmif.dev/f/<old name>` keeps working too.
- **The redirect is the API, on its own host.** A request whose `Host` is `SHORTLINK_HOST` (`s.hmif.dev`) is answered
  by one middleware before anything else, and no route is reachable there (`controllers/short-link-redirect.ts`). One
  indexed lookup takes the raw target (path and query, as the old service matched it), its percent-decoded form, and
  the path alone; an exact name wins, then the one link that matches without capitals (`lib/short-link.ts`,
  `pickRedirect`). A link answers 302 to its destination (only `http(s)`), a form's link to `/f/<current name>` in the
  web app, `/` and `/dash…` to the member's list, anything else to the web app's not-found page; always
  `Cache-Control: no-store`. Clicks are counted in memory and written together every five seconds (decision 10's one
  process), so the answer never waits for a write.
- **Matching and claiming.** At every sign-in (and at the import) an unclaimed old account is attached by the
  member's student email, then by their NIM found in the old email or username; no notice. Claiming is two steps: the
  username or email and password say which links would move and return a 10-minute token, and the token moves them,
  so the password is sent once. One bcrypt comparison always runs (a stand-in hash when no account matches), five
  wrong passwords lock the member and the account for 15 minutes, a two-factor account needs an admin, and after
  `SHORTLINK_CLAIM_UNTIL` the claim answers 410 and the import's `--forget-passwords` deletes the hashes.
- **Admin's changes tell the holder** by web push (`lib/short-link.ts`, `ownerPush`), with no setting to turn it off
  and nothing else when push is off.
- **The import** (`apps/api/scripts/short-links-import.ts`) reads `mongoexport` JSON, writes everything in one
  transaction keyed by Lynx ids, and can run again: new links are added, a link changed on the old service is updated
  only if PIPS! hasn't changed it, clicks add only what grew, and a claim is never undone.

## What else was possible

- **Keep Lynx and point it at PIPS!'s members:** two services, two databases and two sign-ins to keep running, and
  forms couldn't share its names.
- **A unique index on `lower(name)`:** the simplest race-safe rule, but the four old twin pairs would have had to be
  renamed or dropped, breaking printed links.
- **Names as a column on `short_links` with an array of older names:** no join, but uniqueness across links and forms
  could only be checked, not enforced, and a rename race could hand one name to two links.
- **Keep `forms.slug` as the source and copy it in the API:** no triggers, but every writer of `forms` (the seed,
  tests, a migration, a later feature) would have to remember to update the names too.
- **A separate redirect service or Traefik rule per link:** fast, but a second thing to deploy for 2,500 rows.

## What it costs

- Logic lives in PL/pgSQL (one function, three triggers), which only database tests reach; `tests/db/short-links.test.ts`
  covers it.
- A deleted form's names stay reserved, so a database test that deletes and re-inserts a published form must delete its
  link first.
- Lookups without capitals fall back only when one link matches: an old twin opens only by its exact name.
- A crash loses up to five seconds of click counts.
- Old names no browser can send (with `#`, a space at either end, `\`, `.` or `..` segments) can't open; the import's
  dry run lists them.
- Admin's pushes have no off switch; a member with push off learns of the change only by opening Tautan pendek.

## When to revisit

When claiming ends (delete the hashes; the claim routes could go), if the API ever runs as more than one process (the
click counter and the locks assume one), or if members ask to release an older name.
