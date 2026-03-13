"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

const PATH = '/dashboard/zimmetler';

export async function createZimmet(data: {
    aracId: string;
    kullaniciId: string;
    baslangic: string;
    baslangicKm: number;
    notlar?: string;
}) {
    try {
        await assertAuthenticatedUser();
        const aracId = data.aracId || null;
        const kullaniciId = data.kullaniciId || null;

        if (!aracId) throw new Error("Araç ID zorunludur.");
        const arac = await getScopedAracOrThrow(aracId, {
            id: true,
            sirketId: true,
            guncelKm: true,
        });
        const kullanici = kullaniciId
            ? await getScopedKullaniciOrThrow(kullaniciId, { id: true, sirketId: true })
            : null;

        if (kullanici && kullanici.sirketId !== arac.sirketId) {
            throw new Error("Secilen personel arac ile ayni sirkete ait degil.");
        }

        // 1. Önce bu araçtaki mevcut aktif zimmetleri kapat
        await prisma.kullaniciZimmet.updateMany({
            where: { aracId: arac.id, bitis: null },
            data: { 
                bitis: new Date(data.baslangic),
                bitisKm: Number(data.baslangicKm)
            }
        });

        // 2. Aracı yeni şoföre ata (Arac tablosunu güncelle)
        await prisma.arac.update({
            where: { id: arac.id },
            data: { kullaniciId: kullanici?.id || null }
        });

        // 3. Yeni zimmet kaydı oluştur
        await prisma.kullaniciZimmet.create({
            data: {
                aracId: arac.id,
                kullaniciId: kullanici?.id as any,
                baslangic: new Date(data.baslangic),
                baslangicKm: Number(data.baslangicKm),
                notlar: data.notlar || null
            }
        });

        // 4. Aracın güncel KM'sini güncelle (eğer yeni KM mevcut olandan büyükse)
        if (Number(data.baslangicKm) > arac.guncelKm) {
            await prisma.arac.update({
                where: { id: arac.id },
                data: { guncelKm: Number(data.baslangicKm) }
            });
        }

        revalidatePath(PATH);
        revalidatePath('/dashboard/araclar');
        revalidatePath('/dashboard/personel');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Zimmet kaydı oluşturulamadı." };
    }
}

export async function deleteZimmet(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "kullaniciZimmet",
            filterModel: "kullaniciZimmet",
            id,
            errorMessage: "Zimmet kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.kullaniciZimmet.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Zimmet kaydı silinemedi." };
    }
}
