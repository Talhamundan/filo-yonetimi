-- Imported rows without a model year were previously assigned the current year.
-- Use 0 as the internal "unknown" sentinel; the UI/export layer renders it as "-".
UPDATE "Arac"
SET "yil" = 0
WHERE "yil" = 2026;
