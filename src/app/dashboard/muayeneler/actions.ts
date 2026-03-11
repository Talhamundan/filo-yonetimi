"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

const PATH = '/dashboard/muayeneler';

export async function createMuayene(data: {
    aracId: string;
    muayeneTarihi: string;
    gecerlilikTarihi: string;
    istasyon?: string;
    km?: number;
    aktifMi?: boolean;
}) {
    try {
        await prisma.muayene.create({
            data: {
                aracId: data.aracId || null,
                muayeneTarihi: new Date(data.muayeneTarihi),
                gecerlilikTarihi: new Date(data.gecerlilikTarihi),
                istasyon: data.istasyon || null,
                km: data.km ? Number(data.km) : null,
                aktifMi: data.aktifMi ?? true,
            }
        });

        // Araç KM güncelleme mantığı
        if (data.km) {
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
        }

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Muayene kaydı oluşturulamadı." };
    }
}

export async function updateMuayene(id: string, data: any) {
    try {
        await prisma.muayene.update({
            where: { id },
            data: {
                ...data,
                aracId: data.aracId || undefined,
                muayeneTarihi: data.muayeneTarihi ? new Date(data.muayeneTarihi) : undefined,
                gecerlilikTarihi: data.gecerlilikTarihi ? new Date(data.gecerlilikTarihi) : undefined,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Muayene kaydı güncellenemedi." };
    }
}

export async function deleteMuayene(id: string) {
    try {
        await prisma.muayene.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Muayene kaydı silinemedi." };
    }
}
