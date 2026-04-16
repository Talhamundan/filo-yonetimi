import prisma from "@/lib/prisma";

// Soft-delete destekleyen entity tipleri
export type SoftDeleteEntity = "arac" | "masraf" | "bakim" | "dokuman" | "ceza" | "kullanici";

type SoftDeleteSnapshot = {
    summary: string;
    companyId: string | null;
} | null;

/**
 * Belirtilen entity'i soft-delete eder (deletedAt ve deletedBy alanlarını doldurur).
 */
export async function softDeleteEntity(entity: SoftDeleteEntity, id: string, deletedBy: string) {
    const data = { deletedAt: new Date(), deletedBy };

    switch (entity) {
        case "arac":
            return prisma.arac.update({ where: { id }, data });
        case "masraf":
            return prisma.masraf.update({ where: { id }, data });
        case "bakim":
            return prisma.bakim.update({ where: { id }, data });
        case "dokuman":
            return prisma.dokuman.update({ where: { id }, data });
        case "ceza":
            return prisma.ceza.update({ where: { id }, data });
        case "kullanici":
            return prisma.kullanici.update({ where: { id }, data });
        default:
            throw new Error(`Bilinmeyen entity türü: ${entity}`);
    }
}

/**
 * Belirtilen entity'i kalıcı olarak siler.
 */
export async function hardDeleteEntity(
    entity: SoftDeleteEntity,
    id: string,
    options?: { mode?: "trash" | "force" }
) {
    void options;
    switch (entity) {
        case "arac":
            return prisma.arac.delete({ where: { id } });
        case "masraf":
            return prisma.masraf.delete({ where: { id } });
        case "bakim":
            return prisma.bakim.delete({ where: { id } });
        case "dokuman":
            return prisma.dokuman.delete({ where: { id } });
        case "ceza":
            return prisma.ceza.delete({ where: { id } });
        case "kullanici":
            return prisma.kullanici.delete({ where: { id } });
        default:
            throw new Error(`Bilinmeyen entity türü: ${entity}`);
    }
}

/**
 * Soft-delete edilmiş kaydın özet bilgisini döner (aktivite log için).
 */
export async function getSoftDeleteSnapshot(
    entity: SoftDeleteEntity,
    id: string
): Promise<SoftDeleteSnapshot> {
    try {
        switch (entity) {
            case "arac": {
                const row = await prisma.arac.findUnique({
                    where: { id },
                    select: { plaka: true, marka: true, model: true, sirketId: true },
                });
                if (!row) return null;
                return {
                    summary: `${row.plaka || "?"} (${row.marka} ${row.model})`,
                    companyId: row.sirketId,
                };
            }
            case "masraf": {
                const row = await prisma.masraf.findUnique({
                    where: { id },
                    select: { tur: true, tutar: true, sirketId: true },
                });
                if (!row) return null;
                return {
                    summary: `Masraf: ${row.tur} - ${row.tutar} TL`,
                    companyId: row.sirketId,
                };
            }
            case "bakim": {
                const row = await prisma.bakim.findUnique({
                    where: { id },
                    select: { plaka: true, tutar: true, sirketId: true },
                });
                if (!row) return null;
                return {
                    summary: `Bakım: ${row.plaka || "?"} - ${row.tutar} TL`,
                    companyId: row.sirketId,
                };
            }
            case "dokuman": {
                const row = await prisma.dokuman.findUnique({
                    where: { id },
                    select: { ad: true, sirketId: true },
                });
                if (!row) return null;
                return {
                    summary: `Doküman: ${row.ad}`,
                    companyId: row.sirketId,
                };
            }
            case "ceza": {
                const row = await prisma.ceza.findUnique({
                    where: { id },
                    select: { plaka: true, tutar: true, sirketId: true },
                });
                if (!row) return null;
                return {
                    summary: `Ceza: ${row.plaka || "?"} - ${row.tutar} TL`,
                    companyId: row.sirketId,
                };
            }
            case "kullanici": {
                const row = await prisma.kullanici.findUnique({
                    where: { id },
                    select: { ad: true, soyad: true, sirketId: true },
                });
                if (!row) return null;
                return {
                    summary: `Personel: ${row.ad} ${row.soyad}`,
                    companyId: row.sirketId,
                };
            }
            default:
                return null;
        }
    } catch {
        return null;
    }
}

/**
 * Belirtilen tarihten önce soft-delete edilmiş kayıtları kalıcı olarak temizler.
 */
export async function purgeExpiredSoftDeletedRecords(cutoffDate: Date) {
    const where = { deletedAt: { lt: cutoffDate, not: null } };

    const [masraf, bakim, dokuman, ceza, kullanici, arac] = await Promise.all([
        prisma.masraf.deleteMany({ where: where as never }),
        prisma.bakim.deleteMany({ where: where as never }),
        prisma.dokuman.deleteMany({ where: where as never }),
        prisma.ceza.deleteMany({ where: where as never }),
        prisma.kullanici.deleteMany({ where: where as never }),
        // Araçlarda bağımlı veriler olacağından güvenli silme yapmıyoruz
        prisma.arac.deleteMany({ where: { ...where, kullaniciId: null } as never }),
    ]);

    return {
        masraf: masraf.count,
        bakim: bakim.count,
        dokuman: dokuman.count,
        ceza: ceza.count,
        kullanici: kullanici.count,
        arac: arac.count,
    };
}
