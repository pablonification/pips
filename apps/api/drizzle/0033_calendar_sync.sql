ALTER TABLE "calendar_event" ADD COLUMN "synced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "calendar_group" ADD COLUMN "synced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- PRISMA's general calendar (PRISMA - DE HMIF ITB): the finished events for every member. Kalender copies it; the
-- service account only needs "See all event details" on it. Adds the row once.
INSERT INTO "calendar_group" ("id", "name", "category", "code", "google_calendar_url", "synced")
SELECT 'himpunan-prisma-de', 'PRISMA - DE HMIF ITB', 'himpunan', 'prisma-de',
  'c_0243cc5403803957f8a8146619ebed1f172d81917dc73a9b2773c7b08d352478@group.calendar.google.com', true
WHERE NOT EXISTS (SELECT 1 FROM "calendar_group" WHERE "code" = 'prisma-de');
