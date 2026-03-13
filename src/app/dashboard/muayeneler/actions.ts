"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

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
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            guncelKm: true,
        });

        await prisma.muayene.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                muayeneTarihi: new Date(data.muayeneTarihi),
                gecerlilikTarihi: new Date(data.gecerlilikTarihi),
                istasyon: data.istasyon || null,
                km: data.km ? Number(data.km) : null,
                aktifMi: data.aktifMi ?? true,
            }
        });

        // Araç KM güncelleme mantığı
        if (data.km) {
            if (Number(data.km) > arac.guncelKm) {
                await prisma.arac.update({
                    where: { id: arac.id },
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
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "muayene",
            filterModel: "muayene",
            id,
            select: { aracId: true, sirketId: true },
            errorMessage: "Muayene kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true, guncelKm: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true, guncelKm: true });

        await prisma.muayene.update({
            where: { id },
            data: {
                ...data,
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                muayeneTarihi: data.muayeneTarihi ? new Date(data.muayeneTarihi) : undefined,
                gecerlilikTarihi: data.gecerlilikTarihi ? new Date(data.gecerlilikTarihi) : undefined,
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
        return { success: false, error: "Muayene kaydı güncellenemedi." };
    }
}

export async function deleteMuayene(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "muayene",
            filterModel: "muayene",
            id,
            errorMessage: "Muayene kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.muayene.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Muayene kaydı silinemedi." };
    }
}
