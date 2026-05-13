-- Ceza modelindeki plaka tabanli iliskiyi kaldirip aracId tabanli iliskiyi tek kaynak haline getir.

ALTER TABLE "Ceza" DROP CONSTRAINT IF EXISTS "Ceza_plaka_fkey";

-- Snapshot/plaka alanini opsiyonel hale getir.
ALTER TABLE "Ceza" ALTER COLUMN "plaka" DROP NOT NULL;

-- Eksik plaka verilerini arac tablosundan doldur (geriye donuk tutarlilik).
UPDATE "Ceza" c
SET "plaka" = a."plaka"
FROM "Arac" a
WHERE c."aracId" = a."id"
  AND c."plaka" IS NULL;
