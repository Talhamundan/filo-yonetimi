DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Personel'
          AND column_name = 'sehir'
    ) THEN
        ALTER TABLE "Personel" RENAME COLUMN "sehir" TO "calistigiKurum";
    END IF;
END
$$;

ALTER TABLE "Personel"
ALTER COLUMN "calistigiKurum" TYPE TEXT
USING "calistigiKurum"::TEXT;
