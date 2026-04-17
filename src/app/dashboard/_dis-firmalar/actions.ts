"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canRoleAccessAllCompanies, normalizeRole } from "@/lib/policy";
import { disFirmaFormSchema, type DisFirmaFormValues } from "./schema";

const PATHS = ["/dashboard/taseronlar", "/dashboard/kiraliklar", "/dashboard/araclar", "/dashboard/personel"];

type SessionUser = { rol?: string | null; sirketId?: string | null };

async function assertVendorManager() {
    const session = await auth();
    const user = session?.user as SessionUser | undefined;
    const role = normalizeRole(user?.rol || null);
    const canManage = role === "ADMIN" || (role === "YETKILI" && canRoleAccessAllCompanies(user?.rol || null, user?.sirketId || null));
    if (!canManage) {
        throw new Error("Bu işlem için yetkiniz yok.");
    }
}

function normalizePayload(data: DisFirmaFormValues) {
    return {
        ad: data.ad.trim().toLocaleUpperCase("tr-TR"),
        tur: data.tur,
        sehir: data.sehir.trim().toLocaleUpperCase("tr-TR"),
        vergiNo: data.vergiNo?.trim() || null,
        yetkiliKisi: data.yetkiliKisi?.trim().toLocaleUpperCase("tr-TR") || null,
        telefon: data.telefon?.trim() || null,
        calistigiKurum: data.calistigiKurum?.trim().toLocaleUpperCase("tr-TR") || null,
    };
}

function revalidateVendorPaths(id?: string) {
    for (const path of PATHS) {
        revalidatePath(path);
    }
    if (id) {
        revalidatePath(`/dashboard/araclar?disFirmaId=${id}`);
        revalidatePath(`/dashboard/personel?disFirmaId=${id}`);
    }
}

export async function createDisFirma(data: DisFirmaFormValues) {
    try {
        await assertVendorManager();
        const parsed = disFirmaFormSchema.parse(data);
        const created = await (prisma as any).disFirma.create({
            data: normalizePayload(parsed),
            select: { id: true },
        });
        revalidateVendorPaths(created.id);
        return { success: true };
    } catch (error) {
        console.error("CreateDisFirma Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Dış firma kaydedilemedi.",
        };
    }
}

export async function updateDisFirma(id: string, data: DisFirmaFormValues) {
    try {
        await assertVendorManager();
        const parsed = disFirmaFormSchema.parse(data);
        await (prisma as any).disFirma.update({
            where: { id },
            data: normalizePayload(parsed),
        });
        revalidateVendorPaths(id);
        return { success: true };
    } catch (error) {
        console.error("UpdateDisFirma Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Dış firma güncellenemedi.",
        };
    }
}

export async function deleteDisFirma(id: string) {
    try {
        await assertVendorManager();
        await (prisma as any).disFirma.delete({ where: { id } });
        revalidateVendorPaths(id);
        return { success: true };
    } catch (error) {
        console.error("DeleteDisFirma Error:", error);
        return {
            success: false,
            error: "Dış firma silinemedi. Bağlı araç veya personel kaydı olabilir.",
        };
    }
}
