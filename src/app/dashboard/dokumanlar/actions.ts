"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { logEntityActivity } from "@/lib/activity-log";
import { resolveVehicleUsageCompanyId } from "@/lib/vehicle-usage-company";
import { maybeCreateAdminApprovalRequest } from "@/lib/admin-approval";
import { deleteStoredDocumentFile, saveDocumentFile } from "@/lib/document-storage";

const PATH = '/dashboard/dokumanlar';
const ARACLAR_PATH = '/dashboard/araclar';

function revalidateDokumanPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

type DokumanInput = {
    ad: string;
    dosyaUrl?: string;
    tur: any;
    aracId: string;
    file?: File | null;
};

function getTextFromFormData(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
}

function normalizeDokumanInput(input: DokumanInput | FormData): DokumanInput {
    if (input instanceof FormData) {
        const file = input.get("file");
        return {
            ad: getTextFromFormData(input, "ad"),
            aracId: getTextFromFormData(input, "aracId"),
            tur: getTextFromFormData(input, "tur"),
            dosyaUrl: getTextFromFormData(input, "dosyaUrl"),
            file: file instanceof File ? file : null,
        };
    }
    return input;
}

export async function createDokuman(input: DokumanInput | FormData) {
    try {
        const actor = await assertAuthenticatedUser();
        const data = normalizeDokumanInput(input);
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
        });
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id
        });
        const storedFile = data.file
            ? await saveDocumentFile({
                file: data.file,
                plaka: arac.plaka,
                tur: data.tur,
                ad: data.ad,
            })
            : null;
        const dosyaUrl = storedFile ? `/api/dokumanlar/__PENDING__/file` : (data.dosyaUrl || "").trim();
        if (!storedFile && !dosyaUrl) {
            return { success: false, error: "Lütfen PDF, JPG veya PNG dosyası seçin." };
        }

        const created = await prisma.dokuman.create({
            data: {
                ad: data.ad,
                dosyaUrl,
                originalName: storedFile?.originalName || null,
                fileName: storedFile?.fileName || null,
                mimeType: storedFile?.mimeType || null,
                size: storedFile?.size || null,
                path: storedFile?.path || null,
                tur: data.tur,
                aracId: arac.id,
                sirketId: usageSirketId,
            }
        });
        if (storedFile) {
            await prisma.dokuman.update({
                where: { id: created.id },
                data: { dosyaUrl: `/api/dokumanlar/${created.id}/file` },
            });
        }

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
                originalName: storedFile?.originalName || null,
                fileName: storedFile?.fileName || null,
                size: storedFile?.size || null,
            },
        });

        revalidateDokumanPages(arac.id);
        return { success: true };
    } catch (error) {
        console.error("Doküman eklenirken hata:", error);
        const message = error instanceof Error ? error.message : "";
        return { success: false, error: message || "Doküman eklenirken bir hata oluştu." };
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
            select: { aracId: true, sirketId: true, ad: true, tur: true, dosyaUrl: true, originalName: true, fileName: true, mimeType: true, size: true, path: true },
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
            select: { aracId: true, sirketId: true, ad: true, tur: true, path: true },
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

        await deleteStoredDocumentFile((kayit as any).path || null);
        await prisma.dokuman.delete({ where: { id } });
        revalidateDokumanPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (error) {
        console.error("Doküman silinirken hata:", error);
        return { success: false, error: "Doküman çöp kutusuna taşınırken bir hata oluştu." };
    }
}
