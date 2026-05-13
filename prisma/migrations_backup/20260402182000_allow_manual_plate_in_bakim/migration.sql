ALTER TABLE "Bakim"
ADD COLUMN IF NOT EXISTS "plaka" TEXT;

UPDATE "Bakim" b
SET "plaka" = a."plaka"
FROM "Arac" a
WHERE b."aracId" = a."id"
  AND (b."plaka" IS NULL OR trim(b."plaka") = '')
  AND a."plaka" IS NOT NULL
  AND trim(a."plaka") <> '';

ALTER TABLE "Bakim"
ALTER COLUMN "aracId" DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Bakim_aracId_fkey'
    ) THEN
        ALTER TABLE "Bakim"
        DROP CONSTRAINT "Bakim_aracId_fkey";
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Bakim_aracId_fkey'
    ) THEN
        ALTER TABLE "Bakim"
        ADD CONSTRAINT "Bakim_aracId_fkey"
        FOREIGN KEY ("aracId") REFERENCES "Arac"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Bakim_plaka_idx" ON "Bakim"("plaka");
