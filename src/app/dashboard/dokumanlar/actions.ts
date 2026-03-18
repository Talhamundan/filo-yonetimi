"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

const PATH = '/dashboard/dokumanlar';
const ARACLAR_PATH = '/dashboard/araclar';

function revalidateDokumanPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

export async function createDokuman(data: {
    ad: string;
    dosyaUrl: string;
    tur: any;
    aracId: string;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
        });

        await prisma.dokuman.create({
            data: {
                ad: data.ad,
                dosyaUrl: data.dosyaUrl,
                tur: data.tur,
                aracId: arac.id,
                sirketId: arac.sirketId,
            }
        });
        revalidateDokumanPages(arac.id);
        return { success: true };
    } catch (error) {
        console.error("Doküman eklenirken hata:", error);
        return { success: false, error: "Doküman eklenirken bir hata oluştu." };
    }
}

export async function deleteDokuman(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "dokuman",
            filterModel: "dokuman",
            id,
            select: { aracId: true },
            errorMessage: "Dokuman bulunamadi veya yetkiniz yok.",
        });

        await prisma.dokuman.delete({ where: { id } });
        revalidateDokumanPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (error) {
        console.error("Doküman silinirken hata:", error);
        return { success: false, error: "Doküman silinirken bir hata oluştu." };
    }
}
