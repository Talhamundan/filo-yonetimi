"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { ensureCezaFineTrackingColumns, isCezaSchemaCompatibilityError } from "@/lib/ceza-schema-compat";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";
import { resolveVehicleUsageCompanyId } from "@/lib/vehicle-usage-company";

const PATH = "/dashboard/cezalar";
const DASHBOARD_PATH = "/dashboard";
const EVRAK_PATH = "/dashboard/evrak-takip";
const ARACLAR_PATH = "/dashboard/araclar";

function revalidateCezaRelatedPaths(aracIds?: Array<string | null | undefined>) {
    revalidatePath(PATH);
    revalidatePath(DASHBOARD_PATH);
    revalidatePath(EVRAK_PATH);
    revalidatePath(ARACLAR_PATH);
    for (const aracId of aracIds || []) {
        if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    }
}

type CezaPayload = {
    aracId: string;
    soforId?: string | null;
    tarih: string | Date;
    tutar: number;
    cezaMaddesi: string;
    aciklama?: string;
    sonOdemeTarihi?: string | Date | null;
    odendiMi?: boolean;
}

export async function createCeza(data: CezaPayload) {
    try {
        const actor = await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
        });
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id
        });

        let soforId: string | null = null;
        if (data.soforId && data.soforId !== "NON_SELECTABLE") {
            const sofor = await getScopedKullaniciOrThrow(data.soforId, { id: true });
            soforId = sofor.id;
        }

        let created: { id: string; sirketId: string | null; plaka: string | null; tarih: Date; tutar: number; cezaMaddesi: string; aracId: string; soforId: string | null } | null = null;

        try {
            created = await prisma.ceza.create({
                data: {
                    plaka: arac.plaka,
                    aracId: arac.id,
                    soforId: soforId,
                    tarih: new Date(data.tarih),
                    tutar: Number(data.tutar),
                    cezaMaddesi: data.cezaMaddesi,
                    aciklama: data.aciklama || null,
                    sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                    odendiMi: data.odendiMi ?? false,
                    sirketId: usageSirketId,
                }
            });
        } catch (error) {
            if (isCezaSchemaCompatibilityError(error)) {
                await ensureCezaFineTrackingColumns();
                created = await prisma.ceza.create({
                    data: {
                        plaka: arac.plaka,
                        aracId: arac.id,
                        soforId: soforId,
                        tarih: new Date(data.tarih),
                        tutar: Number(data.tutar),
                        cezaMaddesi: data.cezaMaddesi,
                        aciklama: data.aciklama || null,
                        sonOdemeTarihi: data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null,
                        odendiMi: data.odendiMi ?? false,
                        sirketId: usageSirketId,
                    }
                });
            } else {
                throw error;
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
                    soforId: created.soforId,
                },
            });
        }

        revalidateCezaRelatedPaths([arac.id]);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza kaydı oluşturulamadı." };
    }
}

export async function updateCeza(id: string, data: Partial<CezaPayload>) {
    try {
        const actor = await assertAuthenticatedUser();
        const ceza = await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            select: { id: true, aracId: true, soforId: true },
            errorMessage: "Ceza kaydı bulunamadı veya yetkiniz yok.",
        });

        // Always resolve arac if it's changing or if we need plaka/usageCompany
        const targetAracId = data.aracId || ceza.aracId;
        const arac = await getScopedAracOrThrow(targetAracId, { id: true, plaka: true, sirketId: true });

        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id
        });

        let soforId = ceza.soforId;
        if (data.soforId !== undefined) {
             if (data.soforId && data.soforId !== "NON_SELECTABLE") {
                 const sId = data.soforId;
                 const sofor = await getScopedKullaniciOrThrow(sId, { id: true });
                 soforId = sofor.id;
             } else {
                 soforId = null;
             }
        }

        let updated;
        const updateData = {
            plaka: arac.plaka,
            aracId: arac.id,
            soforId: soforId,
            tarih: data.tarih ? new Date(data.tarih) : undefined,
            tutar: data.tutar !== undefined ? Number(data.tutar) : undefined,
            cezaMaddesi: data.cezaMaddesi || undefined,
            aciklama: data.aciklama !== undefined ? data.aciklama : undefined,
            sonOdemeTarihi: data.sonOdemeTarihi !== undefined ? (data.sonOdemeTarihi ? new Date(data.sonOdemeTarihi) : null) : undefined,
            odendiMi: data.odendiMi !== undefined ? data.odendiMi : undefined,
            sirketId: usageSirketId,
        };

        try {
            updated = await prisma.ceza.update({
                where: { id: ceza.id },
                data: updateData
            });
        } catch (error) {
            if (isCezaSchemaCompatibilityError(error)) {
                await ensureCezaFineTrackingColumns();
                updated = await prisma.ceza.update({
                    where: { id: ceza.id },
                    data: updateData
                });
            } else {
                throw error;
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
                    soforId: updated.soforId,
                },
            });
        }

        revalidateCezaRelatedPaths([ceza.aracId, arac.id]);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza kaydı güncellenemedi." };
    }
}

export async function deleteCeza(id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            select: { aracId: true, sirketId: true, plaka: true, cezaMaddesi: true, tutar: true, tarih: true },
            errorMessage: "Ceza kaydı bulunamadı veya yetkiniz yok.",
        });

        await softDeleteEntity("ceza", id, actor.id);
        revalidateCezaRelatedPaths([(mevcutKayit as { aracId?: string } | null)?.aracId]);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza kaydı çöp kutusuna taşınamadı." };
    }
}
