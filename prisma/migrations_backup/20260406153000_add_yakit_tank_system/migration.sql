DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'YakitTankHareketTip'
    ) THEN
        CREATE TYPE "YakitTankHareketTip" AS ENUM ('ALIM', 'CIKIS', 'TRANSFER');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "YakitTank" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kapasiteLitre" DOUBLE PRECISION NOT NULL,
    "mevcutLitre" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "birimMaliyet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aktifMi" BOOLEAN NOT NULL DEFAULT true,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YakitTank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "YakitTankHareket" (
    "id" TEXT NOT NULL,
    "tip" "YakitTankHareketTip" NOT NULL,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "litre" DOUBLE PRECISION NOT NULL,
    "birimMaliyet" DOUBLE PRECISION NOT NULL,
    "toplamTutar" DOUBLE PRECISION NOT NULL,
    "tankId" TEXT NOT NULL,
    "hedefTankId" TEXT,
    "aracId" TEXT,
    "soforId" TEXT,
    "yakitId" TEXT,
    "istasyon" TEXT,
    "km" INTEGER,
    "aciklama" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YakitTankHareket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "YakitTankHareket_yakitId_key" ON "YakitTankHareket"("yakitId");
CREATE INDEX IF NOT EXISTS "YakitTank_aktifMi_idx" ON "YakitTank"("aktifMi");
CREATE INDEX IF NOT EXISTS "YakitTankHareket_tip_idx" ON "YakitTankHareket"("tip");
CREATE INDEX IF NOT EXISTS "YakitTankHareket_tarih_idx" ON "YakitTankHareket"("tarih");
CREATE INDEX IF NOT EXISTS "YakitTankHareket_tankId_idx" ON "YakitTankHareket"("tankId");
CREATE INDEX IF NOT EXISTS "YakitTankHareket_hedefTankId_idx" ON "YakitTankHareket"("hedefTankId");
CREATE INDEX IF NOT EXISTS "YakitTankHareket_aracId_idx" ON "YakitTankHareket"("aracId");
CREATE INDEX IF NOT EXISTS "YakitTankHareket_soforId_idx" ON "YakitTankHareket"("soforId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'YakitTankHareket_tankId_fkey'
    ) THEN
        ALTER TABLE "YakitTankHareket"
        ADD CONSTRAINT "YakitTankHareket_tankId_fkey"
        FOREIGN KEY ("tankId") REFERENCES "YakitTank"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'YakitTankHareket_hedefTankId_fkey'
    ) THEN
        ALTER TABLE "YakitTankHareket"
        ADD CONSTRAINT "YakitTankHareket_hedefTankId_fkey"
        FOREIGN KEY ("hedefTankId") REFERENCES "YakitTank"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'YakitTankHareket_aracId_fkey'
    ) THEN
        ALTER TABLE "YakitTankHareket"
        ADD CONSTRAINT "YakitTankHareket_aracId_fkey"
        FOREIGN KEY ("aracId") REFERENCES "Arac"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'YakitTankHareket_soforId_fkey'
    ) THEN
        ALTER TABLE "YakitTankHareket"
        ADD CONSTRAINT "YakitTankHareket_soforId_fkey"
        FOREIGN KEY ("soforId") REFERENCES "Personel"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'YakitTankHareket_yakitId_fkey'
    ) THEN
        ALTER TABLE "YakitTankHareket"
        ADD CONSTRAINT "YakitTankHareket_yakitId_fkey"
        FOREIGN KEY ("yakitId") REFERENCES "Yakit"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
