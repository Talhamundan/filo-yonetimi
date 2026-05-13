"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";
import { resolveVehicleUsageCompanyId } from "@/lib/vehicle-usage-company";
import { maybeCreateAdminApprovalRequest } from "@/lib/admin-approval";

const PATH = '/dashboard/dokumanlar';
const ARACLAR_PATH = '/dashboard/araclar';

function revalidateDokumanPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

export async function createDokuman(data: {
    ad: string;
    dosyaUrl: string;
    tur: any;
    aracId: string;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
        });
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id
        });

        const created = await prisma.dokuman.create({
            data: {
                ad: data.ad,
                dosyaUrl: data.dosyaUrl,
                tur: data.tur,
                aracId: arac.id,
                sirketId: usageSirketId,
            }
        });

        await logEntityActivity({
            actionType: ActivityActionType.CREATE,
            entityType: ActivityEntityType.DOKUMAN,
            entityId: created.id,
            summary: `${arac.plaka} için doküman yüklendi.`,
            actor,
            companyId: created.sirketId || actor.sirketId || null,
            metadata: {
                ad: created.ad,
                tur: created.tur,
                aracId: created.aracId,
            },
        });

        revalidateDokumanPages(arac.id);
        return { success: true };
    } catch (error) {
        console.error("Doküman eklenirken hata:", error);
        return { success: false, error: "Doküman eklenirken bir hata oluştu." };
    }
}
export async function updateDokuman(id: string, data: {
    ad?: string;
    tur?: any;
    dosyaUrl?: string;
    aracId?: string;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "dokuman",
            filterModel: "dokuman",
            id,
            select: { aracId: true, sirketId: true, ad: true, tur: true },
            errorMessage: "Doküman bulunamadı veya yetkiniz yok.",
        });

        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true });

        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id
        });

        const updateData = {
            ad: data.ad !== undefined ? data.ad : undefined,
            tur: data.tur !== undefined ? data.tur : undefined,
            dosyaUrl: data.dosyaUrl !== undefined ? data.dosyaUrl : undefined,
            aracId: arac.id,
            sirketId: usageSirketId,
        };
        const approval = await maybeCreateAdminApprovalRequest({
            action: "UPDATE",
            prismaModel: "dokuman",
            entityType: "Doküman",
            entityId: id,
            summary: `${(mevcutKayit as any).ad || "Doküman"} için düzenleme talebi.`,
            payload: updateData,
            beforeData: mevcutKayit,
            companyId: usageSirketId || actor.sirketId || null,
        });
        if (approval) return approval;

        const updated = await prisma.dokuman.update({
            where: { id },
            data: updateData
        });

        await logEntityActivity({
            actionType: ActivityActionType.UPDATE,
            entityType: ActivityEntityType.DOKUMAN,
            entityId: updated.id,
            summary: "Doküman güncellendi.",
            actor,
            companyId: updated.sirketId || actor.sirketId || null,
            metadata: {
                ad: updated.ad,
                tur: updated.tur,
                aracId: updated.aracId,
            },
        });

        revalidateDokumanPages(arac.id);
        return { success: true };
    } catch (error) {
        console.error("Doküman güncellenirken hata:", error);
        return { success: false, error: "Doküman güncellenirken bir hata oluştu." };
    }
}


export async function deleteDokuman(id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "dokuman",
            filterModel: "dokuman",
            id,
            select: { aracId: true, sirketId: true, ad: true, tur: true },
            errorMessage: "Dokuman bulunamadi veya yetkiniz yok.",
        });

        const approval = await maybeCreateAdminApprovalRequest({
            action: "DELETE",
            prismaModel: "dokuman",
            entityType: "Doküman",
            entityId: id,
            summary: `${(kayit as any).ad || "Doküman"} için silme talebi.`,
            beforeData: kayit,
            companyId: (kayit as any).sirketId || actor.sirketId || null,
        });
        if (approval) return approval;

        await softDeleteEntity("dokuman", id, actor.id);
        revalidateDokumanPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (error) {
        console.error("Doküman silinirken hata:", error);
        return { success: false, error: "Doküman çöp kutusuna taşınırken bir hata oluştu." };
    }
}
