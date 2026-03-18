"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
    assertAuthenticatedUser,
    getScopedAracOrThrow,
    getScopedKullaniciOrThrow,
    getScopedRecordOrThrow,
} from "@/lib/action-scope";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";
import { ensureCezaFineTrackingColumns, isCezaSchemaCompatibilityError } from "@/lib/ceza-schema-compat";

const PATH = "/dashboard/ceza-masraflari";

type CezaMasrafPayload = {
    aracId: string;
    soforId?: string | null;
    tarih: string | Date;
    cezaMaddesi: string;
    tutar: number;
    km?: number | null;
    sonOdemeTarihi?: string | Date | null;
    odendiMi?: boolean;
    aciklama?: string | null;
};

function revalidateCezaPages() {
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/cezalar");
}

export async function createCezaMasraf(data: CezaMasrafPayload) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
        });

        const sofor = data.soforId
            ? await getScopedKullaniciOrThrow(data.soforId, { id: true, sirketId: true })
            : null;
        const normalizedKm =
            data.km !== undefined
                ? await assertKmWriteConsistency({
                    aracId: arac.id,
                    km: data.km,
                    fieldLabel: "Ceza KM",
                    tx: prisma,
                })
                : null;

        const baseData = {
            plaka: arac.plaka,
            aracId: arac.id,
            soforId: sofor?.id || null,
            tarih: new Date(data.tarih),
            cezaMaddesi: data.cezaMaddesi?.trim() || "Belirtilmedi",
            tutar: Number(data.tutar) || 0,
            aciklama: data.aciklama?.trim() || null,
            sirketId: arac.sirketId,
        };

        try {
            await (prisma as any).ceza.create({
                data: {
                    ...baseData,
                    km: normalizedKm,
                    sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                    odendiMi: Boolean(data.odendiMi),
                },
            });
        } catch (error) {
            if (isCezaSchemaCompatibilityError(error)) {
                await ensureCezaFineTrackingColumns();
                await (prisma as any).ceza.create({
                    data: {
                        ...baseData,
                        km: normalizedKm,
                        sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                        odendiMi: Boolean(data.odendiMi),
                    },
                });
            } else {
            console.warn("Ceza kaydi genis alanlarla olusturulamadi, temel alanlarla yeniden deneniyor.", error);
            await (prisma as any).ceza.create({ data: baseData });
            }
        }

        await syncAracGuncelKm(arac.id, prisma);
        revalidateCezaPages();
        return { success: true };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: error?.message || "Ceza kaydi olusturulamadi." };
    }
}

export async function updateCezaMasraf(id: string, data: CezaMasrafPayload) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            select: { aracId: true, km: true },
            errorMessage: "Ceza kaydi bulunamadi veya yetkiniz yok.",
        });

        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
        });

        const sofor = data.soforId
            ? await getScopedKullaniciOrThrow(data.soforId, { id: true, sirketId: true })
            : null;
        const kmInput =
            data.km !== undefined
                ? data.km
                : data.aracId !== mevcutKayit.aracId
                    ? mevcutKayit.km
                    : undefined;
        const normalizedKm =
            kmInput !== undefined
                ? await assertKmWriteConsistency({
                    aracId: arac.id,
                    km: kmInput,
                    fieldLabel: "Ceza KM",
                    currentRecord: { aracId: mevcutKayit.aracId, km: mevcutKayit.km },
                    tx: prisma,
                })
                : null;

        const baseData = {
            plaka: arac.plaka,
            aracId: arac.id,
            soforId: sofor?.id || null,
            tarih: new Date(data.tarih),
            cezaMaddesi: data.cezaMaddesi?.trim() || "Belirtilmedi",
            tutar: Number(data.tutar) || 0,
            aciklama: data.aciklama?.trim() || null,
            sirketId: arac.sirketId,
        };

        try {
            await (prisma as any).ceza.update({
                where: { id },
                data: {
                    ...baseData,
                    km: data.km !== undefined ? normalizedKm : undefined,
                    sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                    odendiMi: Boolean(data.odendiMi),
                },
            });
        } catch (error) {
            if (isCezaSchemaCompatibilityError(error)) {
                await ensureCezaFineTrackingColumns();
                await (prisma as any).ceza.update({
                    where: { id },
                    data: {
                        ...baseData,
                        km: data.km !== undefined ? normalizedKm : undefined,
                        sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                        odendiMi: Boolean(data.odendiMi),
                    },
                });
            } else {
            console.warn("Ceza kaydi genis alanlarla guncellenemedi, temel alanlarla yeniden deneniyor.", error);
            await (prisma as any).ceza.update({
                where: { id },
                data: baseData,
            });
            }
        }

        await syncAracGuncelKm(arac.id, prisma);
        revalidateCezaPages();
        return { success: true };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: error?.message || "Ceza kaydi guncellenemedi." };
    }
}

export async function deleteCezaMasraf(id: string) {
    try {
        await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            errorMessage: "Ceza kaydi bulunamadi veya yetkiniz yok.",
        });

        await (prisma as any).ceza.delete({ where: { id } });
        revalidateCezaPages();
        return { success: true };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: error?.message || "Ceza kaydi silinemedi." };
    }
}
