"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canRoleAccessAllCompanies, normalizeRole } from "@/lib/policy";

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
}

export async function createSirket(data: { ad: string; bulunduguIl: string; vergiNo?: string }) {
    try {
        await assertCompanyManager();

        await prisma.sirket.create({
            data: {
                ad: data.ad,
                bulunduguIl: data.bulunduguIl as string,
                vergiNo: data.vergiNo || null
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Şirket kaydedilemedi." };
    }
}

export async function updateSirket(id: string, data: { ad: string; bulunduguIl: string; vergiNo?: string }) {
    try {
        await assertCompanyManager();

        await prisma.sirket.update({
            where: { id },
            data: {
                ad: data.ad,
                bulunduguIl: data.bulunduguIl as string,
                vergiNo: data.vergiNo || null
            }
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
        await assertCompanyManager();

        await prisma.sirket.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Şirket silinemedi. Bağlı araç veya personel olabilir." };
    }
}
