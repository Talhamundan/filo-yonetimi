"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { normalizeKmInput, syncAracGuncelKm } from "@/lib/km-consistency";
import { ensureMuayeneColumns, isMuayeneOptionalFieldCompatibilityError } from "@/lib/muayene-schema-compat";

const PATH = '/dashboard/muayeneler';
const EVRAK_PATH = "/dashboard/evrak-takip";
const ARACLAR_PATH = "/dashboard/araclar";

function parseDateInput(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    if (
        Number.isInteger(year) &&
        Number.isInteger(month) &&
        Number.isInteger(day) &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
    ) {
        // Keep local date stable (timezone-safe) for yearly filters.
        return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
    return new Date(value);
}

function isMuayeneLegacyColumnError(error: unknown) {
    const message = String((error as any)?.message || "").toLowerCase();
    return (
        message.includes("gectimi") ||
        message.includes("tutar") ||
        message.includes("aktifmi") ||
        message.includes("sirketid") ||
        message.includes('column "km"') ||
        message.includes("unknown arg") ||
        message.includes("does not exist")
    );
}

function revalidateMuayeneRelatedPaths(aracIds?: Array<string | null | undefined>) {
    revalidatePath(PATH);
    revalidatePath(EVRAK_PATH);
    revalidatePath(ARACLAR_PATH);
    for (const aracId of aracIds || []) {
        if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    }
}

async function tryCreateMuayeneWithFallback(
    baseData: Record<string, unknown>,
    extraData: { tutar?: number | null; gectiMi?: boolean }
) {
    const fullData: Record<string, unknown> = { ...baseData, ...extraData };
    const optionalFields = ["gectiMi", "tutar", "aktifMi", "km", "sirketId"];
    const attempts: Record<string, unknown>[] = [fullData];
    for (const field of optionalFields) {
        const prev = attempts[attempts.length - 1];
        if (!(field in prev)) continue;
        const next = { ...prev };
        delete (next as any)[field];
        attempts.push(next);
    }

    let lastLegacyError: unknown = null;
    for (const data of attempts) {
        try {
            const created = await prisma.muayene.create({
                data: data as any,
                select: { id: true },
            });
            return created.id;
        } catch (error) {
            if (!isMuayeneLegacyColumnError(error)) throw error;
            lastLegacyError = error;
        }
    }

    if (lastLegacyError) throw lastLegacyError;
    return null;
}

async function tryUpdateMuayeneWithFallback(
    id: string,
    baseData: Record<string, unknown>,
    extraData: { tutar?: number | null; gectiMi?: boolean }
) {
    const fullData: Record<string, unknown> = { ...baseData, ...extraData };
    const optionalFields = ["gectiMi", "tutar", "aktifMi", "km", "sirketId"];
    const attempts: Record<string, unknown>[] = [fullData];
    for (const field of optionalFields) {
        const prev = attempts[attempts.length - 1];
        if (!(field in prev)) continue;
        const next = { ...prev };
        delete (next as any)[field];
        attempts.push(next);
    }

    let lastLegacyError: unknown = null;
    for (const data of attempts) {
        try {
            await prisma.muayene.update({
                where: { id },
                data: data as any,
            });
            return;
        } catch (error) {
            if (!isMuayeneLegacyColumnError(error)) throw error;
            lastLegacyError = error;
        }
    }

    if (lastLegacyError) throw lastLegacyError;
}

export async function createMuayene(data: {
    aracId: string;
    muayeneTarihi: string;
    gecerlilikTarihi: string;
    tutar?: number;
    gectiMi?: boolean;
    km?: number;
    aktifMi?: boolean;
}) {
    try {
        await assertAuthenticatedUser();
        await ensureMuayeneColumns();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
        });
        const normalizedKm =
            data.km !== undefined
                ? normalizeKmInput(data.km)
                : null;

        const baseData = {
            aracId: arac.id,
            sirketId: arac.sirketId,
            muayeneTarihi: parseDateInput(data.muayeneTarihi),
            gecerlilikTarihi: parseDateInput(data.gecerlilikTarihi),
            km: normalizedKm,
            aktifMi: data.aktifMi ?? true,
        };

        let createdId: string | null = null;
        try {
            createdId = await tryCreateMuayeneWithFallback(baseData as Record<string, unknown>, {
                tutar: data.tutar !== undefined ? Number(data.tutar) : null,
                gectiMi: data.gectiMi ?? true,
            });
        } catch (error) {
            if (!isMuayeneOptionalFieldCompatibilityError(error)) throw error;
            await ensureMuayeneColumns();
            createdId = await tryCreateMuayeneWithFallback(baseData as Record<string, unknown>, {
                tutar: data.tutar !== undefined ? Number(data.tutar) : null,
                gectiMi: data.gectiMi ?? true,
            });
        }
        if ((data.aktifMi ?? true) && createdId) {
            try {
                await prisma.muayene.updateMany({
                    where: {
                        aracId: arac.id,
                        aktifMi: true,
                        NOT: { id: createdId },
                    },
                    data: { aktifMi: false },
                });
            } catch (error) {
                if (!isMuayeneLegacyColumnError(error)) throw error;
            }
        }

        await syncAracGuncelKm(arac.id);

        revalidateMuayeneRelatedPaths([arac.id]);
        return { success: true };
    } catch (e) {
        console.error(e);
        const detail = (e as { message?: string } | null)?.message;
        return { success: false, error: detail ? `Muayene kaydı oluşturulamadı: ${detail}` : "Muayene kaydı oluşturulamadı." };
    }
}

export async function updateMuayene(id: string, data: any) {
    try {
        await assertAuthenticatedUser();
        await ensureMuayeneColumns();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "muayene",
            filterModel: "muayene",
            id,
            select: { aracId: true, sirketId: true, km: true },
            errorMessage: "Muayene kaydi bulunamadi veya yetkiniz yok.",
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
                ? normalizeKmInput(kmInput)
                : null;

        const baseUpdateData = {
            aracId: arac.id,
            sirketId: arac.sirketId || mevcutKayit.sirketId,
            muayeneTarihi: data.muayeneTarihi ? parseDateInput(data.muayeneTarihi) : undefined,
            gecerlilikTarihi: data.gecerlilikTarihi ? parseDateInput(data.gecerlilikTarihi) : undefined,
            km: data.km !== undefined ? normalizedKm : undefined,
            aktifMi: data.aktifMi !== undefined ? Boolean(data.aktifMi) : undefined,
        };

        try {
            await tryUpdateMuayeneWithFallback(id, baseUpdateData as Record<string, unknown>, {
                tutar: data.tutar !== undefined ? Number(data.tutar) : undefined,
                gectiMi: data.gectiMi !== undefined ? Boolean(data.gectiMi) : undefined,
            });
        } catch (error) {
            if (!isMuayeneOptionalFieldCompatibilityError(error)) throw error;
            await ensureMuayeneColumns();
            await tryUpdateMuayeneWithFallback(id, baseUpdateData as Record<string, unknown>, {
                tutar: data.tutar !== undefined ? Number(data.tutar) : undefined,
                gectiMi: data.gectiMi !== undefined ? Boolean(data.gectiMi) : undefined,
            });
        }
        if (data.aktifMi === true) {
            try {
                await prisma.muayene.updateMany({
                    where: {
                        aracId: arac.id,
                        aktifMi: true,
                        NOT: { id },
                    },
                    data: { aktifMi: false },
                });
            } catch (error) {
                if (!isMuayeneLegacyColumnError(error)) throw error;
            }
        }

        await syncAracGuncelKm(arac.id);

        revalidateMuayeneRelatedPaths([mevcutKayit.aracId, arac.id]);
        return { success: true };
    } catch (e) {
        console.error(e);
        const detail = (e as { message?: string } | null)?.message;
        return { success: false, error: detail ? `Muayene kaydı güncellenemedi: ${detail}` : "Muayene kaydı güncellenemedi." };
    }
}

export async function deleteMuayene(id: string) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "muayene",
            filterModel: "muayene",
            id,
            select: { aracId: true },
            errorMessage: "Muayene kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.muayene.delete({ where: { id } });
        revalidateMuayeneRelatedPaths([(mevcutKayit as { aracId?: string } | null)?.aracId]);
        return { success: true };
    } catch (e) {
        console.error(e);
        const detail = (e as { message?: string } | null)?.message;
        return { success: false, error: detail ? `Muayene kaydı silinemedi: ${detail}` : "Muayene kaydı silinemedi." };
    }
}
