"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

const PATH = '/dashboard/arizalar';

export async function createAriza(data: {
    aracId: string;
    aciklama: string;
    arizaTarihi: string;
    durum: string;
    servis?: string;
    tahminiTutar?: number;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
        });

        await prisma.ariza.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                aciklama: data.aciklama,
                arizaTarihi: new Date(data.arizaTarihi),
                durum: data.durum as any,
                servis: data.servis || null,
                tahminiTutar: data.tahminiTutar ? Number(data.tahminiTutar) : null,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Arıza kaydı oluşturulamadı." };
    }
}

export async function updateAriza(id: string, data: any) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "ariza",
            filterModel: "ariza",
            id,
            select: { aracId: true, sirketId: true },
            errorMessage: "Ariza kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true })
            : null;

        await prisma.ariza.update({
            where: { id },
            data: {
                ...data,
                aracId: arac?.id || mevcutKayit.aracId,
                sirketId: arac?.sirketId || mevcutKayit.sirketId,
                arizaTarihi: data.arizaTarihi ? new Date(data.arizaTarihi) : undefined,
                durum: data.durum ? (data.durum as any) : undefined,
                tahminiTutar: data.tahminiTutar !== undefined ? (data.tahminiTutar ? Number(data.tahminiTutar) : null) : undefined,
            }
        });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Arıza kaydı güncellenemedi." };
    }
}

export async function deleteAriza(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "ariza",
            filterModel: "ariza",
            id,
            errorMessage: "Ariza kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.ariza.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Arıza kaydı silinemedi." };
    }
}
