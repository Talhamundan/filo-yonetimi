"use server";
import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

const PATH = '/dashboard/cezalar';

export async function createCeza(data: { aracId: string; kullaniciId?: string; tutar: number; km?: number; aciklama: string; cezaTarihi: Date; odendiMi?: boolean }) {
    try {
        await prisma.ceza.create({
            data: {
                aracId: data.aracId,
                kullaniciId: data.kullaniciId || null,
                tutar: data.tutar,
                km: data.km ? Number(data.km) : null,
                aciklama: data.aciklama,
                cezaTarihi: new Date(data.cezaTarihi),
                odendiMi: data.odendiMi || false
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
        return { success: false, error: "Ceza kaydedilemedi." };
    }
}

export async function updateCeza(id: string, data: { aracId: string; kullaniciId?: string; tutar: number; km?: number; aciklama: string; cezaTarihi: Date; odendiMi: boolean }) {
    try {
        await prisma.ceza.update({
            where: { id },
            data: {
                aracId: data.aracId,
                kullaniciId: data.kullaniciId || null,
                tutar: data.tutar,
                km: data.km ? Number(data.km) : null,
                aciklama: data.aciklama,
                cezaTarihi: new Date(data.cezaTarihi),
                odendiMi: data.odendiMi
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
        return { success: false, error: "Ceza güncellenemedi." };
    }
}

export async function deleteCeza(id: string) {
    try {
        await prisma.ceza.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza silinemedi." };
    }
}
