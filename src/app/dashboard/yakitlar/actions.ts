"use server";

import { OdemeYontemi } from "@prisma/client";
import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";
import { canRoleAccessAllCompanies, isDriverRole } from "@/lib/policy";

const PATH = '/dashboard/yakitlar';
const ARACLAR_PATH = '/dashboard/araclar';
const PERSONEL_PATH = "/dashboard/personel";
const YAKIT_HAS_SOFOR_ID = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.Yakit?.fields?.some((field: any) => field?.name === "soforId")
);

function getVehicleUsageCompanyFilter(sirketId: string) {
    return {
        OR: [
            { kullanici: { sirketId, deletedAt: null } },
            {
                kullaniciGecmisi: {
                    some: {
                        bitis: null,
                        kullanici: { sirketId, deletedAt: null },
                    },
                },
            },
        ],
    };
}

function revalidateYakitPages(aracId?: string, soforId?: string | null) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    revalidatePath(PERSONEL_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    if (soforId) revalidatePath(`${PERSONEL_PATH}/${soforId}`);
}

function normalizeSirketId(value: unknown) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
}

type CreateYakitInput = {
    aracId: string;
    tarih: string;
    litre: number;
    tutar: number;
    km: number;
    soforId?: string | null;
    istasyon?: string;
    odemeYontemi?: OdemeYontemi | string;
};

type UpdateYakitInput = Partial<CreateYakitInput>;

function resolveOdemeYontemi(value?: string | OdemeYontemi): OdemeYontemi {
    if (!value) return OdemeYontemi.NAKIT;
    return value in OdemeYontemi ? (value as OdemeYontemi) : OdemeYontemi.NAKIT;
}

function parseDecimalInput(value: unknown, fieldLabel: string) {
    const normalized = String(value ?? "")
        .trim()
        .replace(/\s/g, "")
        .replace(",", ".");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${fieldLabel} geçersiz.`);
    }
    return parsed;
}

function parseKmInput(value: unknown) {
    const raw = String(value ?? "").trim();
    const numeric = raw.replace(/[^\d]/g, "");
    const parsed = Number(numeric || raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("Alım KM geçersiz.");
    }
    return Math.trunc(parsed);
}

function parseDateInput(value: unknown, fieldLabel: string) {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) throw new Error(`${fieldLabel} geçersiz.`);
        return value;
    }

    const text = String(value ?? "").trim();
    if (!text) {
        throw new Error(`${fieldLabel} boş olamaz.`);
    }

    const trDateTimeMatch = text.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
    if (trDateTimeMatch) {
        const [, day, month, year, hour, minute] = trDateTimeMatch;
        const parsed = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute)
        );
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    const fallback = new Date(text);
    if (Number.isNaN(fallback.getTime())) {
        throw new Error(`${fieldLabel} geçersiz.`);
    }
    return fallback;
}

async function getAracUsageContext(
    aracId: string,
    fallback?: { soforId?: string | null; kullanimSirketId?: string | null }
) {
    const aktifZimmet = await (prisma as any).kullaniciZimmet
        .findFirst({
            where: { aracId, bitis: null },
            orderBy: { baslangic: "desc" },
            select: {
                kullaniciId: true,
                kullanici: { select: { sirketId: true } },
            },
        })
        .catch(() => null);

    return {
        soforId: aktifZimmet?.kullaniciId || fallback?.soforId || null,
        kullanimSirketId: normalizeSirketId(aktifZimmet?.kullanici?.sirketId) || fallback?.kullanimSirketId || null,
    };
}

async function getYakitScopedAracOrThrow<TSelect>(aracId: string, select?: TSelect) {
    try {
        return await getScopedAracOrThrow(aracId, select);
    } catch (originalError) {
        const actor = await assertAuthenticatedUser();
        const actorSirketId = normalizeSirketId((actor as any)?.sirketId);
        const role = (actor as any)?.rol;

        if (!actorSirketId || isDriverRole(role) || canRoleAccessAllCompanies(role, actorSirketId)) {
            throw originalError;
        }

        const arac = await (prisma as any).arac.findFirst({
            where: {
                id: aracId,
                deletedAt: null,
                ...(getVehicleUsageCompanyFilter(actorSirketId) as any),
            },
            ...(select ? { select } : {}),
        });

        if (!arac) {
            throw originalError;
        }

        return arac;
    }
}

async function getYakitScopedRecordOrThrow<TSelect>(id: string, select?: TSelect) {
    try {
        return await getScopedRecordOrThrow({
            prismaModel: "yakit",
            filterModel: "yakit",
            id,
            select,
            errorMessage: "Yakit kaydi bulunamadi veya yetkiniz yok.",
        });
    } catch (originalError) {
        const actor = await assertAuthenticatedUser();
        const actorSirketId = normalizeSirketId((actor as any)?.sirketId);
        const role = (actor as any)?.rol;

        if (!actorSirketId || isDriverRole(role) || canRoleAccessAllCompanies(role, actorSirketId)) {
            throw originalError;
        }

        const kayit = await (prisma as any).yakit.findFirst({
            where: {
                id,
                arac: {
                    deletedAt: null,
                    ...(getVehicleUsageCompanyFilter(actorSirketId) as any),
                },
            },
            ...(select ? { select } : {}),
        });

        if (!kayit) {
            throw originalError;
        }

        return kayit;
    }
}

async function resolveYakitSoforId(inputSoforId: string | null | undefined, fallbackSoforId?: string | null) {
    if (!YAKIT_HAS_SOFOR_ID) {
        return null;
    }

    if (typeof inputSoforId === "undefined") {
        return fallbackSoforId || null;
    }

    const normalized = inputSoforId?.trim();
    if (!normalized) {
        return null;
    }

    const personel = await getScopedKullaniciOrThrow(normalized, { id: true, rol: true });
    if ((personel as any)?.rol === "ADMIN") {
        throw new Error("Yakıt kaydı için admin seçilemez.");
    }

    return (personel as any).id as string;
}

export async function createYakit(data: CreateYakitInput) {
    try {
        await assertAuthenticatedUser();
        const arac = await getYakitScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
            kullaniciId: true,
            kullanici: { select: { id: true, sirketId: true } },
        });
        const fallbackUsageContext = {
            soforId: (arac as any)?.kullanici?.id || arac.kullaniciId || null,
            kullanimSirketId: normalizeSirketId((arac as any)?.kullanici?.sirketId),
        };
        const usageContext = await getAracUsageContext(arac.id, fallbackUsageContext);
        const fallbackSoforId = usageContext.soforId;
        const resolvedSoforId = await resolveYakitSoforId(data.soforId, fallbackSoforId);
        const parsedTarih = parseDateInput(data.tarih, "Yakıt tarihi");
        const parsedLitre = parseDecimalInput(data.litre, "Litre");
        const parsedTutar = parseDecimalInput(data.tutar, "Toplam tutar");
        const parsedKm = parseKmInput(data.km);

        const km = await assertKmWriteConsistency({
            aracId: arac.id,
            km: parsedKm,
            fieldLabel: "Yakit KM",
            enforceMaxKnownKm: false,
        });

        await prisma.yakit.create({
            data: {
                aracId: arac.id,
                sirketId: usageContext.kullanimSirketId,
                tarih: parsedTarih,
                litre: parsedLitre,
                tutar: parsedTutar,
                km: Number(km),
                ...(YAKIT_HAS_SOFOR_ID ? { soforId: resolvedSoforId } : {}),
                istasyon: data.istasyon || null,
                odemeYontemi: resolveOdemeYontemi(data.odemeYontemi),
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateYakitPages(arac.id, resolvedSoforId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Yakıt kaydı oluşturulamadı.",
        };
    }
}

export async function updateYakit(id: string, data: UpdateYakitInput) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getYakitScopedRecordOrThrow(id, {
            aracId: true,
            sirketId: true,
            km: true,
            ...(YAKIT_HAS_SOFOR_ID ? { soforId: true } : {}),
        });
        const arac = data.aracId
            ? await getYakitScopedAracOrThrow(data.aracId, {
                id: true,
                sirketId: true,
                kullaniciId: true,
                kullanici: { select: { id: true, sirketId: true } },
            })
            : await getYakitScopedAracOrThrow(mevcutKayit.aracId, {
                id: true,
                sirketId: true,
                kullaniciId: true,
                kullanici: { select: { id: true, sirketId: true } },
            });

        const kmInput =
            data.km !== undefined
                ? data.km
                : data.aracId && data.aracId !== mevcutKayit.aracId
                    ? mevcutKayit.km
                    : undefined;
        const normalizedKmInput = kmInput !== undefined ? parseKmInput(kmInput) : undefined;

        const normalizedKm =
            normalizedKmInput !== undefined
                ? await assertKmWriteConsistency({
                    aracId: arac.id,
                    km: normalizedKmInput,
                    fieldLabel: "Yakit KM",
                    currentRecord: { aracId: mevcutKayit.aracId, km: mevcutKayit.km },
                    enforceMaxKnownKm: false,
                })
                : null;
        const vehicleChanged = Boolean(data.aracId && data.aracId !== mevcutKayit.aracId);
        const fallbackUsageContext = {
            soforId: (arac as any)?.kullanici?.id || arac.kullaniciId || null,
            kullanimSirketId: normalizeSirketId((arac as any)?.kullanici?.sirketId),
        };
        const usageContext = await getAracUsageContext(arac.id, fallbackUsageContext);
        const fallbackSoforId = vehicleChanged
            ? usageContext.soforId
            : ((mevcutKayit as any).soforId ?? usageContext.soforId);
        const resolvedSoforId = await resolveYakitSoforId(data.soforId, fallbackSoforId);
        const parsedTarih = data.tarih ? parseDateInput(data.tarih, "Yakıt tarihi") : undefined;
        const parsedLitre = data.litre !== undefined ? parseDecimalInput(data.litre, "Litre") : undefined;
        const parsedTutar = data.tutar !== undefined ? parseDecimalInput(data.tutar, "Toplam tutar") : undefined;

        await prisma.yakit.update({
            where: { id },
            data: {
                aracId: arac.id,
                sirketId: usageContext.kullanimSirketId ?? mevcutKayit.sirketId,
                tarih: parsedTarih,
                litre: parsedLitre,
                tutar: parsedTutar,
                km: data.km !== undefined ? Number(normalizedKm) : undefined,
                ...(YAKIT_HAS_SOFOR_ID ? { soforId: resolvedSoforId } : {}),
                istasyon: data.istasyon !== undefined ? data.istasyon || null : undefined,
                odemeYontemi: data.odemeYontemi ? resolveOdemeYontemi(data.odemeYontemi) : undefined,
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateYakitPages(arac.id, resolvedSoforId);
        if ((mevcutKayit as any).soforId && (mevcutKayit as any).soforId !== resolvedSoforId) {
            revalidateYakitPages(undefined, (mevcutKayit as any).soforId);
        }
        return { success: true };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Yakıt kaydı güncellenemedi.",
        };
    }
}

export async function deleteYakit(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getYakitScopedRecordOrThrow(id, { aracId: true });

        await prisma.yakit.delete({ where: { id } });
        revalidateYakitPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return {
            success: false,
            error: e instanceof Error ? e.message : "Yakıt kaydı silinemedi.",
        };
    }
}
