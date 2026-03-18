DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActivityActionType') THEN
        CREATE TYPE "ActivityActionType" AS ENUM (
            'CREATE',
            'UPDATE',
            'DELETE',
            'RESTORE',
            'ARCHIVE',
            'LOGIN_SUCCESS',
            'LOGIN_FAILURE',
            'ROLE_CHANGE',
            'STATUS_CHANGE'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActivityEntityType') THEN
        CREATE TYPE "ActivityEntityType" AS ENUM (
            'ARAC',
            'MASRAF',
            'BAKIM',
            'DOKUMAN',
            'CEZA',
            'KULLANICI',
            'OTURUM',
            'DIGER'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL,
    "actionType" "ActivityActionType" NOT NULL,
    "entityType" "ActivityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Arac" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Ceza" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Ceza" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Masraf" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Masraf" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

ALTER TABLE "Dokuman" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Dokuman" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

CREATE INDEX IF NOT EXISTS "ActivityLog_actionType_idx" ON "ActivityLog"("actionType");
CREATE INDEX IF NOT EXISTS "ActivityLog_entityType_idx" ON "ActivityLog"("entityType");
CREATE INDEX IF NOT EXISTS "ActivityLog_entityId_idx" ON "ActivityLog"("entityId");
CREATE INDEX IF NOT EXISTS "ActivityLog_companyId_idx" ON "ActivityLog"("companyId");
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

CREATE INDEX IF NOT EXISTS "Arac_deletedAt_idx" ON "Arac"("deletedAt");
CREATE INDEX IF NOT EXISTS "Kullanici_deletedAt_idx" ON "Kullanici"("deletedAt");
CREATE INDEX IF NOT EXISTS "Bakim_deletedAt_idx" ON "Bakim"("deletedAt");
CREATE INDEX IF NOT EXISTS "Ceza_deletedAt_idx" ON "Ceza"("deletedAt");
CREATE INDEX IF NOT EXISTS "Masraf_deletedAt_idx" ON "Masraf"("deletedAt");
CREATE INDEX IF NOT EXISTS "Dokuman_deletedAt_idx" ON "Dokuman"("deletedAt");
