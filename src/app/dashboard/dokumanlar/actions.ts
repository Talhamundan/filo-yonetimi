"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";

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

        const created = await prisma.dokuman.create({
            data: {
                ad: data.ad,
                dosyaUrl: data.dosyaUrl,
                tur: data.tur,
                aracId: arac.id,
                sirketId: arac.sirketId,
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

        await softDeleteEntity("dokuman", id, actor.id);
        revalidateDokumanPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (error) {
        console.error("Doküman silinirken hata:", error);
        return { success: false, error: "Doküman çöp kutusuna taşınırken bir hata oluştu." };
    }
}
