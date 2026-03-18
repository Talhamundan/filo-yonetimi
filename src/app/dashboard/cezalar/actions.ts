"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { ensureCezaFineTrackingColumns, isCezaSchemaCompatibilityError } from "@/lib/ceza-schema-compat";

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
    soforId: string;
    tarih: string | Date;
    tutar: number;
    cezaMaddesi: string;
    aciklama?: string;
}

export async function createCeza(data: CezaPayload) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
        });
        const sofor = await getScopedKullaniciOrThrow(data.soforId, { id: true, sirketId: true });

        try {
            await prisma.ceza.create({
                data: {
                    plaka: arac.plaka,
                    aracId: arac.id,
                    soforId: sofor.id,
                    tarih: new Date(data.tarih),
                    tutar: Number(data.tutar),
                    cezaMaddesi: data.cezaMaddesi,
                    aciklama: data.aciklama || null,
                    sirketId: arac.sirketId,
                }
            });
        } catch (error) {
            if (isCezaSchemaCompatibilityError(error)) {
                await ensureCezaFineTrackingColumns();
                await prisma.ceza.create({
                    data: {
                        plaka: arac.plaka,
                        aracId: arac.id,
                        soforId: sofor.id,
                        tarih: new Date(data.tarih),
                        tutar: Number(data.tutar),
                        cezaMaddesi: data.cezaMaddesi,
                        aciklama: data.aciklama || null,
                        sirketId: arac.sirketId,
                    }
                });
            } else {
                throw error;
            }
        }

        revalidateCezaRelatedPaths([arac.id]);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza kaydı oluşturulamadı." };
    }
}

export async function updateCeza(id: string, data: CezaPayload) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            select: { aracId: true },
            errorMessage: "Ceza kaydı bulunamadı veya yetkiniz yok.",
        });

        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
        });
        const sofor = await getScopedKullaniciOrThrow(data.soforId, { id: true, sirketId: true });

        try {
            await prisma.ceza.update({
                where: { id },
                data: {
                    plaka: arac.plaka,
                    aracId: arac.id,
                    soforId: sofor.id,
                    tarih: new Date(data.tarih),
                    tutar: Number(data.tutar),
                    cezaMaddesi: data.cezaMaddesi,
                    aciklama: data.aciklama || null,
                    sirketId: arac.sirketId,
                }
            });
        } catch (error) {
            if (isCezaSchemaCompatibilityError(error)) {
                await ensureCezaFineTrackingColumns();
                await prisma.ceza.update({
                    where: { id },
                    data: {
                        plaka: arac.plaka,
                        aracId: arac.id,
                        soforId: sofor.id,
                        tarih: new Date(data.tarih),
                        tutar: Number(data.tutar),
                        cezaMaddesi: data.cezaMaddesi,
                        aciklama: data.aciklama || null,
                        sirketId: arac.sirketId,
                    }
                });
            } else {
                throw error;
            }
        }

        revalidateCezaRelatedPaths([(mevcutKayit as { aracId?: string } | null)?.aracId, arac.id]);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza kaydı güncellenemedi." };
    }
}

export async function deleteCeza(id: string) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "ceza",
            filterModel: "ceza",
            id,
            select: { aracId: true },
            errorMessage: "Ceza kaydı bulunamadı veya yetkiniz yok.",
        });

        await prisma.ceza.delete({ where: { id } });
        revalidateCezaRelatedPaths([(mevcutKayit as { aracId?: string } | null)?.aracId]);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Ceza kaydı silinemedi." };
    }
}
