"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope"
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency"

const PATH = "/dashboard/hgs";
const ARACLAR_PATH = "/dashboard/araclar";

function revalidateHgsPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

export async function createHgs(data: {
    aracId: string;
    tarih: string;
    etiketNo: string;
    tutar: number;
    km?: number;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
        });
        const normalizedKm =
            data.km !== undefined
                ? await assertKmWriteConsistency({
                    aracId: arac.id,
                    km: data.km,
                    fieldLabel: "HGS KM",
                    tx: prisma,
                })
                : null;

        await (prisma as any).hgsYukleme.create({
            data: {
                aracId: arac.id,
                tarih: new Date(data.tarih),
                etiketNo: data.etiketNo || null,
                tutar: Number(data.tutar),
                km: normalizedKm,
                sirketId: arac.sirketId
            }
        });

        await syncAracGuncelKm(arac.id, prisma);

        revalidateHgsPages(arac.id);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateHgs(id: string, data: {
    aracId: string;
    tarih: string;
    etiketNo: string;
    tutar: number;
    km?: number;
}) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "hgsYukleme",
            filterModel: "hgs",
            id,
            select: { aracId: true, sirketId: true, km: true },
            errorMessage: "HGS kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true });
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
                    fieldLabel: "HGS KM",
                    currentRecord: { aracId: mevcutKayit.aracId, km: mevcutKayit.km },
                    tx: prisma,
                })
                : null;

        await (prisma as any).hgsYukleme.update({
            where: { id },
            data: {
                aracId: arac.id,
                tarih: new Date(data.tarih),
                etiketNo: data.etiketNo || null,
                tutar: Number(data.tutar),
                km: data.km !== undefined ? normalizedKm : undefined,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
            }
        });

        await syncAracGuncelKm(arac.id, prisma);

        revalidateHgsPages(arac.id);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteHgs(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "hgsYukleme",
            filterModel: "hgs",
            id,
            select: { aracId: true },
            errorMessage: "HGS kaydi bulunamadi veya yetkiniz yok.",
        });

        await (prisma as any).hgsYukleme.delete({ where: { id } });
        revalidateHgsPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
