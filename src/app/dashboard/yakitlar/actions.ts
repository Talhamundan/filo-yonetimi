"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";

const PATH = '/dashboard/yakitlar';
const ARACLAR_PATH = '/dashboard/araclar';

function revalidateYakitPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

export async function createYakit(data: {
    aracId: string;
    tarih: string;
    litre: number;
    tutar: number;
    km: number;
    soforId?: string;
    istasyon?: string;
    odemeYontemi?: string;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            kullaniciId: true,
        });
        const sofor = data.soforId
            ? await getScopedKullaniciOrThrow(data.soforId, { id: true })
            : null;
        const km = await assertKmWriteConsistency({
            aracId: arac.id,
            km: data.km,
            fieldLabel: "Yakit KM",
        });

        await prisma.yakit.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                tarih: new Date(data.tarih),
                litre: Number(data.litre),
                tutar: Number(data.tutar),
                km: Number(km),
                soforId: sofor?.id ?? arac.kullaniciId ?? null,
                istasyon: data.istasyon || null,
                odemeYontemi: (data.odemeYontemi as any) || 'NAKIT',
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateYakitPages(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Yakıt kaydı oluşturulamadı." };
    }
}

export async function updateYakit(id: string, data: any) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "yakit",
            filterModel: "yakit",
            id,
            select: { aracId: true, sirketId: true, km: true, soforId: true },
            errorMessage: "Yakit kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true, kullaniciId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true, kullaniciId: true });
        const sofor = data.soforId
            ? await getScopedKullaniciOrThrow(data.soforId, { id: true })
            : null;

        const kmInput =
            data.km !== undefined
                ? data.km
                : data.aracId && data.aracId !== mevcutKayit.aracId
                    ? mevcutKayit.km
                    : undefined;

        const normalizedKm =
            kmInput !== undefined
                ? await assertKmWriteConsistency({
                    aracId: arac.id,
                    km: kmInput,
                    fieldLabel: "Yakit KM",
                    currentRecord: { aracId: mevcutKayit.aracId, km: mevcutKayit.km },
                })
                : null;
        const vehicleChanged = Boolean(data.aracId && data.aracId !== mevcutKayit.aracId);
        const resolvedSoforId =
            sofor?.id ??
            (vehicleChanged ? (arac.kullaniciId ?? null) : (mevcutKayit.soforId ?? null));

        await prisma.yakit.update({
            where: { id },
            data: {
                ...data,
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                tarih: data.tarih ? new Date(data.tarih) : undefined,
                litre: data.litre ? Number(data.litre) : undefined,
                tutar: data.tutar ? Number(data.tutar) : undefined,
                km: data.km !== undefined ? Number(normalizedKm) : undefined,
                soforId: resolvedSoforId,
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateYakitPages(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Yakıt kaydı güncellenemedi." };
    }
}

export async function deleteYakit(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "yakit",
            filterModel: "yakit",
            id,
            select: { aracId: true },
            errorMessage: "Yakit kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.yakit.delete({ where: { id } });
        revalidateYakitPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Yakıt kaydı silinemedi." };
    }
}
