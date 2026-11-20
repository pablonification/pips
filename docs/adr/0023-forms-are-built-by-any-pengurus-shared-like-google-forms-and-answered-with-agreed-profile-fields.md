# 23. Forms are built by any pengurus, shared like Google Forms, and answered with profile fields the member agrees to

Status: accepted.

## Context

Until now a form was a row an admin added by hand (the PIXEL form), read through Live Counting & Rekap Form. The
owner approved a form builder for every pengurus and a new member form (the locked forms prototype, `forms-v1`):
Google Forms' page and kinds of question, sharing with roles, a link of the form's own, an Excel export, and the
8ehradioitb flow where a form asks only its own questions and requests profile fields the member sees and agrees to
at the end. Two things had to stay true: today's PIXEL form and Magang SPARTA keep working for members, and a member
sees only what their angkatan and roles allow, decided by the server.

## Decision

- **One `forms` table, extended, not a second one.** New columns only (migration 0035): `owner_id` (null for forms
  made before the builder, which only admin manages), `published_at` (null for a draft), `requested_fields`,
  `allow_edit`, `thanks`, `slug_custom`, `updated_at`; `opens_at` may be null on a draft. A draft is also
  `is_active = false`, so an app from before the builder, which lists every active form, never shows one.
  `published_at` defaults to now, so a form added outside the builder (a seed, by hand) is published; the migration
  sets it to `created_at` for every existing form.
- **Questions stay JSON in `forms.sections`**, with the kinds' old names kept (`text`, `textarea`, `radio`,
  `checkbox`, `rating`) and four added (`dropdown`, `date`, `time`, `file`), plus "Lainnya", a scale's range and
  words, a hint, and "Tampilkan jika" (`dependsOn`, which the PIXEL form already used). The PIXEL form needs no
  change. Every rule lives once in `apps/api/src/lib/form-*.ts` with no database, so the routes, the tests and the
  web app's pretend API share it.
- **Access is a relation per form**: the owner; `form_collaborators` rows with `view` (Lihat jawaban) or `edit`;
  admin edits every form. Building is for pengurus (any role): every builder route sits behind `forRoles(…,
  rolesEnums)`, and the handler decides by the form (404 when the caller may not see it, 403 when they may only see
  it). Only pengurus can be added; nobody changes or removes the owner.
- **Profile fields are requested, not asked.** A member's saved details are one row in `member_details` (Profil ›
  Data diri); account facts come from `users`. Sending a form that requests fields needs `agreed: true`, and a saved
  detail never given can come in the same request and is saved first. The response keeps the values as sent
  (`form_responses.profile`), and that is all the Jawaban tab, the export and the live count ever show about who sent
  it. Gender is not requestable (owner's decision).
- **Breaking edits ask first.** On a form with answers, removing a question or changing its kind to one that can't
  read the old answers answers 409 until the maker confirms; then those answers are deleted from every response in
  one transaction.
- **The link is the short name in `forms.slug`**, unique. Renaming lets the old name go at once (the owner did not
  choose to keep old links); a draft's name follows its title until someone chooses one. `GET /form-link/{name}`
  answers the form, "not for you" with only the title and audience, or a draft only to those who manage it.
- **Answers for the maker** come from three routes: a summary, the responses one by one, and an export, Excel by
  default and CSV on request, written with `write-excel-file` on the server.
- **Libraries in the web app for the hard parts, all headless**: `react-hook-form` with `zod` for the member's form,
  Data diri and the builder's state; `@dnd-kit` for reordering by pointer and keyboard with announcements; Radix
  (already there) for menus, dialogs and switches. They bring behaviour, not looks: every pixel is still Garis, so
  decision 14 holds (it forbids component libraries that bring a look). The builder and the form are their own routes
  under the size cap (decision 12).

## What else was possible

- **A new table for builder forms beside `forms`:** no risk to the PIXEL form, but two of everything (lists, the
  member's page, Live Counting, MCP tools) and a move later.
- **Profile fields as ordinary questions, prefilled:** what the PIXEL form does with `prefill`. The member would type
  over facts the app already has, nothing would be kept for the next form, and the maker could not tell a requested
  field from a question.
- **Keeping old link names (a names table):** safer for links already sent, but more to explain, and the owner did
  not choose it.
- **For the export, `exceljs` or SheetJS:** `exceljs` is far larger and pulls in many packages; SheetJS's npm package
  is outdated and the current one is served only from its own site. `write-excel-file` writes only, which is all this
  needs, with one dependency (`fflate`) and regular releases.

## What it costs

- The JSON in `forms.sections` is checked by the API on every save (`definitionProblem`), not by the database.
- A form whose owner is removed from `users` keeps no owner; only admin, and the people it is shared with, can manage it then.
- Deleting answers on a confirmed breaking edit cannot be undone; the builder offers the export first.
- Old links break on a rename, by the owner's choice.
- Two ways to read answers exist for a while: Live Counting & Rekap Form for the PIXEL form, the Jawaban tab for the
  rest.

## When to revisit

When the PIXEL form moves to the builder (Live Counting's routes could then go), when members ask to keep old links,
or when a form needs grids or jumping to a section by answer (left out of the first build).
