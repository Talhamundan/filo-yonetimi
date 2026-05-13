"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getModelFilter } from "@/lib/auth-utils";
import { canRoleAccessAllCompanies, normalizeRole } from "@/lib/policy";
import { revalidatePath } from "next/cache";
import { stokKalemFormSchema, type StokKalemFormValues } from "./schema";
import { maybeCreateAdminApprovalRequest } from "@/lib/admin-approval";

const PATHS_TO_REVALIDATE = ["/dashboard/stok-takibi", "/dashboard/evrak-takip", "/dashboard"];

type SessionUser = {
    id?: string | null;
    rol?: string | null;
    sirketId?: string | null;
};

function revalidateStockPaths() {
    for (const path of PATHS_TO_REVALIDATE) {
        revalidatePath(path);
    }
}

function normalizeText(value: string | null | undefined) {
    const normalized = String(value || "").trim();
    return normalized.length > 0 ? normalized : null;
}

function normalizeUpper(value: string | null | undefined) {
    const normalized = normalizeText(value);
    return normalized ? normalized.toLocaleUpperCase("tr-TR") : null;
}

async function getCreateScope(payloadSirketId?: string | null) {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    const role = normalizeRole(user?.rol || null);

    if (!role || role === "PERSONEL") {
        throw new Error("Bu işlem için yetkiniz yok.");
    }

    const canAccessAll = canRoleAccessAllCompanies(user?.rol || null, user?.sirketId || null);
    if (!canAccessAll) {
        const fixedSirketId = normalizeText(user?.sirketId);
        if (!fixedSirketId) {
            throw new Error("Şirket kapsamı belirlenemedi.");
        }
        return fixedSirketId;
    }

    const selectedSirketId = normalizeText(payloadSirketId);
    if (!selectedSirketId) {
        throw new Error("Stok kalemi eklemek için bir şirket seçmelisiniz.");
    }
    return selectedSirketId;
}

async function assertCanMutateStockKalem(id: string) {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    const role = normalizeRole(user?.rol || null);

    if (!role || role === "PERSONEL") {
        throw new Error("Bu işlem için yetkiniz yok.");
    }

    const scopeFilter = (await getModelFilter("stokKalem")) as Record<string, unknown>;
    const record = await (prisma as any).stokKalem.findFirst({
        where: {
            id,
            ...(scopeFilter as any),
        },
        select: { id: true, ad: true, sirketId: true },
    });

    if (!record) {
        throw new Error("Bu stok kalemi için yetkiniz yok.");
    }
    return { user, record };
}

function buildPayload(data: StokKalemFormValues, sirketId: string) {
    return {
        ad: normalizeUpper(data.ad) || "",
        kategori: normalizeUpper(data.kategori),
        miktar: Number(data.miktar || 0),
        birim: normalizeUpper(data.birim) || "ADET",
        konum: normalizeUpper(data.konum),
        kritikSeviye: typeof data.kritikSeviye === "number" && Number.isFinite(data.kritikSeviye) ? data.kritikSeviye : null,
        aciklama: normalizeText(data.aciklama),
        sirketId,
    };
}

export async function createStokKalem(data: StokKalemFormValues) {
    try {
        const parsed = stokKalemFormSchema.parse(data);
        const sirketId = await getCreateScope(parsed.sirketId || null);

        await (prisma as any).stokKalem.create({
            data: buildPayload(parsed, sirketId),
        });

        revalidateStockPaths();
        return { success: true };
    } catch (error) {
        console.error("createStokKalem error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Stok kalemi kaydedilemedi.",
        };
    }
}

export async function updateStokKalem(id: string, data: StokKalemFormValues) {
    try {
        const { user, record } = await assertCanMutateStockKalem(id);
        const parsed = stokKalemFormSchema.parse(data);
        const sirketId = await getCreateScope(parsed.sirketId || null);
        const updateData = buildPayload(parsed, sirketId);

        const approval = await maybeCreateAdminApprovalRequest({
            action: "UPDATE",
            prismaModel: "stokKalem",
            entityType: "Stok Kalemi",
            entityId: id,
            summary: `${record.ad} stok kalemi için düzenleme talebi.`,
            payload: updateData,
            beforeData: record,
            companyId: updateData.sirketId || user?.sirketId || null,
        });
        if (approval) return approval;

        await (prisma as any).stokKalem.update({
            where: { id },
            data: updateData,
        });

        revalidateStockPaths();
        return { success: true };
    } catch (error) {
        console.error("updateStokKalem error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Stok kalemi güncellenemedi.",
        };
    }
}

export async function deleteStokKalem(id: string) {
    try {
        const { user, record } = await assertCanMutateStockKalem(id);

        const approval = await maybeCreateAdminApprovalRequest({
            action: "DELETE",
            prismaModel: "stokKalem",
            entityType: "Stok Kalemi",
            entityId: id,
            summary: `${record.ad} stok kalemi için silme talebi.`,
            beforeData: record,
            companyId: record.sirketId || user?.sirketId || null,
        });
        if (approval) return approval;

        await (prisma as any).stokKalem.delete({
            where: { id },
        });

        revalidateStockPaths();
        return { success: true };
    } catch (error) {
        console.error("deleteStokKalem error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Stok kalemi silinemedi.",
        };
    }
}
