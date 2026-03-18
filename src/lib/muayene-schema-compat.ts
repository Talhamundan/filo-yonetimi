import prisma from "@/lib/prisma";

export function isMuayeneOptionalFieldCompatibilityError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase();
    const hasOptionalField =
        message.includes("sirketid") ||
        message.includes("km") ||
        message.includes("aktifmi") ||
        message.includes("tutar") ||
        message.includes("gectimi");
    const hasCompatibilityKeyword =
        message.includes("does not exist") ||
        message.includes("unknown argument") ||
        message.includes("unknown field");

    return hasOptionalField && hasCompatibilityKeyword;
}

export async function ensureMuayeneColumns() {
    try {
        await prisma.$executeRawUnsafe('ALTER TABLE "Muayene" ADD COLUMN IF NOT EXISTS "sirketId" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "Muayene" ADD COLUMN IF NOT EXISTS "km" INTEGER');
        await prisma.$executeRawUnsafe('ALTER TABLE "Muayene" ADD COLUMN IF NOT EXISTS "tutar" DOUBLE PRECISION');
        await prisma.$executeRawUnsafe('ALTER TABLE "Muayene" ADD COLUMN IF NOT EXISTS "gectiMi" BOOLEAN DEFAULT true');
        await prisma.$executeRawUnsafe('ALTER TABLE "Muayene" ADD COLUMN IF NOT EXISTS "aktifMi" BOOLEAN DEFAULT true');
        return;
    } catch (firstError) {
        try {
            await prisma.$executeRawUnsafe("ALTER TABLE muayene ADD COLUMN IF NOT EXISTS sirketId TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE muayene ADD COLUMN IF NOT EXISTS km INTEGER");
            await prisma.$executeRawUnsafe("ALTER TABLE muayene ADD COLUMN IF NOT EXISTS tutar DOUBLE PRECISION");
            await prisma.$executeRawUnsafe("ALTER TABLE muayene ADD COLUMN IF NOT EXISTS gectiMi BOOLEAN DEFAULT true");
            await prisma.$executeRawUnsafe("ALTER TABLE muayene ADD COLUMN IF NOT EXISTS aktifMi BOOLEAN DEFAULT true");
            return;
        } catch (secondError) {
            console.warn("Muayene kolon otomatik onariminda hata olustu.", firstError, secondError);
        }
    }
}

export async function getExistingMuayeneColumns() {
    try {
        const rows = (await prisma.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'Muayene'
        `) as Array<{ column_name: string }>;
        return new Set<string>(rows.map((r: { column_name: string }) => r.column_name));
    } catch (error) {
        console.warn("Muayene tablo kolonlari okunamadi, uyumluluk fallback'i uygulanacak.", error);
        return new Set<string>();
    }
}
