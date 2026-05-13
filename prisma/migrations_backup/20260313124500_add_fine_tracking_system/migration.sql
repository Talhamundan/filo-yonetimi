ALTER TABLE "Ceza" ADD COLUMN "plaka" TEXT;
ALTER TABLE "Ceza" ADD COLUMN "cezaMaddesi" TEXT;

UPDATE "Ceza" AS c
SET "plaka" = a."plaka"
FROM "Arac" AS a
WHERE c."aracId" = a."id"
  AND c."plaka" IS NULL;

UPDATE "Ceza"
SET "cezaMaddesi" = COALESCE(NULLIF(TRIM("aciklama"), ''), 'Belirtilmedi')
WHERE "cezaMaddesi" IS NULL;

ALTER TABLE "Ceza" ALTER COLUMN "plaka" SET NOT NULL;
ALTER TABLE "Ceza" ALTER COLUMN "cezaMaddesi" SET NOT NULL;
ALTER TABLE "Ceza" ALTER COLUMN "cezaMaddesi" SET DEFAULT 'Belirtilmedi';

ALTER TABLE "Ceza"
ADD CONSTRAINT "Ceza_plaka_fkey"
FOREIGN KEY ("plaka") REFERENCES "Arac"("plaka")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "Ceza_plaka_idx" ON "Ceza"("plaka");
