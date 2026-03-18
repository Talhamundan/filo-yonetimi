ALTER TABLE "Yakit"
ADD COLUMN IF NOT EXISTS "soforId" TEXT;

CREATE INDEX IF NOT EXISTS "Yakit_soforId_idx" ON "Yakit"("soforId");

ALTER TABLE "Yakit"
DROP CONSTRAINT IF EXISTS "Yakit_soforId_fkey";

ALTER TABLE "Yakit"
ADD CONSTRAINT "Yakit_soforId_fkey"
FOREIGN KEY ("soforId") REFERENCES "Kullanici"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH matched AS (
    SELECT
        y."id" AS "yakitId",
        z."kullaniciId"
    FROM "Yakit" y
    JOIN LATERAL (
        SELECT kz."kullaniciId"
        FROM "KullaniciZimmet" kz
        WHERE kz."aracId" = y."aracId"
          AND kz."baslangic" <= y."tarih"
          AND (kz."bitis" IS NULL OR kz."bitis" >= y."tarih")
        ORDER BY kz."baslangic" DESC
        LIMIT 1
    ) z ON true
    WHERE y."soforId" IS NULL
)
UPDATE "Yakit" y
SET "soforId" = m."kullaniciId"
FROM matched m
WHERE y."id" = m."yakitId";

UPDATE "Yakit" y
SET "soforId" = a."kullaniciId"
FROM "Arac" a
WHERE y."soforId" IS NULL
  AND a."id" = y."aracId"
  AND a."kullaniciId" IS NOT NULL;
