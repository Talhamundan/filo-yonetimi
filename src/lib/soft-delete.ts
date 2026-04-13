import prisma from "@/lib/prisma";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { logActivity } from "@/lib/activity-log";
import { syncAracDurumu } from "@/lib/arac-durum";

export type SoftDeleteEntity = "arac" | "masraf" | "bakim" | "dokuman" | "ceza" | "kullanici";
type HardDeleteMode = "default" | "trash";

type HardDeleteOptions = {
    mode?: HardDeleteMode;
};

export type SoftDeleteSnapshot = {
    id: string;
    companyId: string | null;
    summary: string;
};

function toActivityEntityType(entity: SoftDeleteEntity): ActivityEntityType {
    switch (entity) {
        case "arac":
            return ActivityEntityType.ARAC;
        case "masraf":
            return ActivityEntityType.MASRAF;
        case "bakim":
            return ActivityEntityType.BAKIM;
        case "dokuman":
            return ActivityEntityType.DOKUMAN;
        case "ceza":
            return ActivityEntityType.CEZA;
        case "kullanici":
            return ActivityEntityType.KULLANICI;
    }
}

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
                      summary: formatVehicleSummary({ ...row, plaka: row.plaka || '-' }),
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
    const snapshot = await getSoftDeleteSnapshot(entity, id);
    let result: unknown;

    switch (entity) {
        case "arac": {
            result = await prisma.$transaction(async (tx) => {
                await Promise.all([
                    tx.masraf.updateMany({
                        where: { aracId: id, deletedAt: null },
                        data: { deletedAt, deletedBy },
                    }),
                    tx.bakim.updateMany({
                        where: { aracId: id, deletedAt: null },
                        data: { deletedAt, deletedBy },
                    }),
                    tx.dokuman.updateMany({
                        where: { aracId: id, deletedAt: null },
                        data: { deletedAt, deletedBy },
                    }),
                    tx.ceza.updateMany({
                        where: { aracId: id, deletedAt: null },
                        data: { deletedAt, deletedBy },
                    }),
                ]);

                return tx.arac.update({
                    where: { id },
                    data: {
                        deletedAt,
                        deletedBy,
                        kullaniciId: null,
                        durum: "BOSTA",
                    },
                });
            });
            break;
        }
        case "masraf":
            result = await prisma.masraf.update({ where: { id }, data: { deletedAt, deletedBy } });
            break;
        case "bakim":
            result = await prisma.bakim.update({ where: { id }, data: { deletedAt, deletedBy } });
            break;
        case "dokuman":
            result = await prisma.dokuman.update({ where: { id }, data: { deletedAt, deletedBy } });
            break;
        case "ceza":
            result = await prisma.ceza.update({ where: { id }, data: { deletedAt, deletedBy } });
            break;
        case "kullanici":
            result = await prisma.kullanici.update({
                where: { id },
                data: {
                    deletedAt,
                    deletedBy,
                },
            });
            break;
    }

    await logActivity({
        actionType: ActivityActionType.ARCHIVE,
        entityType: toActivityEntityType(entity),
        entityId: id,
        summary: `${snapshot?.summary || "Kayıt"} çöp kutusuna taşındı.`,
        userId: deletedBy,
        companyId: snapshot?.companyId || null,
        metadata: { deletedAt },
    });

    return result;
}

export async function restoreEntity(entity: SoftDeleteEntity, id: string) {
    switch (entity) {
        case "arac": {
            const restored = await prisma.arac.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
            await syncAracDurumu(id);
            return restored;
        }
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

export async function hardDeleteEntity(entity: SoftDeleteEntity, id: string, options?: HardDeleteOptions) {
    const mode = options?.mode ?? "default";

    switch (entity) {
        case "arac":
            return prisma.$transaction([
                prisma.trafikSigortasi.deleteMany({ where: { aracId: id } }),
                prisma.kasko.deleteMany({ where: { aracId: id } }),
                prisma.muayene.deleteMany({ where: { aracId: id } }),
                prisma.arizaKaydi.deleteMany({ where: { aracId: id } }),
                prisma.bakim.deleteMany({ where: { aracId: id } }),
                prisma.ceza.deleteMany({ where: { aracId: id } }),
                prisma.masraf.deleteMany({ where: { aracId: id } }),
                prisma.kullaniciZimmet.deleteMany({ where: { aracId: id } }),
                prisma.yakit.deleteMany({ where: { aracId: id } }),
                prisma.dokuman.deleteMany({ where: { aracId: id } }),
                prisma.hgsYukleme.deleteMany({ where: { aracId: id } }),
                prisma.arac.deleteMany({ where: { id } }),
            ]);
        case "masraf":
            return prisma.masraf.delete({ where: { id } });
        case "bakim":
            return prisma.bakim.delete({ where: { id } });
        case "dokuman":
            return prisma.dokuman.delete({ where: { id } });
        case "ceza":
            return prisma.ceza.delete({ where: { id } });
        case "kullanici": {
            if (mode === "trash") {
                return prisma.$transaction(async (tx) => {
                    const now = new Date();
                    const affectedVehicleRows = await tx.arac.findMany({
                        where: { kullaniciId: id },
                        select: { id: true },
                    });
                    const activeZimmetler = await tx.kullaniciZimmet.findMany({
                        where: { kullaniciId: id, bitis: null },
                        select: { id: true, notlar: true },
                    });

                    for (const zimmet of activeZimmetler) {
                        const ekNot = "Kalıcı silme öncesi sistem tarafından sonlandırıldı.";
                        await tx.kullaniciZimmet.update({
                            where: { id: zimmet.id },
                            data: {
                                bitis: now,
                                notlar: zimmet.notlar ? `${zimmet.notlar} | ${ekNot}` : ekNot,
                            },
                        });
                    }

                    await Promise.all([
                        tx.arac.updateMany({
                            where: { kullaniciId: id },
                            data: { kullaniciId: null },
                        }),
                        tx.ceza.updateMany({
                            where: { soforId: id },
                            data: { soforId: null },
                        }),
                        tx.yakit.updateMany({
                            where: { soforId: id },
                            data: { soforId: null },
                        }),
                    ]);
                    for (const arac of affectedVehicleRows) {
                        await syncAracDurumu(arac.id, tx);
                    }

                    // Personel satırı fiziksel olarak silineceği için FK blokajını kaldır.
                    await tx.kullaniciZimmet.deleteMany({ where: { kullaniciId: id } });
                    return tx.kullanici.delete({ where: { id } });
                });
            }

            const zimmetCount = await prisma.kullaniciZimmet.count({ where: { kullaniciId: id } });
            if (zimmetCount > 0) {
                throw new Error("Zimmet geçmişi olan personel kalıcı silinemez.");
            }
            return prisma.kullanici.delete({ where: { id } });
        }
    }
}

export async function purgeExpiredSoftDeletedRecords(cutoffDate: Date) {
    const oldAracIds = (
        await prisma.arac.findMany({ where: { deletedAt: { lt: cutoffDate } }, select: { id: true } })
    ).map((row) => row.id);

    for (const aracId of oldAracIds) {
        await hardDeleteEntity("arac", aracId);
    }

    const [masrafCount, bakimCount, dokumanCount, cezaCount, oldKullaniciIds] = await Promise.all([
        prisma.masraf.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
        prisma.bakim.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
        prisma.dokuman.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
        prisma.ceza.deleteMany({ where: { deletedAt: { lt: cutoffDate } } }),
        prisma.kullanici.findMany({ where: { deletedAt: { lt: cutoffDate } }, select: { id: true } }),
    ]);

    let deletedUserCount = 0;
    for (const row of oldKullaniciIds) {
        try {
            await hardDeleteEntity("kullanici", row.id);
            deletedUserCount += 1;
        } catch {
            // Zimmet geçmişi olan personeller arşivde tutulur.
        }
    }

    return {
        aracDeleted: oldAracIds.length,
        masrafDeleted: masrafCount.count,
        bakimDeleted: bakimCount.count,
        dokumanDeleted: dokumanCount.count,
        cezaDeleted: cezaCount.count,
        kullaniciDeleted: deletedUserCount,
    };
}
