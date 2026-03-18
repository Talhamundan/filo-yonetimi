import prisma from "@/lib/prisma";

export function isMissingCezaPlakaColumnError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase();
    return message.includes('column "plaka" does not exist') || message.includes("column `plaka` does not exist");
}

export function isMissingCezaMaddesiColumnError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase();
    return message.includes("cezamaddesi") && message.includes("does not exist");
}

export function isCezaSchemaCompatibilityError(error: unknown) {
    const message = String((error as { message?: string } | null)?.message || error || "").toLowerCase();
    const hasField = message.includes("plaka") || message.includes("cezamaddesi");
    const hasCompatibilityKeyword =
        message.includes("does not exist") ||
        message.includes("unknown argument") ||
        message.includes("unknown field");

    return hasField && hasCompatibilityKeyword;
}

export async function ensureCezaFineTrackingColumns() {
    try {
        await prisma.$executeRawUnsafe('ALTER TABLE "Ceza" ADD COLUMN IF NOT EXISTS "plaka" TEXT');
        await prisma.$executeRawUnsafe('ALTER TABLE "Ceza" ADD COLUMN IF NOT EXISTS "cezaMaddesi" TEXT');
        await prisma.$executeRawUnsafe('UPDATE "Ceza" SET "cezaMaddesi" = COALESCE("cezaMaddesi", \'Belirtilmedi\')');
        await prisma.$executeRawUnsafe('ALTER TABLE "Ceza" ALTER COLUMN "cezaMaddesi" SET DEFAULT \'Belirtilmedi\'');
        return;
    } catch (firstError) {
        try {
            await prisma.$executeRawUnsafe("ALTER TABLE ceza ADD COLUMN IF NOT EXISTS plaka TEXT");
            await prisma.$executeRawUnsafe("ALTER TABLE ceza ADD COLUMN IF NOT EXISTS cezaMaddesi TEXT");
            await prisma.$executeRawUnsafe("UPDATE ceza SET cezaMaddesi = COALESCE(cezaMaddesi, 'Belirtilmedi')");
            return;
        } catch (secondError) {
            console.warn("Ceza kolon otomatik onariminda hata olustu.", firstError, secondError);
        }
    }
}

export async function ensureCezaPlakaColumn() {
    await ensureCezaFineTrackingColumns();
}
