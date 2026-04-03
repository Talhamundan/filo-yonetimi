ALTER TABLE "Bakim"
ADD COLUMN IF NOT EXISTS "arizaSikayet" TEXT,
ADD COLUMN IF NOT EXISTS "degisenParca" TEXT,
ADD COLUMN IF NOT EXISTS "islemYapanFirma" TEXT;

UPDATE "Bakim"
SET "islemYapanFirma" = "servisAdi"
WHERE ("islemYapanFirma" IS NULL OR trim("islemYapanFirma") = '')
  AND "servisAdi" IS NOT NULL
  AND trim("servisAdi") <> '';
