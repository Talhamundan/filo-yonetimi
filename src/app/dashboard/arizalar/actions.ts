"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

const PATH = '/dashboard/arizalar';

export async function createAriza(data: {
    aracId: string;
    aciklama: string;
    arizaTarihi: string;
    durum: string;
    servis?: string;
    tahminiTutar?: number;
}) {
    try {
        await prisma.ariza.create({
            data: {
                aracId: data.aracId || null,
                aciklama: data.aciklama,
                arizaTarihi: new Date(data.arizaTarihi),
                durum: data.durum as any,
                servis: data.servis || null,
                tahminiTutar: data.tahminiTutar ? Number(data.tahminiTutar) : null,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Arıza kaydı oluşturulamadı." };
    }
}

export async function updateAriza(id: string, data: any) {
    try {
        await prisma.ariza.update({
            where: { id },
            data: {
                ...data,
                aracId: data.aracId || undefined,
                arizaTarihi: data.arizaTarihi ? new Date(data.arizaTarihi) : undefined,
                durum: data.durum ? (data.durum as any) : undefined,
                tahminiTutar: data.tahminiTutar !== undefined ? (data.tahminiTutar ? Number(data.tahminiTutar) : null) : undefined,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Arıza kaydı güncellenemedi." };
    }
}

export async function deleteAriza(id: string) {
    try {
        await prisma.ariza.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Arıza kaydı silinemedi." };
    }
}
