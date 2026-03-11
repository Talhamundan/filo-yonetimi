"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

const PATH = '/dashboard/yakitlar';

export async function createYakit(data: {
    aracId: string;
    tarih: string;
    litre: number;
    tutar: number;
    km: number;
    istasyon?: string;
    odemeYontemi?: string;
}) {
    try {
        await prisma.yakit.create({
            data: {
                aracId: data.aracId || null,
                tarih: new Date(data.tarih),
                litre: Number(data.litre),
                tutar: Number(data.tutar),
                km: Number(data.km),
                istasyon: data.istasyon || null,
                odemeYontemi: (data.odemeYontemi as any) || 'NAKIT',
            }
        });

        // Araç KM güncelleme mantığı
        const arac = await prisma.arac.findUnique({
            where: { id: data.aracId },
            select: { guncelKm: true }
        });

        if (arac && Number(data.km) > arac.guncelKm) {
            await prisma.arac.update({
                where: { id: data.aracId },
                data: { guncelKm: Number(data.km) }
            });
        }

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Yakıt kaydı oluşturulamadı." };
    }
}

export async function updateYakit(id: string, data: any) {
    try {
        await prisma.yakit.update({
            where: { id },
            data: {
                ...data,
                aracId: data.aracId || undefined,
                tarih: data.tarih ? new Date(data.tarih) : undefined,
                litre: data.litre ? Number(data.litre) : undefined,
                tutar: data.tutar ? Number(data.tutar) : undefined,
                km: data.km ? Number(data.km) : undefined,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Yakıt kaydı güncellenemedi." };
    }
}

export async function deleteYakit(id: string) {
    try {
        await prisma.yakit.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Yakıt kaydı silinemedi." };
    }
}
