"use server";

import { OdemeYontemi } from "@prisma/client";
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

type CreateYakitInput = {
    aracId: string;
    tarih: string;
    litre: number;
    tutar: number;
    km: number;
    soforId?: string;
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

export async function createYakit(data: CreateYakitInput) {
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
                sirketId: arac.sirketId,
                tarih: parsedTarih,
                litre: parsedLitre,
                tutar: parsedTutar,
                km: Number(km),
                soforId: sofor?.id ?? arac.kullaniciId ?? null,
                istasyon: data.istasyon || null,
                odemeYontemi: resolveOdemeYontemi(data.odemeYontemi),
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateYakitPages(arac.id);
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
        const resolvedSoforId =
            sofor?.id ??
            (vehicleChanged ? (arac.kullaniciId ?? null) : (mevcutKayit.soforId ?? null));
        const parsedTarih = data.tarih ? parseDateInput(data.tarih, "Yakıt tarihi") : undefined;
        const parsedLitre = data.litre !== undefined ? parseDecimalInput(data.litre, "Litre") : undefined;
        const parsedTutar = data.tutar !== undefined ? parseDecimalInput(data.tutar, "Toplam tutar") : undefined;

        await prisma.yakit.update({
            where: { id },
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                tarih: parsedTarih,
                litre: parsedLitre,
                tutar: parsedTutar,
                km: data.km !== undefined ? Number(normalizedKm) : undefined,
                soforId: resolvedSoforId,
                istasyon: data.istasyon !== undefined ? data.istasyon || null : undefined,
                odemeYontemi: data.odemeYontemi ? resolveOdemeYontemi(data.odemeYontemi) : undefined,
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateYakitPages(arac.id);
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
        return {
            success: false,
            error: e instanceof Error ? e.message : "Yakıt kaydı silinemedi.",
        };
    }
}
