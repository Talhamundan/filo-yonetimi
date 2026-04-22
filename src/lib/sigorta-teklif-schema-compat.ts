import prisma from "@/lib/prisma";

export type SigortaTeklifDurum = "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";
export type SigortaTeklifTur = "KASKO" | "TRAFIK";

export async function ensureSigortaTeklifTable() {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "SigortaTeklif" (
                "id" TEXT PRIMARY KEY,
                "aracId" TEXT NOT NULL,
                "tur" TEXT NOT NULL,
                "acente" TEXT,
                "sigortaSirketi" TEXT,
                "policeNo" TEXT,
                "baslangicTarihi" TIMESTAMP(3) NOT NULL,
                "bitisTarihi" TIMESTAMP(3) NOT NULL,
                "teklifTutar" DOUBLE PRECISION NOT NULL DEFAULT 0,
                "durum" TEXT NOT NULL DEFAULT 'BEKLIYOR',
                "notlar" TEXT,
                "sirketId" TEXT,
                "createdBy" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "SigortaTeklif_aracId_fkey" FOREIGN KEY ("aracId") REFERENCES "Arac"("id") ON DELETE CASCADE
            );
        `);
        await prisma.$executeRawUnsafe(`ALTER TABLE "SigortaTeklif" ADD COLUMN IF NOT EXISTS "olusturulanKayitId" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "SigortaTeklif" ADD COLUMN IF NOT EXISTS "olusturulanKayitTur" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "SigortaTeklif" ADD COLUMN IF NOT EXISTS "olusturulmaTarihi" TIMESTAMP(3)`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SigortaTeklif_aracId_idx" ON "SigortaTeklif" ("aracId")`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SigortaTeklif_durum_idx" ON "SigortaTeklif" ("durum")`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SigortaTeklif_bitisTarihi_idx" ON "SigortaTeklif" ("bitisTarihi")`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SigortaTeklif_sirketId_idx" ON "SigortaTeklif" ("sirketId")`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SigortaTeklif_olusturulanKayitId_idx" ON "SigortaTeklif" ("olusturulanKayitId")`);
    } catch (error) {
        console.warn("SigortaTeklif tablo uyumluluk kontrolü başarısız.", error);
    }
}
