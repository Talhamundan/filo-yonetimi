ALTER TABLE "ArizaKaydi"
ADD COLUMN IF NOT EXISTS "kullaniciId" TEXT;

CREATE INDEX IF NOT EXISTS "ArizaKaydi_kullaniciId_idx" ON "ArizaKaydi"("kullaniciId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'ArizaKaydi'
          AND constraint_name = 'ArizaKaydi_kullaniciId_fkey'
    ) THEN
        ALTER TABLE "ArizaKaydi"
        ADD CONSTRAINT "ArizaKaydi_kullaniciId_fkey"
        FOREIGN KEY ("kullaniciId") REFERENCES "Personel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
