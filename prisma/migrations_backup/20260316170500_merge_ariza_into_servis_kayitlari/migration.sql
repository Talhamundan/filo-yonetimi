DO $$
BEGIN
    CREATE TYPE "ServisKategori" AS ENUM ('PERIYODIK_BAKIM', 'ARIZA');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Bakim"
ADD COLUMN IF NOT EXISTS "kategori" "ServisKategori" NOT NULL DEFAULT 'PERIYODIK_BAKIM';

UPDATE "Bakim"
SET "kategori" = CASE
    WHEN "tur" = 'ARIZA' THEN 'ARIZA'::"ServisKategori"
    ELSE 'PERIYODIK_BAKIM'::"ServisKategori"
END
WHERE "kategori" IS DISTINCT FROM CASE
    WHEN "tur" = 'ARIZA' THEN 'ARIZA'::"ServisKategori"
    ELSE 'PERIYODIK_BAKIM'::"ServisKategori"
END;

INSERT INTO "Bakim" (
    "id",
    "bakimTarihi",
    "yapilanKm",
    "sonrakiBakimKm",
    "servisAdi",
    "yapilanIslemler",
    "tutar",
    "tur",
    "kategori",
    "aracId",
    "sirketId"
)
SELECT
    'ariza_' || a."id" AS "id",
    a."arizaTarihi" AS "bakimTarihi",
    COALESCE(ar."guncelKm", 0) AS "yapilanKm",
    NULL AS "sonrakiBakimKm",
    a."servis" AS "servisAdi",
    a."aciklama" AS "yapilanIslemler",
    COALESCE(a."tahminiTutar", 0) AS "tutar",
    'ARIZA'::"BakimTuru" AS "tur",
    'ARIZA'::"ServisKategori" AS "kategori",
    a."aracId",
    COALESCE(a."sirketId", ar."sirketId") AS "sirketId"
FROM "Ariza" a
LEFT JOIN "Arac" ar ON ar."id" = a."aracId"
ON CONFLICT ("id") DO NOTHING;
