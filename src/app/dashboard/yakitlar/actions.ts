"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

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
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            guncelKm: true,
        });

        await prisma.yakit.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                tarih: new Date(data.tarih),
                litre: Number(data.litre),
                tutar: Number(data.tutar),
                km: Number(data.km),
                istasyon: data.istasyon || null,
                odemeYontemi: (data.odemeYontemi as any) || 'NAKIT',
            }
        });

        // Araç KM güncelleme mantığı
        if (Number(data.km) > arac.guncelKm) {
            await prisma.arac.update({
                where: { id: arac.id },
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
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "yakit",
            filterModel: "yakit",
            id,
            select: { aracId: true, sirketId: true },
            errorMessage: "Yakit kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true, guncelKm: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true, guncelKm: true });

        await prisma.yakit.update({
            where: { id },
            data: {
                ...data,
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                tarih: data.tarih ? new Date(data.tarih) : undefined,
                litre: data.litre ? Number(data.litre) : undefined,
                tutar: data.tutar ? Number(data.tutar) : undefined,
                km: data.km ? Number(data.km) : undefined,
            }
        });

        // Araç KM güncelleme mantığı (eğer güncellenen KM mevcut olandan büyükse)
        if (data.km && Number(data.km) > arac.guncelKm) {
            await prisma.arac.update({
                where: { id: arac.id },
                data: { guncelKm: Number(data.km) }
            });
        }

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Yakıt kaydı güncellenemedi." };
    }
}

export async function deleteYakit(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "yakit",
            filterModel: "yakit",
            id,
            errorMessage: "Yakit kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.yakit.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Yakıt kaydı silinemedi." };
    }
}
