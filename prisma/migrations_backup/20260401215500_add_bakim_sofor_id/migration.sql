ALTER TABLE "Bakim"
ADD COLUMN IF NOT EXISTS "soforId" TEXT;

CREATE INDEX IF NOT EXISTS "Bakim_soforId_idx" ON "Bakim"("soforId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Bakim_soforId_fkey'
    ) THEN
        ALTER TABLE "Bakim"
        ADD CONSTRAINT "Bakim_soforId_fkey"
        FOREIGN KEY ("soforId") REFERENCES "Personel"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
