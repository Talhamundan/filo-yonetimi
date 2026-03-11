"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

const PATH = '/dashboard/masraflar';

export async function createMasraf(data: {
    aracId: string;
    tarih: string;
    tur: string;
    tutar: number;
    aciklama?: string;
}) {
    try {
        await prisma.masraf.create({
            data: {
                aracId: data.aracId || null,
                tarih: new Date(data.tarih),
                tur: data.tur as any,
                tutar: Number(data.tutar),
                aciklama: data.aciklama || null,
            }
        });
        revalidatePath(PATH);
        revalidatePath('/dashboard'); // Dashboard stats might change
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı oluşturulamadı." };
    }
}

export async function updateMasraf(id: string, data: any) {
    try {
        await prisma.masraf.update({
            where: { id },
            data: {
                ...data,
                aracId: data.aracId || undefined,
                tur: data.tur ? (data.tur as any) : undefined,
                tarih: data.tarih ? new Date(data.tarih) : undefined,
                tutar: data.tutar ? Number(data.tutar) : undefined,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı güncellenemedi." };
    }
}

export async function deleteMasraf(id: string) {
    try {
        await prisma.masraf.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı silinemedi." };
    }
}
