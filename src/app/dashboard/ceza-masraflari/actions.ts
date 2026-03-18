"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import {
    assertAuthenticatedUser,
    getScopedAracOrThrow,
    getScopedKullaniciOrThrow,
    getScopedRecordOrThrow,
} from "@/lib/action-scope";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";
import { ensureCezaFineTrackingColumns, isCezaSchemaCompatibilityError } from "@/lib/ceza-schema-compat";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";

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
        const actor = await assertAuthenticatedUser();
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
                    enforceMaxKnownKm: false,
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
        let created: { id: string; plaka: string | null; sirketId: string | null; cezaMaddesi: string; tutar: number; tarih: Date; aracId: string; soforId?: string | null } | null = null;

        try {
            created = await (prisma as any).ceza.create({
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
                created = await (prisma as any).ceza.create({
                    data: {
                        ...baseData,
                        km: normalizedKm,
                        sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                        odendiMi: Boolean(data.odendiMi),
                    },
                });
            } else {
            console.warn("Ceza kaydi genis alanlarla olusturulamadi, temel alanlarla yeniden deneniyor.", error);
            created = await (prisma as any).ceza.create({ data: baseData });
            }
        }

        if (created) {
            await logEntityActivity({
                actionType: ActivityActionType.CREATE,
                entityType: ActivityEntityType.CEZA,
                entityId: created.id,
                summary: `${created.plaka || "Bilinmeyen plaka"} için ceza kaydı eklendi.`,
                actor,
                companyId: created.sirketId || actor.sirketId || null,
                metadata: {
                    cezaMaddesi: created.cezaMaddesi,
                    tutar: created.tutar,
                    tarih: created.tarih,
                    aracId: created.aracId,
                    soforId: created.soforId || null,
                },
            });
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
        const actor = await assertAuthenticatedUser();
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
                    enforceMaxKnownKm: false,
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
        let updated: { id: string; plaka: string | null; sirketId: string | null; cezaMaddesi: string; tutar: number; tarih: Date; aracId: string; soforId?: string | null } | null = null;

        try {
            updated = await (prisma as any).ceza.update({
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
                updated = await (prisma as any).ceza.update({
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
            updated = await (prisma as any).ceza.update({
                where: { id },
                data: baseData,
            });
            }
        }

        if (updated) {
            await logEntityActivity({
                actionType: ActivityActionType.UPDATE,
                entityType: ActivityEntityType.CEZA,
                entityId: updated.id,
                summary: `${updated.plaka || "Bilinmeyen plaka"} için ceza kaydı güncellendi.`,
                actor,
                companyId: updated.sirketId || actor.sirketId || null,
                metadata: {
                    cezaMaddesi: updated.cezaMaddesi,
                    tutar: updated.tutar,
                    tarih: updated.tarih,
                    aracId: updated.aracId,
                    soforId: updated.soforId || null,
                },
            });
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
        const actor = await assertAuthenticatedUser();
        await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            select: { plaka: true, sirketId: true, cezaMaddesi: true, tutar: true, tarih: true, aracId: true },
            errorMessage: "Ceza kaydi bulunamadi veya yetkiniz yok.",
        });

        await softDeleteEntity("ceza", id, actor.id);
        revalidateCezaPages();
        return { success: true };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: error?.message || "Ceza kaydı çöp kutusuna taşınamadı." };
    }
}
