CREATE TABLE IF NOT EXISTS "KullaniciYetkiliSirket" (
    "id" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "sirketId" TEXT NOT NULL,
    "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KullaniciYetkiliSirket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KullaniciYetkiliSirket_kullaniciId_sirketId_key" ON "KullaniciYetkiliSirket"("kullaniciId", "sirketId");
CREATE INDEX IF NOT EXISTS "KullaniciYetkiliSirket_kullaniciId_idx" ON "KullaniciYetkiliSirket"("kullaniciId");
CREATE INDEX IF NOT EXISTS "KullaniciYetkiliSirket_sirketId_idx" ON "KullaniciYetkiliSirket"("sirketId");

DO $$ BEGIN
    ALTER TABLE "KullaniciYetkiliSirket" ADD CONSTRAINT "KullaniciYetkiliSirket_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Personel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "KullaniciYetkiliSirket" ADD CONSTRAINT "KullaniciYetkiliSirket_sirketId_fkey" FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
