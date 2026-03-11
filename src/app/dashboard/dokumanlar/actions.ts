"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";

const PATH = '/dashboard/dokumanlar';

export async function createDokuman(data: {
    ad: string;
    dosyaUrl: string;
    tur: any;
    aracId: string;
}) {
    try {
        await prisma.dokuman.create({
            data: {
                ad: data.ad,
                dosyaUrl: data.dosyaUrl,
                tur: data.tur,
                aracId: data.aracId || null
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (error) {
        console.error("Doküman eklenirken hata:", error);
        return { success: false, error: "Doküman eklenirken bir hata oluştu." };
    }
}

export async function deleteDokuman(id: string) {
    try {
        await prisma.dokuman.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (error) {
        console.error("Doküman silinirken hata:", error);
        return { success: false, error: "Doküman silinirken bir hata oluştu." };
    }
}
