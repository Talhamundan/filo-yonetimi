-- Rol enumunu sadeleştir: ADMIN / YETKILI / SOFOR
-- Eski roller (YONETICI, MUDUR, MUHASEBECI) YETKILI'ye dönüştürülür.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Rol') THEN
        IF EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'Rol' AND e.enumlabel = 'YETKILI'
        ) THEN
            -- Zaten yeni enum setine geçmiş.
            RETURN;
        END IF;

        ALTER TYPE "Rol" RENAME TO "Rol_old";

        CREATE TYPE "Rol" AS ENUM ('ADMIN', 'YETKILI', 'SOFOR');

        ALTER TABLE "Kullanici"
            ALTER COLUMN "rol" DROP DEFAULT,
            ALTER COLUMN "rol" TYPE "Rol"
            USING (
                CASE
                    WHEN "rol"::text IN ('YONETICI', 'MUDUR', 'MUHASEBECI') THEN 'YETKILI'
                    ELSE "rol"::text
                END
            )::"Rol",
            ALTER COLUMN "rol" SET DEFAULT 'SOFOR';

        DROP TYPE "Rol_old";
    END IF;
END $$;
