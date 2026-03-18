"use server";

import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { assertAuthenticatedUser } from "@/lib/action-scope";
import { getModelFilterWithOptions } from "@/lib/auth-utils";
import { getSoftDeleteSnapshot, hardDeleteEntity, purgeExpiredSoftDeletedRecords, restoreEntity, type SoftDeleteEntity } from "@/lib/soft-delete";
import { logActivity } from "@/lib/activity-log";

const TRASH_PATH = "/dashboard/cop-kutusu";

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

        revalidatePath(TRASH_PATH);
        revalidatePath("/dashboard");
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
        await hardDeleteEntity(entity, id);

        await logActivity({
            actionType: ActivityActionType.DELETE,
            entityType: entityToActivityType(entity),
            entityId: id,
            summary: `${snapshot?.summary || "Kayıt"} kalıcı olarak silindi.`,
            userId: actor.id,
            companyId: snapshot?.companyId || actor.sirketId || null,
        });

        revalidatePath(TRASH_PATH);
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Kalıcı silme işlemi başarısız." };
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
