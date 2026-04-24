"use server";

import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { assertAuthenticatedUser } from "@/lib/action-scope";
import { getModelFilterWithOptions } from "@/lib/auth-utils";
import { getSoftDeleteSnapshot, hardDeleteEntity, purgeExpiredSoftDeletedRecords, type SoftDeleteEntity } from "@/lib/soft-delete";
import { logActivity } from "@/lib/activity-log";
import { syncAracDurumu } from "@/lib/arac-durum";

const TRASH_PATH = "/dashboard/cop-kutusu";
const EMPTY_TRASH_ORDER: SoftDeleteEntity[] = ["masraf", "bakim", "dokuman", "ceza", "kullanici", "arac"];

function mapTrashDeleteError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
            return "Kayıt başka verilerle ilişkili olduğu için kalıcı silinemedi. Önce ilişkili kayıtları temizleyin.";
        }
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Foreign key constraint failed")) {
        return "Kayıt başka verilerle ilişkili olduğu için kalıcı silinemedi. Önce ilişkili kayıtları temizleyin.";
    }
    return error instanceof Error ? error.message : "Kalıcı silme işlemi başarısız.";
}

function revalidateEntityPaths(entity: SoftDeleteEntity) {
    const paths = new Set<string>([
        "/dashboard",
        TRASH_PATH,
        "/dashboard/araclar",
    ]);

    switch (entity) {
        case "arac":
            paths.add("/dashboard/stok-takibi");
            paths.add("/dashboard/finans");
            paths.add("/dashboard/kasko");
            paths.add("/dashboard/trafik-sigortasi");
            paths.add("/dashboard/muayeneler");
            paths.add("/dashboard/yakitlar");
            paths.add("/dashboard/cezalar");
            paths.add("/dashboard/ceza-masraflari");
            paths.add("/dashboard/masraflar");
            paths.add("/dashboard/dokumanlar");
            paths.add("/dashboard/servis-kayitlari");
            paths.add("/dashboard/bakimlar");
            paths.add("/dashboard/zimmetler");
            break;
        case "masraf":
            paths.add("/dashboard/masraflar");
            paths.add("/dashboard/finans");
            break;
        case "bakim":
            paths.add("/dashboard/servis-kayitlari");
            paths.add("/dashboard/bakimlar");
            paths.add("/dashboard/arizalar");
            break;
        case "dokuman":
            paths.add("/dashboard/dokumanlar");
            paths.add("/dashboard/stok-takibi");
            break;
        case "ceza":
            paths.add("/dashboard/cezalar");
            paths.add("/dashboard/ceza-masraflari");
            paths.add("/dashboard/stok-takibi");
            break;
        case "kullanici":
            paths.add("/dashboard/personel");
            paths.add("/dashboard/zimmetler");
            break;
    }

    for (const path of paths) {
        revalidatePath(path);
    }
}

function entityToActivityType(entity: SoftDeleteEntity): ActivityEntityType {
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

async function restoreDeletedEntityInScope(entity: SoftDeleteEntity, id: string) {
    const filter = await getModelFilterWithOptions(entity === "kullanici" ? "personel" : entity, undefined, {
        includeDeleted: true,
    });
    const where = { id, ...(filter as Record<string, unknown>), deletedAt: { not: null } };

    switch (entity) {
        case "arac":
            return prisma.arac.updateMany({ where: where as never, data: { deletedAt: null, deletedBy: null } });
        case "masraf":
            return prisma.masraf.updateMany({ where: where as never, data: { deletedAt: null, deletedBy: null } });
        case "bakim":
            return prisma.bakim.updateMany({ where: where as never, data: { deletedAt: null, deletedBy: null } });
        case "dokuman":
            return prisma.dokuman.updateMany({ where: where as never, data: { deletedAt: null, deletedBy: null } });
        case "ceza":
            return prisma.ceza.updateMany({ where: where as never, data: { deletedAt: null, deletedBy: null } });
        case "kullanici":
            return prisma.kullanici.updateMany({ where: where as never, data: { deletedAt: null, deletedBy: null } });
    }
}

async function hardDeleteAracRecord(id: string) {
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
}

export async function restoreTrashRecord(entity: SoftDeleteEntity, id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const snapshot = await getSoftDeleteSnapshot(entity, id);
        const restoreResult = await restoreDeletedEntityInScope(entity, id);

        if (restoreResult.count === 0) {
            return { success: false, error: "Kayıt bulunamadı veya yetkiniz yok." };
        }

        if (entity === "arac") {
            try {
                await syncAracDurumu(id);
            } catch (syncError) {
                console.warn("Arac durum senkronizasyonu atlandi.", syncError);
            }
        }

        await logActivity({
            actionType: ActivityActionType.RESTORE,
            entityType: entityToActivityType(entity),
            entityId: id,
            summary: `${snapshot?.summary || "Kayıt"} çöp kutusundan geri yüklendi.`,
            userId: actor.id,
            companyId: snapshot?.companyId || actor.sirketId || null,
        });

        revalidateEntityPaths(entity);
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Kayıt geri yüklenemedi." };
    }
}

export async function permanentlyDeleteTrashRecord(entity: SoftDeleteEntity, id: string, selectedSirketId?: string | null) {
    try {
        const actor = await assertAuthenticatedUser();
        if (actor.rol !== "ADMIN") {
            return { success: false, error: "Kalıcı silme işlemi sadece admin yetkisi gerektirir." };
        }

        const scopedDeletedRows = await getDeletedIdsForEntityInScope(entity, selectedSirketId);
        const isInScope = scopedDeletedRows.some((row) => row.id === id);
        if (!isInScope) {
            return { success: false, error: "Kayıt bulunamadı veya yetkiniz yok." };
        }

        const snapshot = await getSoftDeleteSnapshot(entity, id);
        if (entity === "arac") {
            await hardDeleteAracRecord(id);
        } else {
            await hardDeleteEntity(entity, id, { mode: "trash" });
        }

        await logActivity({
            actionType: ActivityActionType.DELETE,
            entityType: entityToActivityType(entity),
            entityId: id,
            summary: `${snapshot?.summary || "Kayıt"} kalıcı olarak silindi.`,
            userId: actor.id,
            companyId: snapshot?.companyId || actor.sirketId || null,
        });

        revalidateEntityPaths(entity);
        return { success: true };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: mapTrashDeleteError(error),
        };
    }
}

export async function cleanupExpiredTrashNow() {
    try {
        const actor = await assertAuthenticatedUser();
        if (actor.rol !== "ADMIN") {
            return { success: false, error: "Bu işlem sadece admin yetkisi gerektirir." };
        }

        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await purgeExpiredSoftDeletedRecords(cutoffDate);

        await logActivity({
            actionType: ActivityActionType.DELETE,
            entityType: ActivityEntityType.DIGER,
            entityId: "TRASH_CLEANUP",
            summary: "Çöp kutusu otomatik temizlik işlemi çalıştırıldı.",
            userId: actor.id,
            companyId: actor.sirketId,
            metadata: { cutoffDate, ...result },
        });

        revalidatePath(TRASH_PATH);
        return { success: true, result };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Çöp kutusu temizleme işlemi başarısız." };
    }
}

async function getDeletedIdsForEntityInScope(entity: SoftDeleteEntity, selectedSirketId?: string | null) {
    const filter = await getModelFilterWithOptions(entity === "kullanici" ? "personel" : entity, selectedSirketId ?? undefined, {
        includeDeleted: true,
    });
    const where = { ...(filter as Record<string, unknown>), deletedAt: { not: null } };

    switch (entity) {
        case "arac":
            return prisma.arac.findMany({ where: where as never, select: { id: true } });
        case "masraf":
            return prisma.masraf.findMany({ where: where as never, select: { id: true } });
        case "bakim":
            return prisma.bakim.findMany({ where: where as never, select: { id: true } });
        case "dokuman":
            return prisma.dokuman.findMany({ where: where as never, select: { id: true } });
        case "ceza":
            return prisma.ceza.findMany({ where: where as never, select: { id: true } });
        case "kullanici":
            return prisma.kullanici.findMany({ where: where as never, select: { id: true } });
    }
}

export async function emptyTrashNow(selectedSirketId?: string | null) {
    try {
        const actor = await assertAuthenticatedUser();
        if (actor.rol !== "ADMIN") {
            return { success: false, error: "Bu işlem sadece admin yetkisi gerektirir." };
        }

        const idsByEntityEntries = await Promise.all(
            EMPTY_TRASH_ORDER.map(async (entity) => {
                const rows = await getDeletedIdsForEntityInScope(entity, selectedSirketId);
                return [entity, rows.map((row) => row.id)] as const;
            })
        );
        const idsByEntity = Object.fromEntries(idsByEntityEntries) as Record<SoftDeleteEntity, string[]>;

        const deletedByEntity: Record<SoftDeleteEntity, number> = {
            arac: 0,
            masraf: 0,
            bakim: 0,
            dokuman: 0,
            ceza: 0,
            kullanici: 0,
        };
        const failedByEntity: Record<SoftDeleteEntity, number> = {
            arac: 0,
            masraf: 0,
            bakim: 0,
            dokuman: 0,
            ceza: 0,
            kullanici: 0,
        };
        let firstFailureMessage: string | null = null;

        for (const entity of EMPTY_TRASH_ORDER) {
            for (const id of idsByEntity[entity]) {
                try {
                    if (entity === "arac") {
                        await hardDeleteAracRecord(id);
                    } else {
                        await hardDeleteEntity(entity, id, { mode: "trash" });
                    }
                    deletedByEntity[entity] += 1;
                } catch (error) {
                    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                        // Kayıt önceki silme adımında zaten düşmüş olabilir.
                        continue;
                    }
                    if (!firstFailureMessage) {
                        firstFailureMessage = mapTrashDeleteError(error);
                    }
                    failedByEntity[entity] += 1;
                }
            }
        }

        for (const entity of EMPTY_TRASH_ORDER) {
            if (deletedByEntity[entity] > 0) {
                revalidateEntityPaths(entity);
            }
        }

        const deletedTotal = Object.values(deletedByEntity).reduce((sum, value) => sum + value, 0);
        const failedTotal = Object.values(failedByEntity).reduce((sum, value) => sum + value, 0);

        await logActivity({
            actionType: ActivityActionType.DELETE,
            entityType: ActivityEntityType.DIGER,
            entityId: "TRASH_EMPTY",
            summary: "Çöp kutusu tamamen boşaltıldı.",
            userId: actor.id,
            companyId: actor.sirketId,
            metadata: {
                selectedSirketId: selectedSirketId || null,
                deletedTotal,
                failedTotal,
                deletedByEntity,
                failedByEntity,
            },
        });

        revalidatePath(TRASH_PATH);
        return {
            success: true,
            result: { deletedTotal, failedTotal, deletedByEntity, failedByEntity, firstFailureMessage },
        };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Çöp kutusu boşaltma işlemi başarısız." };
    }
}
