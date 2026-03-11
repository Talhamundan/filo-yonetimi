"use server";
import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

const PATH = '/dashboard/personel';

export async function createPersonel(data: { ad: string; soyad: string; eposta?: string; telefon?: string; rol: string; sirketId?: string; sehir?: string; tcNo?: string }) {
    try {
        await prisma.kullanici.create({
            data: {
                ad: data.ad,
                soyad: data.soyad,
                eposta: data.eposta || null,
                telefon: data.telefon || null,
                rol: data.rol as any,
                sirketId: data.sirketId || null,
                sehir: data.sehir as any || null,
                tcNo: data.tcNo || null,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Personel kaydedilemedi. E-posta veya TC No çakışması olabilir." };
    }
}

export async function updatePersonel(id: string, data: { ad: string; soyad: string; eposta?: string; telefon?: string; rol: string; sirketId?: string; sehir?: string; tcNo?: string }) {
    try {
        await prisma.kullanici.update({
            where: { id },
            data: {
                ad: data.ad,
                soyad: data.soyad,
                eposta: data.eposta || null,
                telefon: data.telefon || null,
                rol: data.rol as any,
                sirketId: data.sirketId || null,
                sehir: data.sehir as any || null,
                tcNo: data.tcNo || null,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Personel güncellenemedi." };
    }
}

export async function deletePersonel(id: string) {
    try {
        await prisma.kullanici.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Personel silinemedi." };
    }
}
