-- Angkatan 2025 is written Pixel. Renames only a 2025 row named exactly PIXEL (0032's spelling), so a name set by hand
-- stays. Safe to run twice.
UPDATE "angkatan" SET "name" = 'Pixel'
WHERE "year" = 2025
  AND "name" = 'PIXEL'
  AND NOT EXISTS (SELECT 1 FROM "angkatan" WHERE "name" = 'Pixel');
