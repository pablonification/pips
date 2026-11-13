-- A course's calendar is looked up by its major plus the year its students entered (getCalendarGroupByCourseId), and an
-- elective's by `ifelective` or `stielective`; a code with no row makes adding that course's event fail.
-- Adds only rows that are missing, and is safe to run twice.
UPDATE "calendar_group" SET "code" = 'stielective' WHERE "code" = 'stioptional';
--> statement-breakpoint
INSERT INTO "calendar_group" ("id", "name", "category", "code", "google_calendar_url")
SELECT "v"."id", "v"."name", 'akademik', "v"."code", "v"."url"
FROM (VALUES
  ('akademik-if2024', 'IF Mandatory 2024', 'if2024', 'c_f19e4b85228a0cfe336cdba922e174708fa09bc7f08b67f31ab4df83b9876dee@group.calendar.google.com'),
  ('akademik-if2025', 'IF Mandatory 2025', 'if2025', 'c_7bd006a04ae56f31ffd724c5fac16e08ed15f650a9f81724647b0d7aac2fedf6@group.calendar.google.com'),
  ('akademik-sti2024', 'STI Mandatory 2024', 'sti2024', 'c_218bd2f7629e769f98d2fd66968c3d98b652c87e9fc4d18ae81271c8ca4591b1@group.calendar.google.com'),
  ('akademik-sti2025', 'STI Mandatory 2025', 'sti2025', 'c_68a6d392af4305f88a76ca470820580b085fcc202b8da8bd6f4579f600996b79@group.calendar.google.com')
) AS "v" ("id", "name", "code", "url")
WHERE NOT EXISTS (SELECT 1 FROM "calendar_group" WHERE "calendar_group"."code" = "v"."code");
