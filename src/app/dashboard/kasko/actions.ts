"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

const PATH = '/dashboard/kasko';

export async function createKasko(data: {
    aracId: string;
    sirket?: string;
    policeNo?: string;
    baslangicTarihi: string;
    bitisTarihi: string;
    tutar?: number;
    aktifMi?: boolean;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
        });

        await prisma.kasko.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                sirket: data.sirket || null,
                policeNo: data.policeNo || null,
                baslangicTarihi: new Date(data.baslangicTarihi),
                bitisTarihi: new Date(data.bitisTarihi),
                tutar: data.tutar ? Number(data.tutar) : null,
                aktifMi: data.aktifMi ?? true,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Kasko kaydı oluşturulamadı." };
    }
}

export async function updateKasko(id: string, data: any) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "kasko",
            filterModel: "kasko",
            id,
            select: { aracId: true, sirketId: true },
            errorMessage: "Kasko kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true });

        await prisma.kasko.update({
            where: { id },
            data: {
                ...data,
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                baslangicTarihi: data.baslangicTarihi ? new Date(data.baslangicTarihi) : undefined,
                bitisTarihi: data.bitisTarihi ? new Date(data.bitisTarihi) : undefined,
                tutar: data.tutar ? Number(data.tutar) : undefined,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Kasko kaydı güncellenemedi." };
    }
}

export async function deleteKasko(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "kasko",
            filterModel: "kasko",
            id,
            errorMessage: "Kasko kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.kasko.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Kasko kaydı silinemedi." };
    }
}
