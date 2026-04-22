-- CreateEnum
CREATE TYPE "AracAltKategori" AS ENUM ('OTOMOBIL', 'MINIBUS', 'KAMYONET', 'KAMYON', 'CEKICI', 'ROMORK', 'TRAKTOR');

-- AlterTable
ALTER TABLE "Arac" ADD COLUMN "altKategori" "AracAltKategori";

-- Backfill
UPDATE "Arac"
SET "altKategori" = CASE
    WHEN "kategori" = 'SANTIYE' THEN 'KAMYONET'::"AracAltKategori"
    ELSE 'OTOMOBIL'::"AracAltKategori"
END
WHERE "altKategori" IS NULL;

ALTER TABLE "Arac" ALTER COLUMN "altKategori" SET NOT NULL;
ALTER TABLE "Arac" ALTER COLUMN "altKategori" SET DEFAULT 'OTOMOBIL';
