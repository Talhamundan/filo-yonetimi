DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Kullanici'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Personel'
  ) THEN
    ALTER TABLE "Kullanici" RENAME TO "Personel";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'KullaniciZimmet'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PersonelZimmet'
  ) THEN
    ALTER TABLE "KullaniciZimmet" RENAME TO "PersonelZimmet";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Hesap" (
  "id" TEXT NOT NULL,
  "personelId" TEXT NOT NULL,
  "kullaniciAdi" TEXT NOT NULL,
  "sifreHash" TEXT NOT NULL,
  "aktifMi" BOOLEAN NOT NULL DEFAULT true,
  "sonGirisTarihi" TIMESTAMP(3),
  "olusturmaTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "guncellemeTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Hesap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Hesap_personelId_key" ON "Hesap"("personelId");
CREATE UNIQUE INDEX IF NOT EXISTS "Hesap_kullaniciAdi_key" ON "Hesap"("kullaniciAdi");
CREATE INDEX IF NOT EXISTS "Hesap_aktifMi_idx" ON "Hesap"("aktifMi");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'Hesap'
      AND constraint_name = 'Hesap_personelId_fkey'
  ) THEN
    ALTER TABLE "Hesap"
    ADD CONSTRAINT "Hesap_personelId_fkey"
    FOREIGN KEY ("personelId") REFERENCES "Personel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Hesap" (
  "id",
  "personelId",
  "kullaniciAdi",
  "sifreHash",
  "aktifMi",
  "olusturmaTarihi",
  "guncellemeTarihi"
)
SELECT
  CONCAT('hesap_', p."id"),
  p."id",
  LOWER(TRIM(p."eposta")),
  p."sifre",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Personel" p
WHERE p."eposta" IS NOT NULL
  AND p."sifre" IS NOT NULL
  AND TRIM(p."eposta") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "Hesap" h WHERE h."personelId" = p."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Hesap" h WHERE h."kullaniciAdi" = LOWER(TRIM(p."eposta"))
  );
