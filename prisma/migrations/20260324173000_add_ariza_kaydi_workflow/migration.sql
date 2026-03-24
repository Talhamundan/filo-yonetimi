DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArizaKaydiDurumu') THEN
        CREATE TYPE "ArizaKaydiDurumu" AS ENUM ('ACIK', 'SERVISTE', 'TAMAMLANDI', 'IPTAL');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArizaOncelik') THEN
        CREATE TYPE "ArizaOncelik" AS ENUM ('DUSUK', 'ORTA', 'YUKSEK', 'KRITIK');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ArizaKaydi" (
    "id" TEXT NOT NULL,
    "aracId" TEXT NOT NULL,
    "sirketId" TEXT,
    "bakimId" TEXT,
    "aciklama" TEXT NOT NULL,
    "oncelik" "ArizaOncelik" NOT NULL DEFAULT 'ORTA',
    "durum" "ArizaKaydiDurumu" NOT NULL DEFAULT 'ACIK',
    "km" INTEGER,
    "servisAdi" TEXT,
    "yapilanIslemler" TEXT,
    "tutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bildirimTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviseSevkTarihi" TIMESTAMP(3),
    "kapanisTarihi" TIMESTAMP(3),
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArizaKaydi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArizaKaydi_bakimId_key" ON "ArizaKaydi"("bakimId");
CREATE INDEX IF NOT EXISTS "ArizaKaydi_aracId_idx" ON "ArizaKaydi"("aracId");
CREATE INDEX IF NOT EXISTS "ArizaKaydi_sirketId_idx" ON "ArizaKaydi"("sirketId");
CREATE INDEX IF NOT EXISTS "ArizaKaydi_durum_idx" ON "ArizaKaydi"("durum");
CREATE INDEX IF NOT EXISTS "ArizaKaydi_bildirimTarihi_idx" ON "ArizaKaydi"("bildirimTarihi");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'ArizaKaydi_aracId_fkey'
    ) THEN
        ALTER TABLE "ArizaKaydi"
            ADD CONSTRAINT "ArizaKaydi_aracId_fkey"
            FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'ArizaKaydi_bakimId_fkey'
    ) THEN
        ALTER TABLE "ArizaKaydi"
            ADD CONSTRAINT "ArizaKaydi_bakimId_fkey"
            FOREIGN KEY ("bakimId") REFERENCES "Bakim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
