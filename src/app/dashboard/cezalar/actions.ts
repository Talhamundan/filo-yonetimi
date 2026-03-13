"use server";
import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";

const PATH = '/dashboard/cezalar';

export async function createCeza(data: { aracId: string; kullaniciId?: string; tutar: number; km?: number; aciklama: string; cezaTarihi: Date; sonOdemeTarihi?: Date | null; odendiMi?: boolean }) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            guncelKm: true,
        });
        const kullanici = data.kullaniciId
            ? await getScopedKullaniciOrThrow(data.kullaniciId, { id: true, sirketId: true })
            : null;

        if (kullanici && kullanici.sirketId !== arac.sirketId) {
            throw new Error("Secilen sofor arac ile ayni sirkete ait degil.");
        }

        await prisma.ceza.create({
            data: {
                aracId: arac.id,
                kullaniciId: kullanici?.id || null,
                sirketId: arac.sirketId,
                tutar: data.tutar,
                km: data.km ? Number(data.km) : null,
                aciklama: data.aciklama,
                cezaTarihi: new Date(data.cezaTarihi),
                sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                odendiMi: data.odendiMi || false
            }
        });

        // Araç KM güncelleme mantığı
        if (data.km) {
            if (Number(data.km) > arac.guncelKm) {
                await prisma.arac.update({
                    where: { id: arac.id },
                    data: { guncelKm: Number(data.km) }
                });
            }
        }

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza kaydedilemedi." };
    }
}

export async function updateCeza(id: string, data: { aracId: string; kullaniciId?: string; tutar: number; km?: number; aciklama: string; cezaTarihi: Date; sonOdemeTarihi?: Date | null; odendiMi: boolean }) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            errorMessage: "Ceza kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            guncelKm: true,
        });
        const kullanici = data.kullaniciId
            ? await getScopedKullaniciOrThrow(data.kullaniciId, { id: true, sirketId: true })
            : null;

        if (kullanici && kullanici.sirketId !== arac.sirketId) {
            throw new Error("Secilen sofor arac ile ayni sirkete ait degil.");
        }

        await prisma.ceza.update({
            where: { id },
            data: {
                aracId: arac.id,
                kullaniciId: kullanici?.id || null,
                sirketId: arac.sirketId,
                tutar: data.tutar,
                km: data.km ? Number(data.km) : null,
                aciklama: data.aciklama,
                cezaTarihi: new Date(data.cezaTarihi),
                sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                odendiMi: data.odendiMi
            }
        });

        // Araç KM güncelleme mantığı
        if (data.km) {
            if (Number(data.km) > arac.guncelKm) {
                await prisma.arac.update({
                    where: { id: arac.id },
                    data: { guncelKm: Number(data.km) }
                });
            }
        }

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza güncellenemedi." };
    }
}

export async function deleteCeza(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            errorMessage: "Ceza kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.ceza.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza silinemedi." };
    }
}
