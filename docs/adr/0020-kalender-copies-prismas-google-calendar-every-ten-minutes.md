# 20. Kalender copies PRISMA's Google calendar into its own table every ten minutes

Status: accepted.

## Context

HMIF's cabinet (PRISMA) runs its agenda in Google Calendar: tentative events in each ring's and division's own
calendar, and finished events for every member in one general calendar, "PRISMA - DE HMIF ITB". PRISMA's people
add and change events there, in Google's own app, not in PIPS!. Kalender only showed events added inside PIPS!, so it
stayed empty while the real agenda lived elsewhere.

Everything that shows an event reads the `calendar_event` table: Kalender's month, Beranda's agenda, global search and
the day-before reminders.

## Decision

- A `calendar_group` row with `synced = true` names a Google calendar that Kalender copies. Migration 0033 adds one:
  PRISMA - DE HMIF ITB, as a Himpunan calendar, so its events reach every member. The ring and division calendars are
  not copied (they hold drafts).
- Every ten minutes, and once when the API starts (production only, `apps/api/src/cron/calendar-sync.ts`), the API
  reads that calendar's events from a month ago to a year ahead with the service account's key, and makes the copy
  match: new events added, changed ones updated, ones Google no longer lists removed, all in one transaction per
  calendar. The rules (what a Google event becomes, what changes) are in `apps/api/src/lib/calendar-sync.ts`.
- A copied row has `synced = true`. The API refuses to change or delete it (409) and the web app shows no options for
  it: it is changed in Google Calendar. The app never adds to a synced calendar.
- A copy keeps the title, a plain-text description (Google's HTML turned into lines), the place, and the times; an
  all-day event runs from midnight WIB to midnight after its last day (`all_day`).
- If Google refuses (the calendar isn't shared with the service account) or the key file is missing, the run logs one
  line until that changes and leaves the copy as it was.

## What else was possible

- **Read Google on every Kalender request.** Always current, but every page view would wait on Google, Beranda's
  agenda, search and the reminders would each need their own path, and Google's quota would scale with members.
- **Google's push notifications (watch channels).** Changes arrive in seconds, but they need a public webhook, channel
  renewal and a full read as a fallback anyway.
- **Ask PRISMA to add events in PIPS! instead.** Their process, written for every division, is Google Calendar.

## What it costs

- A change in Google reaches Kalender up to ten minutes later.
- The service account must be shared on the calendar ("See all event details"), and its key file mounted on the API
  (`DEPLOY.md`); without either, Kalender silently shows only the app's own events.
- Copied events get the day-before reminder like every Himpunan event, sent to every member with notifications on.
- An event moved more than a year ahead, or more than a month back, keeps its old copy until it comes back into the
  window.

## Look again when

PRISMA wants ring or division calendars shown to their own members (a `calendar_group` with a role audience), or the
ten-minute delay matters.
