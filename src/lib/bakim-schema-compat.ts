import prisma from "@/lib/prisma";

export function isBakimSchemaCompatibilityError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase();
    const hasOptionalField =
        message.includes("plaka") ||
        message.includes("soforid") ||
        message.includes("sirketid") ||
        message.includes("arizasikayet") ||
        message.includes("degisenparca") ||
        message.includes("islemyapanfirma") ||
        message.includes("kategori") ||
        message.includes("saseno") ||
        message.includes("deletedat") ||
        message.includes("deletedby");
    const hasCompatibilityKeyword =
        message.includes("does not exist") ||
        message.includes("unknown argument") ||
        message.includes("unknown field");

    return hasOptionalField && hasCompatibilityKeyword;
}

export async function ensureBakimColumns() {
    try {
        await prisma.$executeRawUnsafe(`
            DO $$
            BEGIN
                CREATE TYPE "ServisKategori" AS ENUM ('PERIYODIK_BAKIM', 'ARIZA');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END
            $$;
        `);

        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "sirketId" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "soforId" TEXT');
        await prisma.$executeRawUnsafe(
            'ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "kategori" "ServisKategori" NOT NULL DEFAULT \'PERIYODIK_BAKIM\''
        );
        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "arizaSikayet" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "degisenParca" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "islemYapanFirma" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "plaka" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "saseNo" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)');
        await prisma.$executeRawUnsafe('ALTER TABLE "Bakim" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT');

        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Bakim_soforId_idx" ON "Bakim"("soforId")');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Bakim_sirketId_idx" ON "Bakim"("sirketId")');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Bakim_deletedAt_idx" ON "Bakim"("deletedAt")');
        await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Bakim_plaka_idx" ON "Bakim"("plaka")');
        return;
    } catch (firstError) {
        try {
            await prisma.$executeRawUnsafe(`
                DO $$
                BEGIN
                    CREATE TYPE serviskategori AS ENUM ('PERIYODIK_BAKIM', 'ARIZA');
                EXCEPTION
                    WHEN duplicate_object THEN NULL;
                END
                $$;
            `);

            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS sirketid TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS soforid TEXT");
            await prisma.$executeRawUnsafe(
                "ALTER TABLE bakim ADD COLUMN IF NOT EXISTS kategori serviskategori NOT NULL DEFAULT 'PERIYODIK_BAKIM'"
            );
            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS arizasikayet TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS degisenparca TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS islemyapanfirma TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS plaka TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS saseno TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS deletedat TIMESTAMP(3)");
            await prisma.$executeRawUnsafe("ALTER TABLE bakim ADD COLUMN IF NOT EXISTS deletedby TEXT");

            await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS bakim_soforid_idx ON bakim(soforid)");
            await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS bakim_sirketid_idx ON bakim(sirketid)");
            await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS bakim_deletedat_idx ON bakim(deletedat)");
            await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS bakim_plaka_idx ON bakim(plaka)");
            return;
        } catch (secondError) {
            console.warn("Bakim kolon otomatik onariminda hata olustu.", firstError, secondError);
        }
    }
}
