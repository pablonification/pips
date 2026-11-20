-- Angkatan 2025 is called PIXEL: the member card, the composer's audience and announcements show this name.
-- Names the 2025 row PIXEL, or adds the row if it is missing. Leaves everything alone if another year already holds
-- the name (names are unique). Safe to run twice.
UPDATE "angkatan" SET "name" = 'PIXEL'
WHERE "year" = 2025
  AND "name" <> 'PIXEL'
  AND NOT EXISTS (SELECT 1 FROM "angkatan" WHERE "name" = 'PIXEL');
--> statement-breakpoint
INSERT INTO "angkatan" ("id", "year", "name")
SELECT 'angkatan-2025', 2025, 'PIXEL'
WHERE NOT EXISTS (SELECT 1 FROM "angkatan" WHERE "year" = 2025)
  AND NOT EXISTS (SELECT 1 FROM "angkatan" WHERE "name" = 'PIXEL');
