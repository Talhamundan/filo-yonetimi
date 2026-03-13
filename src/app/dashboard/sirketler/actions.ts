"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

const PATH = "/dashboard/sirketler";

async function assertAdmin() {
    const session = await auth();
    if (!session?.user || (session.user as any).rol !== "ADMIN") {
        throw new Error("Bu işlem için yetkiniz yok.");
    }
}

export async function createSirket(data: { ad: string; bulunduguIl: string; vergiNo?: string }) {
    try {
        await assertAdmin();

        await prisma.sirket.create({
            data: {
                ad: data.ad,
                bulunduguIl: data.bulunduguIl as any,
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
        await assertAdmin();

        await prisma.sirket.update({
            where: { id },
            data: {
                ad: data.ad,
                bulunduguIl: data.bulunduguIl as any,
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
        await assertAdmin();

        await prisma.sirket.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Şirket silinemedi. Bağlı araç veya personel olabilir." };
    }
}
