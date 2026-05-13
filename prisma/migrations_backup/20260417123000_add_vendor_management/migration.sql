-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DisFirmaTuru" AS ENUM ('TASERON', 'KIRALIK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DisFirma" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "tur" "DisFirmaTuru" NOT NULL,
    "sehir" TEXT NOT NULL DEFAULT 'BURSA',
    "vergiNo" TEXT,
    "yetkiliKisi" TEXT,
    "telefon" TEXT,

    CONSTRAINT "DisFirma_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "disFirmaId" TEXT;
ALTER TABLE "Personel" ADD COLUMN IF NOT EXISTS "disFirmaId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DisFirma_tur_idx" ON "DisFirma"("tur");
CREATE INDEX IF NOT EXISTS "DisFirma_ad_idx" ON "DisFirma"("ad");
CREATE INDEX IF NOT EXISTS "Arac_disFirmaId_idx" ON "Arac"("disFirmaId");
CREATE INDEX IF NOT EXISTS "Personel_disFirmaId_idx" ON "Personel"("disFirmaId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Arac"
        ADD CONSTRAINT "Arac_disFirmaId_fkey"
        FOREIGN KEY ("disFirmaId") REFERENCES "DisFirma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Personel"
        ADD CONSTRAINT "Personel_disFirmaId_fkey"
        FOREIGN KEY ("disFirmaId") REFERENCES "DisFirma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
