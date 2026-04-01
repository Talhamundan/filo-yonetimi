DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AracKategori') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AracKategori_new') THEN
      CREATE TYPE "AracKategori_new" AS ENUM ('BINEK', 'SANTIYE');
    END IF;

    ALTER TABLE "Arac" ALTER COLUMN "kategori" DROP DEFAULT;

    ALTER TABLE "Arac"
      ALTER COLUMN "kategori" TYPE "AracKategori_new"
      USING (
        CASE
          WHEN "kategori"::text = 'BINEK' THEN 'BINEK'::"AracKategori_new"
          ELSE 'SANTIYE'::"AracKategori_new"
        END
      );

    DROP TYPE "AracKategori";
    ALTER TYPE "AracKategori_new" RENAME TO "AracKategori";
    ALTER TABLE "Arac" ALTER COLUMN "kategori" SET DEFAULT 'BINEK';
  END IF;
END $$;
