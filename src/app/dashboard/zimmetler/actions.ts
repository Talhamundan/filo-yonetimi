"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";

const PATH = '/dashboard/zimmetler';
const ARACLAR_PATH = '/dashboard/araclar';
const PERSONEL_PATH = '/dashboard/personel';

function revalidateZimmetPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    revalidatePath(PERSONEL_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

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
        });
        const kullanici = kullaniciId
            ? await getScopedKullaniciOrThrow(kullaniciId, { id: true, sirketId: true })
            : null;
        const baslangicKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: data.baslangicKm,
            fieldLabel: "Zimmet Teslim KM",
        });

        // 1. Önce bu araçtaki mevcut aktif zimmetleri kapat
        await prisma.kullaniciZimmet.updateMany({
            where: { aracId: arac.id, bitis: null },
            data: { 
                bitis: new Date(data.baslangic),
                bitisKm: Number(baslangicKm)
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
                baslangicKm: Number(baslangicKm),
                notlar: data.notlar || null
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateZimmetPages(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Zimmet kaydı oluşturulamadı." };
    }
}

export async function deleteZimmet(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "kullaniciZimmet",
            filterModel: "kullaniciZimmet",
            id,
            select: { aracId: true },
            errorMessage: "Zimmet kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.kullaniciZimmet.delete({ where: { id } });
        revalidateZimmetPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Zimmet kaydı silinemedi." };
    }
}

export async function updateZimmet(id: string, data: {
    baslangic: string;
    bitis?: string | null;
    baslangicKm: number;
    bitisKm?: number | null;
    notlar?: string | null;
}) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "kullaniciZimmet",
            filterModel: "kullaniciZimmet",
            id,
            select: { aracId: true, baslangicKm: true, bitisKm: true },
            errorMessage: "Zimmet kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = await getScopedAracOrThrow(kayit.aracId, {
            id: true,
        });

        const baslangic = new Date(data.baslangic);
        const bitis = data.bitis ? new Date(data.bitis) : null;
        if (Number.isNaN(baslangic.getTime())) {
            throw new Error("Gecersiz baslangic tarihi");
        }
        if (bitis && Number.isNaN(bitis.getTime())) {
            throw new Error("Gecersiz bitis tarihi");
        }
        if (bitis && bitis < baslangic) {
            throw new Error("Bitiş tarihi başlangıç tarihinden önce olamaz.");
        }

        const baslangicKm = Number(data.baslangicKm);
        const bitisKm = data.bitisKm !== null && data.bitisKm !== undefined ? Number(data.bitisKm) : null;
        if (Number.isNaN(baslangicKm)) {
            throw new Error("Gecersiz baslangic KM");
        }
        if (bitisKm !== null && Number.isNaN(bitisKm)) {
            throw new Error("Gecersiz bitis KM");
        }
        const normalizedBaslangicKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: baslangicKm,
            fieldLabel: "Zimmet Teslim KM",
            currentRecord: { aracId: kayit.aracId, km: kayit.baslangicKm },
        });
        const normalizedBitisKm =
            bitisKm !== null
                ? await assertKmWriteConsistency({
                    aracId: arac.id,
                    km: bitisKm,
                    fieldLabel: "Zimmet Iade KM",
                    currentRecord: { aracId: kayit.aracId, km: kayit.bitisKm },
                })
                : null;
        if (
            normalizedBitisKm !== null &&
            normalizedBaslangicKm !== null &&
            normalizedBitisKm < normalizedBaslangicKm
        ) {
            throw new Error("Iade KM, teslim KM'den kucuk olamaz.");
        }

        await prisma.kullaniciZimmet.update({
            where: { id },
            data: {
                baslangic,
                bitis,
                baslangicKm: Number(normalizedBaslangicKm),
                bitisKm: normalizedBitisKm,
                notlar: data.notlar || null,
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateZimmetPages(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Zimmet kaydı güncellenemedi." };
    }
}
