"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";
import { resolveVehicleUsageCompanyId } from "@/lib/vehicle-usage-company";

const PATH = '/dashboard/masraflar';
const ARACLAR_PATH = '/dashboard/araclar';

function revalidateMasrafPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath('/dashboard');
    revalidatePath(ARACLAR_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

export async function createMasraf(data: {
    aracId: string;
    tarih: string;
    tur: string;
    tutar: number;
    aciklama?: string;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
        });
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id,
            fallbackSirketId: arac.sirketId,
        });

        const created = await prisma.masraf.create({
            data: {
                aracId: arac.id,
                sirketId: usageSirketId,
                tarih: new Date(data.tarih),
                tur: data.tur as any,
                tutar: Number(data.tutar),
                aciklama: data.aciklama || null,
            }
        });

        await logEntityActivity({
            actionType: ActivityActionType.CREATE,
            entityType: ActivityEntityType.MASRAF,
            entityId: created.id,
            summary: `${arac.plaka} için masraf kaydı eklendi.`,
            actor,
            companyId: created.sirketId || actor.sirketId || null,
            metadata: {
                tur: created.tur,
                tutar: created.tutar,
                tarih: created.tarih,
                aciklama: created.aciklama,
                aracId: created.aracId,
            },
        });

        revalidateMasrafPages(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı oluşturulamadı." };
    }
}

export async function updateMasraf(id: string, data: any) {
    try {
        const actor = await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "masraf",
            filterModel: "masraf",
            id,
            select: { aracId: true, sirketId: true },
            errorMessage: "Masraf kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true });
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id,
            fallbackSirketId: arac.sirketId || mevcutKayit.sirketId,
        });

        const updated = await prisma.masraf.update({
            where: { id },
            data: {
                aracId: arac.id,
                sirketId: usageSirketId || mevcutKayit.sirketId,
                tur: data.tur !== undefined ? (data.tur as any) : undefined,
                tarih: data.tarih !== undefined ? new Date(data.tarih) : undefined,
                tutar: data.tutar !== undefined ? Number(data.tutar) : undefined,
                aciklama: data.aciklama !== undefined ? data.aciklama || null : undefined,
            }
        });

        await logEntityActivity({
            actionType: ActivityActionType.UPDATE,
            entityType: ActivityEntityType.MASRAF,
            entityId: updated.id,
            summary: "Masraf kaydı güncellendi.",
            actor,
            companyId: updated.sirketId || actor.sirketId || null,
            metadata: {
                tur: updated.tur,
                tutar: updated.tutar,
                tarih: updated.tarih,
                aracId: updated.aracId,
            },
        });

        revalidateMasrafPages(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı güncellenemedi." };
    }
}

export async function deleteMasraf(id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "masraf",
            filterModel: "masraf",
            id,
            select: { aracId: true, sirketId: true, tur: true, tutar: true, tarih: true },
            errorMessage: "Masraf kaydi bulunamadi veya yetkiniz yok.",
        });

        await softDeleteEntity("masraf", id, actor.id);
        revalidateMasrafPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı çöp kutusuna taşınamadı." };
    }
}
