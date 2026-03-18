import prisma from "@/lib/prisma";

export type SigortaTableName = "Kasko" | "TrafikSigortasi";

export function isMissingSigortaAcenteColumnError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase();
    return message.includes("acente") && message.includes("does not exist");
}

export function isSigortaOptionalFieldCompatibilityError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase();
    const hasOptionalField = message.includes("acente") || message.includes("sirketid");
    const hasCompatibilityKeyword =
        message.includes("does not exist") ||
        message.includes("unknown argument") ||
        message.includes("unknown field");

    return hasOptionalField && hasCompatibilityKeyword;
}

export async function ensureSigortaAcenteColumns() {
    try {
        await prisma.$executeRawUnsafe('ALTER TABLE "Kasko" ADD COLUMN IF NOT EXISTS "acente" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "TrafikSigortasi" ADD COLUMN IF NOT EXISTS "acente" TEXT');
        return;
    } catch (firstError) {
        try {
            await prisma.$executeRawUnsafe("ALTER TABLE kasko ADD COLUMN IF NOT EXISTS acente TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE trafiksigortasi ADD COLUMN IF NOT EXISTS acente TEXT");
            return;
        } catch (secondError) {
            console.warn("Sigorta acente kolonu otomatik onariminda hata olustu.", firstError, secondError);
        }
    }
}

export async function getExistingSigortaColumns(tableName: SigortaTableName) {
    try {
        const rows = (await prisma.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = ${tableName}
        `) as Array<{ column_name: string }>;
        return new Set<string>(rows.map((r: { column_name: string }) => r.column_name));
    } catch (error) {
        console.warn("Sigorta tablo kolonlari okunamadi, uyumluluk fallback'i uygulanacak.", error);
        return new Set<string>();
    }
}
