import prisma from "@/lib/prisma";

export type SoftDeleteEntity = "arac" | "masraf" | "bakim" | "dokuman" | "ceza" | "kullanici";

export type SoftDeleteSnapshot = {
    id: string;
    companyId: string | null;
    summary: string;
};

function formatVehicleSummary(row: { plaka: string; marka: string; model: string }) {
    return `${row.plaka} - ${row.marka} ${row.model}`.trim();
}

export async function getSoftDeleteSnapshot(entity: SoftDeleteEntity, id: string): Promise<SoftDeleteSnapshot | null> {
    switch (entity) {
        case "arac": {
            const row = await prisma.arac.findUnique({
                where: { id },
                select: { id: true, sirketId: true, plaka: true, marka: true, model: true },
            });
            return row
                ? {
                      id: row.id,
                      companyId: row.sirketId,
                      summary: formatVehicleSummary(row),
                  }
                : null;
        }
        case "masraf": {
            const row = await prisma.masraf.findUnique({
                where: { id },
                select: { id: true, sirketId: true, tur: true, tutar: true },
            });
            return row
                ? {
                      id: row.id,
                      companyId: row.sirketId,
                      summary: `${row.tur} - ${row.tutar.toLocaleString("tr-TR")} TL`,
                  }
                : null;
        }
        case "bakim": {
            const row = await prisma.bakim.findUnique({
                where: { id },
                select: { id: true, sirketId: true, kategori: true, servisAdi: true },
            });
            return row
                ? {
                      id: row.id,
                      companyId: row.sirketId,
                      summary: `${row.kategori}${row.servisAdi ? ` - ${row.servisAdi}` : ""}`,
                  }
                : null;
        }
        case "dokuman": {
            const row = await prisma.dokuman.findUnique({
                where: { id },
                select: { id: true, sirketId: true, ad: true, tur: true },
            });
            return row
                ? {
                      id: row.id,
                      companyId: row.sirketId,
                      summary: `${row.ad} (${row.tur})`,
                  }
                : null;
        }
        case "ceza": {
            const row = await prisma.ceza.findUnique({
                where: { id },
                select: { id: true, sirketId: true, cezaMaddesi: true, tutar: true },
            });
            return row
                ? {
                      id: row.id,
                      companyId: row.sirketId,
                      summary: `${row.cezaMaddesi} - ${row.tutar.toLocaleString("tr-TR")} TL`,
                  }
                : null;
        }
        case "kullanici": {
            const row = await prisma.kullanici.findUnique({
                where: { id },
                select: { id: true, sirketId: true, ad: true, soyad: true },
            });
            return row
                ? {
                      id: row.id,
                      companyId: row.sirketId,
                      summary: `${row.ad} ${row.soyad}`.trim(),
                  }
                : null;
        }
        default:
            return null;
    }
}

export async function softDeleteEntity(entity: SoftDeleteEntity, id: string, deletedBy: string | null) {
    const deletedAt = new Date();

    switch (entity) {
        case "arac":
            return prisma.arac.update({
                where: { id },
                data: {
                    deletedAt,
                    deletedBy,
                    kullaniciId: null,
                    durum: "BOSTA",
                },
            });
        case "masraf":
            return prisma.masraf.update({ where: { id }, data: { deletedAt, deletedBy } });
        case "bakim":
            return prisma.bakim.update({ where: { id }, data: { deletedAt, deletedBy } });
        case "dokuman":
            return prisma.dokuman.update({ where: { id }, data: { deletedAt, deletedBy } });
        case "ceza":
            return prisma.ceza.update({ where: { id }, data: { deletedAt, deletedBy } });
        case "kullanici":
            return prisma.kullanici.update({ where: { id }, data: { deletedAt, deletedBy } });
    }
}

export async function restoreEntity(entity: SoftDeleteEntity, id: string) {
    switch (entity) {
        case "arac":
            return prisma.arac.update({ where: { id }, data: { deletedAt: null, deletedBy: null, durum: "AKTIF" } });
        case "masraf":
            return prisma.masraf.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
        case "bakim":
            return prisma.bakim.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
        case "dokuman":
            return prisma.dokuman.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
        case "ceza":
            return prisma.ceza.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
        case "kullanici":
            return prisma.kullanici.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
    }
}

export async function hardDeleteEntity(entity: SoftDeleteEntity, id: string) {
    switch (entity) {
        case "arac":
            return prisma.$transaction([
                prisma.trafikSigortasi.deleteMany({ where: { aracId: id } }),
                prisma.kasko.deleteMany({ where: { aracId: id } }),
                prisma.muayene.deleteMany({ where: { aracId: id } }),
                prisma.bakim.deleteMany({ where: { aracId: id } }),
                prisma.ceza.deleteMany({ where: { aracId: id } }),
                prisma.masraf.deleteMany({ where: { aracId: id } }),
                prisma.kullaniciZimmet.deleteMany({ where: { aracId: id } }),
                prisma.yakit.deleteMany({ where: { aracId: id } }),
                prisma.ariza.deleteMany({ where: { aracId: id } }),
                prisma.dokuman.deleteMany({ where: { aracId: id } }),
                prisma.hgsYukleme.deleteMany({ where: { aracId: id } }),
                prisma.arac.delete({ where: { id } }),
            ]);
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
    }
}

export async function purgeExpiredSoftDeletedRecords(cutoffDate: Date) {
    const oldAracIds = (
        await prisma.arac.findMany({ where: { deletedAt: { lt: cutoffDate } }, select: { id: true } })
    ).map((row) => row.id);

    for (const aracId of oldAracIds) {
        await hardDeleteEntity("arac", aracId);
    }

    const [masrafCount, bakimCount, dokumanCount, cezaCount, kullaniciCount] = await Promise.all([
        prisma.masraf.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
        prisma.bakim.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
        prisma.dokuman.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
        prisma.ceza.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
        prisma.kullanici.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
    ]);

    return {
        aracDeleted: oldAracIds.length,
        masrafDeleted: masrafCount.count,
        bakimDeleted: bakimCount.count,
        dokumanDeleted: dokumanCount.count,
        cezaDeleted: cezaCount.count,
        kullaniciDeleted: kullaniciCount.count,
    };
}
