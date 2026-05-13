"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canRoleAccessAllCompanies, normalizeRole } from "@/lib/policy";
import { parseSantiyeTextInput } from "@/lib/santiye";
import { maybeCreateAdminApprovalRequest } from "@/lib/admin-approval";

const PATH = "/dashboard/sirketler";

async function assertCompanyManager() {
    const session = await auth();
    const user = session?.user as { rol?: string | null; sirketId?: string | null } | undefined;
    const role = normalizeRole(user?.rol || null);
    const hasGlobalCompanyAccess = canRoleAccessAllCompanies(user?.rol || null, user?.sirketId || null);
    const canManageCompanies = role === "ADMIN" || (role === "YETKILI" && hasGlobalCompanyAccess);
    if (!canManageCompanies) {
        throw new Error("Bu işlem için yetkiniz yok.");
    }
    return user;
}

export async function createSirket(data: { ad: string; bulunduguIl: string; vergiNo?: string; santiyelerText?: string }) {
    try {
        const actor = await assertCompanyManager();
        const santiyeler = parseSantiyeTextInput(data.santiyelerText);
        const defaultSantiye = String(data.bulunduguIl || "").trim();
        const resolvedSantiyeler = santiyeler.length > 0
            ? santiyeler
            : (defaultSantiye ? [defaultSantiye.toLocaleUpperCase("tr-TR")] : []);

        await (prisma as any).sirket.create({
            data: {
                ad: data.ad,
                bulunduguIl: data.bulunduguIl as string,
                vergiNo: data.vergiNo || null,
                santiyeler: resolvedSantiyeler,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Şirket kaydedilemedi." };
    }
}

export async function updateSirket(id: string, data: { ad: string; bulunduguIl: string; vergiNo?: string; santiyelerText?: string }) {
    try {
        await assertCompanyManager();
        const santiyeler = parseSantiyeTextInput(data.santiyelerText);
        const defaultSantiye = String(data.bulunduguIl || "").trim();
        const resolvedSantiyeler = santiyeler.length > 0
            ? santiyeler
            : (defaultSantiye ? [defaultSantiye.toLocaleUpperCase("tr-TR")] : []);

        const updateData = {
            ad: data.ad,
            bulunduguIl: data.bulunduguIl as string,
            vergiNo: data.vergiNo || null,
            santiyeler: resolvedSantiyeler,
        };
        const approval = await maybeCreateAdminApprovalRequest({
            action: "UPDATE",
            prismaModel: "sirket",
            entityType: "Şirket",
            entityId: id,
            summary: `${data.ad} şirketi için düzenleme talebi.`,
            payload: updateData,
            companyId: id,
        });
        if (approval) return approval;

        await (prisma as any).sirket.update({
            where: { id },
            data: updateData
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Şirket güncellenemedi." };
    }
}

export async function deleteSirket(id: string) {
    try {
        const actor = await assertCompanyManager();
        const sirket = await prisma.sirket.findUnique({ where: { id }, select: { id: true, ad: true } });
        if (!sirket) return { success: false, error: "Şirket bulunamadı." };

        const approval = await maybeCreateAdminApprovalRequest({
            action: "DELETE",
            prismaModel: "sirket",
            entityType: "Şirket",
            entityId: id,
            summary: `${sirket.ad} şirketi için silme talebi.`,
            beforeData: sirket,
            companyId: id,
        });
        if (approval) return approval;

        await prisma.sirket.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Şirket silinemedi. Bağlı araç veya personel olabilir." };
    }
}
