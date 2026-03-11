"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSirketFilter } from "@/lib/auth-utils"

export async function createHgs(data: {
    aracId: string;
    tarih: string;
    etiketNo: string;
    tutar: number;
    km?: number;
}) {
    try {
        const sirketFilter = await getSirketFilter();
        const sirketId = (sirketFilter as any)?.sirketId || null;

        await (prisma as any).hgsYukleme.create({
            data: {
                aracId: data.aracId || null,
                tarih: new Date(data.tarih),
                etiketNo: data.etiketNo || null,
                tutar: Number(data.tutar),
                km: data.km ? Number(data.km) : null,
                sirketId
            }
        });

        // Araç KM güncelleme mantığı
        if (data.km) {
            const arac = await (prisma as any).arac.findUnique({
                where: { id: data.aracId },
                select: { guncelKm: true }
            });

            if (arac && Number(data.km) > arac.guncelKm) {
                await (prisma as any).arac.update({
                    where: { id: data.aracId },
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
}) {
    try {
        await (prisma as any).hgsYukleme.update({
            where: { id },
            data: {
                aracId: data.aracId || null,
                tarih: new Date(data.tarih),
                etiketNo: data.etiketNo || null,
                tutar: Number(data.tutar),
            }
        });
        revalidatePath("/dashboard/hgs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteHgs(id: string) {
    try {
        await (prisma as any).hgsYukleme.delete({ where: { id } });
        revalidatePath("/dashboard/hgs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
