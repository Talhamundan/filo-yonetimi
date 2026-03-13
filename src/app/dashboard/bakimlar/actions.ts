"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

export async function addBakim(data: {
    aracId: string;
    bakimTarihi: Date;
    yapilanKm: number;
    tur: "PERIYODIK" | "ARIZA" | "KAPORTA";
    servisAdi?: string;
    yapilanIslemler?: string;
    tutar: number;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            guncelKm: true,
        });

        await prisma.bakim.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                bakimTarihi: data.bakimTarihi,
                yapilanKm: data.yapilanKm,
                tur: data.tur,
                servisAdi: data.servisAdi,
                yapilanIslemler: data.yapilanIslemler,
                tutar: data.tutar,
            }
        });

        // Also update the vehicle's current KM if the maintenance KM is higher
        if (data.yapilanKm > arac.guncelKm) {
            await prisma.arac.update({
                where: { id: arac.id },
                data: { guncelKm: data.yapilanKm }
            });
        }

        revalidatePath('/dashboard/bakimlar');
        return { success: true };
    } catch (error) {
        console.error("Bakım eklenirken hata:", error);
        return { success: false, error: "Bakım eklenirken bir hata oluştu." };
    }
}

export async function updateBakim(id: string, data: {
    aracId: string;
    bakimTarihi: Date;
    yapilanKm: number;
    tur: "PERIYODIK" | "ARIZA" | "KAPORTA";
    servisAdi?: string;
    yapilanIslemler?: string;
    tutar: number;
}) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "bakim",
            filterModel: "bakim",
            id,
            select: { aracId: true, sirketId: true },
            errorMessage: "Bakim kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true, guncelKm: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true, guncelKm: true });

        await prisma.bakim.update({
            where: { id },
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                bakimTarihi: data.bakimTarihi,
                yapilanKm: data.yapilanKm,
                tur: data.tur,
                servisAdi: data.servisAdi,
                yapilanIslemler: data.yapilanIslemler,
                tutar: data.tutar,
            }
        });

        // Also update the vehicle's current KM if the maintenance KM is higher
        if (data.yapilanKm > arac.guncelKm) {
            await prisma.arac.update({
                where: { id: arac.id },
                data: { guncelKm: data.yapilanKm }
            });
        }

        revalidatePath('/dashboard/bakimlar');
        return { success: true };
    } catch (error) {
        console.error("Bakım güncellenirken hata:", error);
        return { success: false, error: "Bakım güncellenirken bir hata oluştu." };
    }
}

export async function deleteBakim(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "bakim",
            filterModel: "bakim",
            id,
            errorMessage: "Bakim kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.bakim.delete({ where: { id } });
        revalidatePath('/dashboard/bakimlar');
        return { success: true };
    } catch (error) {
        console.error("Bakım silinirken hata:", error);
        return { success: false, error: "Bakım silinirken bir hata oluştu." };
    }
}
