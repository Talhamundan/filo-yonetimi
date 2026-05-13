-- Yakit tanklarini sirket bazinda ayristirmak icin sirket bagi
ALTER TABLE "YakitTank"
ADD COLUMN IF NOT EXISTS "sirketId" TEXT;

CREATE INDEX IF NOT EXISTS "YakitTank_sirketId_idx" ON "YakitTank"("sirketId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'YakitTank_sirketId_fkey'
    ) THEN
        ALTER TABLE "YakitTank"
        ADD CONSTRAINT "YakitTank_sirketId_fkey"
        FOREIGN KEY ("sirketId") REFERENCES "Sirket"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
