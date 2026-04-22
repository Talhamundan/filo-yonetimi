ALTER TABLE "Sirket" ADD COLUMN IF NOT EXISTS "santiyeler" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Sirket"
SET "santiyeler" = ARRAY[COALESCE(NULLIF(TRIM("bulunduguIl"), ''), 'MERKEZ')]
WHERE "santiyeler" IS NULL OR COALESCE(array_length("santiyeler", 1), 0) = 0;

ALTER TABLE "Sirket" ALTER COLUMN "santiyeler" SET NOT NULL;
ALTER TABLE "Sirket" ALTER COLUMN "santiyeler" SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Personel" ADD COLUMN IF NOT EXISTS "santiye" TEXT;
