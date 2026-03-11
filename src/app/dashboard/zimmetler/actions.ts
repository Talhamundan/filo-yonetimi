"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

const PATH = '/dashboard/zimmetler';

export async function createZimmet(data: {
    aracId: string;
    kullaniciId: string;
    baslangic: string;
    baslangicKm: number;
    notlar?: string;
}) {
    try {
        const aracId = data.aracId || null;
        const kullaniciId = data.kullaniciId || null;

        if (!aracId) throw new Error("Araç ID zorunludur.");

        // 1. Önce bu araçtaki mevcut aktif zimmetleri kapat
        await prisma.kullaniciZimmet.updateMany({
            where: { aracId, bitis: null },
            data: { 
                bitis: new Date(data.baslangic),
                bitisKm: Number(data.baslangicKm)
            }
        });

        // 2. Aracı yeni şoföre ata (Arac tablosunu güncelle)
        await prisma.arac.update({
            where: { id: aracId },
            data: { kullaniciId: kullaniciId }
        });

        // 3. Yeni zimmet kaydı oluştur
        await prisma.kullaniciZimmet.create({
            data: {
                aracId: aracId,
                kullaniciId: kullaniciId as any,
                baslangic: new Date(data.baslangic),
                baslangicKm: Number(data.baslangicKm),
                notlar: data.notlar || null
            }
        });

        revalidatePath(PATH);
        revalidatePath('/dashboard/araclar');
        revalidatePath('/dashboard/personel');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Zimmet kaydı oluşturulamadı." };
    }
}

export async function deleteZimmet(id: string) {
    try {
        await prisma.kullaniciZimmet.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Zimmet kaydı silinemedi." };
    }
}
