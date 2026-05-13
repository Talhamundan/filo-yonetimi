CREATE TABLE IF NOT EXISTS "StokKalem" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kategori" TEXT,
    "miktar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "birim" TEXT NOT NULL DEFAULT 'ADET',
    "konum" TEXT,
    "kritikSeviye" DOUBLE PRECISION,
    "aciklama" TEXT,
    "sirketId" TEXT,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guncellemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StokKalem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StokKalem_sirketId_idx" ON "StokKalem"("sirketId");
CREATE INDEX IF NOT EXISTS "StokKalem_ad_idx" ON "StokKalem"("ad");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'StokKalem_sirketId_fkey'
          AND table_name = 'StokKalem'
    ) THEN
        ALTER TABLE "StokKalem"
        ADD CONSTRAINT "StokKalem_sirketId_fkey"
        FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
