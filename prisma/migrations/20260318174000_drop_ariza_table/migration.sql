DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Ariza'
    ) THEN
        INSERT INTO "Bakim" (
            "id",
            "bakimTarihi",
            "yapilanKm",
            "sonrakiBakimKm",
            "servisAdi",
            "yapilanIslemler",
            "tutar",
            "tur",
            "kategori",
            "aracId",
            "saseNo",
            "sirketId"
        )
        SELECT
            'ariza_' || a."id" AS "id",
            a."arizaTarihi" AS "bakimTarihi",
            COALESCE(ar."guncelKm", 0) AS "yapilanKm",
            NULL AS "sonrakiBakimKm",
            a."servis" AS "servisAdi",
            a."aciklama" AS "yapilanIslemler",
            COALESCE(a."tahminiTutar", 0) AS "tutar",
            'ARIZA'::"BakimTuru" AS "tur",
            'ARIZA'::"ServisKategori" AS "kategori",
            a."aracId",
            a."saseNo",
            COALESCE(a."sirketId", ar."sirketId") AS "sirketId"
        FROM "Ariza" a
        LEFT JOIN "Arac" ar ON ar."id" = a."aracId"
        ON CONFLICT ("id") DO NOTHING;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_vehicle_related_sase_no_from_arac()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "KullaniciZimmet" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "TrafikSigortasi" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "Kasko" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "Muayene" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "Bakim" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "Ceza" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "Masraf" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "Yakit" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "HgsYukleme" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "Dokuman" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TABLE IF EXISTS "Ariza";
DROP TYPE IF EXISTS "ArizaDurumu";
