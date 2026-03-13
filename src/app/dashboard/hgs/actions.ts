"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope"

export async function createHgs(data: {
    aracId: string;
    tarih: string;
    etiketNo: string;
    tutar: number;
    km?: number;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            guncelKm: true,
        });

        await (prisma as any).hgsYukleme.create({
            data: {
                aracId: arac.id,
                tarih: new Date(data.tarih),
                etiketNo: data.etiketNo || null,
                tutar: Number(data.tutar),
                km: data.km ? Number(data.km) : null,
                sirketId: arac.sirketId
            }
        });

        // Araç KM güncelleme mantığı
        if (data.km) {
            if (Number(data.km) > arac.guncelKm) {
                await (prisma as any).arac.update({
                    where: { id: arac.id },
                    data: { guncelKm: Number(data.km) }
                });
            }
        }

        revalidatePath("/dashboard/hgs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateHgs(id: string, data: {
    aracId: string;
    tarih: string;
    etiketNo: string;
    tutar: number;
    km?: number;
}) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "hgsYukleme",
            filterModel: "hgs",
            id,
            select: { aracId: true, sirketId: true },
            errorMessage: "HGS kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true, guncelKm: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true, guncelKm: true });

        await (prisma as any).hgsYukleme.update({
            where: { id },
            data: {
                aracId: arac.id,
                tarih: new Date(data.tarih),
                etiketNo: data.etiketNo || null,
                tutar: Number(data.tutar),
                km: data.km ? Number(data.km) : null,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
            }
        });

        // Araç KM güncelleme mantığı (eğer güncellenen KM mevcut olandan büyükse)
        if (data.km && data.aracId) {
            if (Number(data.km) > arac.guncelKm) {
                await (prisma as any).arac.update({
                    where: { id: arac.id },
                    data: { guncelKm: Number(data.km) }
                });
            }
        }

        revalidatePath("/dashboard/hgs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteHgs(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "hgsYukleme",
            filterModel: "hgs",
            id,
            errorMessage: "HGS kaydi bulunamadi veya yetkiniz yok.",
        });

        await (prisma as any).hgsYukleme.delete({ where: { id } });
        revalidatePath("/dashboard/hgs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
