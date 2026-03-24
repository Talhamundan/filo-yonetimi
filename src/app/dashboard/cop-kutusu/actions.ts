"use server";

import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { assertAuthenticatedUser } from "@/lib/action-scope";
import { getModelFilterWithOptions } from "@/lib/auth-utils";
import { getSoftDeleteSnapshot, hardDeleteEntity, purgeExpiredSoftDeletedRecords, restoreEntity, type SoftDeleteEntity } from "@/lib/soft-delete";
import { logActivity } from "@/lib/activity-log";

const TRASH_PATH = "/dashboard/cop-kutusu";

function revalidateEntityPaths(entity: SoftDeleteEntity) {
    const paths = new Set<string>([
        "/dashboard",
        TRASH_PATH,
        "/dashboard/araclar",
    ]);

    switch (entity) {
        case "arac":
            paths.add("/dashboard/evrak-takip");
            paths.add("/dashboard/finans");
            paths.add("/dashboard/kasko");
            paths.add("/dashboard/trafik-sigortasi");
            paths.add("/dashboard/muayeneler");
            paths.add("/dashboard/yakitlar");
            paths.add("/dashboard/hgs");
            paths.add("/dashboard/cezalar");
            paths.add("/dashboard/ceza-masraflari");
            paths.add("/dashboard/masraflar");
            paths.add("/dashboard/dokumanlar");
            paths.add("/dashboard/bakimlar");
            paths.add("/dashboard/zimmetler");
            break;
        case "masraf":
            paths.add("/dashboard/masraflar");
            paths.add("/dashboard/finans");
            break;
        case "bakim":
            paths.add("/dashboard/bakimlar");
            paths.add("/dashboard/arizalar");
            break;
        case "dokuman":
            paths.add("/dashboard/dokumanlar");
            paths.add("/dashboard/evrak-takip");
            break;
        case "ceza":
            paths.add("/dashboard/cezalar");
            paths.add("/dashboard/ceza-masraflari");
            paths.add("/dashboard/evrak-takip");
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

async function assertEntityInScope(entity: SoftDeleteEntity, id: string) {
    const filter = await getModelFilterWithOptions(entity === "kullanici" ? "personel" : entity, undefined, {
        includeDeleted: true,
    });
    const where = { id, ...(filter as Record<string, unknown>), deletedAt: { not: null } };

    switch (entity) {
        case "arac":
            return prisma.arac.findFirst({ where: where as never, select: { id: true } });
        case "masraf":
            return prisma.masraf.findFirst({ where: where as never, select: { id: true } });
        case "bakim":
            return prisma.bakim.findFirst({ where: where as never, select: { id: true } });
        case "dokuman":
            return prisma.dokuman.findFirst({ where: where as never, select: { id: true } });
        case "ceza":
            return prisma.ceza.findFirst({ where: where as never, select: { id: true } });
        case "kullanici":
            return prisma.kullanici.findFirst({ where: where as never, select: { id: true } });
    }
}

export async function restoreTrashRecord(entity: SoftDeleteEntity, id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const allowed = await assertEntityInScope(entity, id);
        if (!allowed) {
            return { success: false, error: "Kayıt bulunamadı veya yetkiniz yok." };
        }

        const snapshot = await getSoftDeleteSnapshot(entity, id);
        await restoreEntity(entity, id);

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

export async function permanentlyDeleteTrashRecord(entity: SoftDeleteEntity, id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        if (actor.rol !== "ADMIN") {
            return { success: false, error: "Kalıcı silme işlemi sadece admin yetkisi gerektirir." };
        }

        const allowed = await assertEntityInScope(entity, id);
        if (!allowed) {
            return { success: false, error: "Kayıt bulunamadı veya yetkiniz yok." };
        }

        const snapshot = await getSoftDeleteSnapshot(entity, id);
        await hardDeleteEntity(entity, id, { mode: "trash" });

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
            error: error instanceof Error ? error.message : "Kalıcı silme işlemi başarısız.",
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
