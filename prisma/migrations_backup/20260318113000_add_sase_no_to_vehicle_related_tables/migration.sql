ALTER TABLE "KullaniciZimmet" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "TrafikSigortasi" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "Kasko" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "Muayene" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "Ceza" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "Masraf" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "Yakit" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "HgsYukleme" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "Ariza" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;
ALTER TABLE "Dokuman" ADD COLUMN IF NOT EXISTS "saseNo" TEXT;

UPDATE "KullaniciZimmet" kz
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE kz."aracId" = a."id" AND kz."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "TrafikSigortasi" ts
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE ts."aracId" = a."id" AND ts."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "Kasko" k
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE k."aracId" = a."id" AND k."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "Muayene" m
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE m."aracId" = a."id" AND m."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "Bakim" b
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE b."aracId" = a."id" AND b."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "Ceza" c
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE c."aracId" = a."id" AND c."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "Masraf" m
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE m."aracId" = a."id" AND m."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "Yakit" y
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE y."aracId" = a."id" AND y."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "HgsYukleme" h
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE h."aracId" = a."id" AND h."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "Ariza" ar
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE ar."aracId" = a."id" AND ar."saseNo" IS DISTINCT FROM a."saseNo";

UPDATE "Dokuman" d
SET "saseNo" = a."saseNo"
FROM "Arac" a
WHERE d."aracId" = a."id" AND d."saseNo" IS DISTINCT FROM a."saseNo";

CREATE OR REPLACE FUNCTION set_vehicle_related_sase_no()
RETURNS TRIGGER AS $$
BEGIN
  SELECT a."saseNo"
  INTO NEW."saseNo"
  FROM "Arac" a
  WHERE a."id" = NEW."aracId";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_sase_no_kullanici_zimmet ON "KullaniciZimmet";
CREATE TRIGGER trg_set_sase_no_kullanici_zimmet
BEFORE INSERT OR UPDATE
ON "KullaniciZimmet"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_trafik_sigortasi ON "TrafikSigortasi";
CREATE TRIGGER trg_set_sase_no_trafik_sigortasi
BEFORE INSERT OR UPDATE
ON "TrafikSigortasi"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_kasko ON "Kasko";
CREATE TRIGGER trg_set_sase_no_kasko
BEFORE INSERT OR UPDATE
ON "Kasko"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_muayene ON "Muayene";
CREATE TRIGGER trg_set_sase_no_muayene
BEFORE INSERT OR UPDATE
ON "Muayene"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_bakim ON "Bakim";
CREATE TRIGGER trg_set_sase_no_bakim
BEFORE INSERT OR UPDATE
ON "Bakim"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_ceza ON "Ceza";
CREATE TRIGGER trg_set_sase_no_ceza
BEFORE INSERT OR UPDATE
ON "Ceza"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_masraf ON "Masraf";
CREATE TRIGGER trg_set_sase_no_masraf
BEFORE INSERT OR UPDATE
ON "Masraf"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_yakit ON "Yakit";
CREATE TRIGGER trg_set_sase_no_yakit
BEFORE INSERT OR UPDATE
ON "Yakit"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_hgs_yukleme ON "HgsYukleme";
CREATE TRIGGER trg_set_sase_no_hgs_yukleme
BEFORE INSERT OR UPDATE
ON "HgsYukleme"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_ariza ON "Ariza";
CREATE TRIGGER trg_set_sase_no_ariza
BEFORE INSERT OR UPDATE
ON "Ariza"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

DROP TRIGGER IF EXISTS trg_set_sase_no_dokuman ON "Dokuman";
CREATE TRIGGER trg_set_sase_no_dokuman
BEFORE INSERT OR UPDATE
ON "Dokuman"
FOR EACH ROW
EXECUTE FUNCTION set_vehicle_related_sase_no();

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
  UPDATE "Ariza" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  UPDATE "Dokuman" SET "saseNo" = NEW."saseNo" WHERE "aracId" = NEW."id";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_sase_no_from_arac ON "Arac";
CREATE TRIGGER trg_sync_sase_no_from_arac
AFTER UPDATE OF "saseNo"
ON "Arac"
FOR EACH ROW
WHEN (OLD."saseNo" IS DISTINCT FROM NEW."saseNo")
EXECUTE FUNCTION sync_vehicle_related_sase_no_from_arac();
