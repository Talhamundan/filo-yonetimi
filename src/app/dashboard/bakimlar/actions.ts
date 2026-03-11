"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

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
        await prisma.bakim.create({
            data: {
                aracId: data.aracId || null,
                bakimTarihi: data.bakimTarihi,
                yapilanKm: data.yapilanKm,
                tur: data.tur,
                servisAdi: data.servisAdi,
                yapilanIslemler: data.yapilanIslemler,
                tutar: data.tutar,
            }
        });

        // Also update the vehicle's current KM if the maintenance KM is higher
        const arac = await prisma.arac.findUnique({
            where: { id: data.aracId },
            select: { guncelKm: true }
        });

        if (arac && data.yapilanKm > arac.guncelKm) {
            await prisma.arac.update({
                where: { id: data.aracId },
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
        await prisma.bakim.update({
            where: { id },
            data: {
                aracId: data.aracId || null,
                bakimTarihi: data.bakimTarihi,
                yapilanKm: data.yapilanKm,
                tur: data.tur,
                servisAdi: data.servisAdi,
                yapilanIslemler: data.yapilanIslemler,
                tutar: data.tutar,
            }
        });

        revalidatePath('/dashboard/bakimlar');
        return { success: true };
    } catch (error) {
        console.error("Bakım güncellenirken hata:", error);
        return { success: false, error: "Bakım güncellenirken bir hata oluştu." };
    }
}

export async function deleteBakim(id: string) {
    try {
        await prisma.bakim.delete({ where: { id } });
        revalidatePath('/dashboard/bakimlar');
        return { success: true };
    } catch (error) {
        console.error("Bakım silinirken hata:", error);
        return { success: false, error: "Bakım silinirken bir hata oluştu." };
    }
}
