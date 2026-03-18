"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

const PATH = '/dashboard/masraflar';
const ARACLAR_PATH = '/dashboard/araclar';

function revalidateMasrafPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath('/dashboard');
    revalidatePath(ARACLAR_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

export async function createMasraf(data: {
    aracId: string;
    tarih: string;
    tur: string;
    tutar: number;
    aciklama?: string;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
        });

        await prisma.masraf.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                tarih: new Date(data.tarih),
                tur: data.tur as any,
                tutar: Number(data.tutar),
                aciklama: data.aciklama || null,
            }
        });
        revalidateMasrafPages(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı oluşturulamadı." };
    }
}

export async function updateMasraf(id: string, data: any) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "masraf",
            filterModel: "masraf",
            id,
            select: { aracId: true, sirketId: true },
            errorMessage: "Masraf kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true });

        await prisma.masraf.update({
            where: { id },
            data: {
                ...data,
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                tur: data.tur ? (data.tur as any) : undefined,
                tarih: data.tarih ? new Date(data.tarih) : undefined,
                tutar: data.tutar ? Number(data.tutar) : undefined,
            }
        });
        revalidateMasrafPages(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı güncellenemedi." };
    }
}

export async function deleteMasraf(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "masraf",
            filterModel: "masraf",
            id,
            select: { aracId: true },
            errorMessage: "Masraf kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.masraf.delete({ where: { id } });
        revalidateMasrafPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Masraf kaydı silinemedi." };
    }
}
