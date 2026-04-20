"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import {
    assertAuthenticatedUser,
    getScopedAracOrThrow,
    getScopedKullaniciOrThrow,
    getScopedRecordOrThrow,
    resolveActionSirketId,
} from "@/lib/action-scope";
import { getModelFilter } from "@/lib/auth-utils";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";
import { normalizePlate } from "@/lib/validation";
import { resolveVehicleUsageCompanyId } from "@/lib/vehicle-usage-company";

const PATH = "/dashboard/servis-kayitlari";
const LEGACY_PATH = "/dashboard/bakimlar";
const ARACLAR_PATH = "/dashboard/araclar";
const PERSONEL_PATH = "/dashboard/personel";
const BAKIM_HAS_SOFOR_ID = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.Bakim?.fields?.some((field: any) => field?.name === "soforId")
);

function revalidateBakimPages(aracId?: string, soforId?: string | null) {
    revalidatePath(PATH);
    revalidatePath(LEGACY_PATH);
    revalidatePath(ARACLAR_PATH);
    revalidatePath(PERSONEL_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    if (soforId) revalidatePath(`${PERSONEL_PATH}/${soforId}`);
}

function normalizeOptionalText(value: string | null | undefined) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalPlate(value: string | null | undefined) {
    const normalized = normalizeOptionalText(value);
    if (!normalized) return null;
    return normalizePlate(normalized);
}

function normalizeOptionalKm(value: number | null | undefined, fallback: number) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    return fallback;
}

function ensureNonNegativeKm(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
}

async function findScopedAracByPlaka(plaka: string) {
    const aracFilter = await getModelFilter("arac");
    return (prisma as any).arac.findFirst({
        where: {
            ...(aracFilter as any),
            plaka,
        },
        select: {
            id: true,
            plaka: true,
            sirketId: true,
            kullaniciId: true,
            guncelKm: true,
        },
    });
}

type ServisKategoriInput = "PERIYODIK_BAKIM" | "ARIZA";
type LegacyBakimTuruInput = "PERIYODIK" | "ARIZA" | "KAPORTA";

function resolveServisKategori(kategori?: ServisKategoriInput, tur?: LegacyBakimTuruInput): ServisKategoriInput {
    if (kategori === "ARIZA") return "ARIZA";
    if (tur === "ARIZA") return "ARIZA";
    return "PERIYODIK_BAKIM";
}

function resolveLegacyBakimTuru(kategori: ServisKategoriInput, tur?: LegacyBakimTuruInput): LegacyBakimTuruInput {
    if (tur) return tur;
    return kategori === "ARIZA" ? "ARIZA" : "PERIYODIK";
}

async function getAracActiveSoforId(aracId: string, fallbackSoforId?: string | null) {
    const aktifZimmet = await (prisma as any).kullaniciZimmet
        .findFirst({
            where: { aracId, bitis: null },
            orderBy: { baslangic: "desc" },
            select: { kullaniciId: true },
        })
        .catch(() => null);

    return aktifZimmet?.kullaniciId || fallbackSoforId || null;
}

async function resolveBakimSoforId(inputSoforId: string | null | undefined, fallbackSoforId?: string | null) {
    if (!BAKIM_HAS_SOFOR_ID) {
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
        throw new Error("Servis kaydı için admin seçilemez.");
    }

    return (personel as any).id as string;
}

export async function addBakim(data: {
    aracId?: string | null;
    plaka?: string | null;
    soforId?: string | null;
    bakimTarihi: Date;
    yapilanKm?: number | null;
    kategori?: ServisKategoriInput;
    tur?: LegacyBakimTuruInput;
    servisAdi?: string;
    arizaSikayet?: string | null;
    degisenParca?: string | null;
    islemYapanFirma?: string | null;
    yapilanIslemler?: string;
    tutar: number;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const requestedAracId = normalizeOptionalText(data.aracId);
        const normalizedPlaka = normalizeOptionalPlate(data.plaka);
        const arac = requestedAracId
            ? await getScopedAracOrThrow(requestedAracId, {
                id: true,
                plaka: true,
                sirketId: true,
                kullaniciId: true,
                guncelKm: true,
            })
            : (normalizedPlaka ? await findScopedAracByPlaka(normalizedPlaka) : null);

        if (!arac && !normalizedPlaka) {
            throw new Error("Araç seçimi veya plaka bilgisi zorunludur.");
        }

        const rawYapilanKm = normalizeOptionalKm(
            data.yapilanKm,
            Number(arac?.guncelKm || 0)
        );
        const yapilanKm = arac
            ? await assertKmWriteConsistency({
                aracId: arac.id,
                km: rawYapilanKm,
                fieldLabel: "Bakim KM",
                enforceMaxKnownKm: false,
            })
            : ensureNonNegativeKm(rawYapilanKm);
        const arizaSikayet = normalizeOptionalText(data.arizaSikayet);
        const islemYapanFirma = normalizeOptionalText(data.islemYapanFirma) || normalizeOptionalText(data.servisAdi);
        const degisenParca = normalizeOptionalText(data.degisenParca);
        const yapilanIslemler = normalizeOptionalText(data.yapilanIslemler);
        const plaka = normalizeOptionalPlate(arac?.plaka) || normalizedPlaka;
        const kategori = resolveServisKategori(data.kategori, data.tur);
        const tur = resolveLegacyBakimTuru(kategori, data.tur);
        const effectiveKategori = arizaSikayet && kategori !== "ARIZA" ? "ARIZA" : kategori;
        const effectiveTur = resolveLegacyBakimTuru(effectiveKategori, tur);
        const resolvedSoforId = null;
        const resolvedSirketId = arac
            ? await resolveVehicleUsageCompanyId({ aracId: arac.id })
            : (await resolveActionSirketId());
        const summaryPlaka = plaka || "araçsız kayıt";

        const created = await (prisma as any).bakim.create({
            data: {
                aracId: arac?.id || null,
                plaka,
                sirketId: resolvedSirketId,
                ...(BAKIM_HAS_SOFOR_ID ? { soforId: null } : {}),
                bakimTarihi: data.bakimTarihi,
                yapilanKm: Number(yapilanKm),
                kategori: effectiveKategori,
                tur: effectiveTur,
                arizaSikayet,
                degisenParca,
                islemYapanFirma,
                servisAdi: islemYapanFirma,
                yapilanIslemler,
                tutar: data.tutar,
            }
        });

        if (arac?.id) {
            await syncAracGuncelKm(arac.id);
        }

        await logEntityActivity({
            actionType: ActivityActionType.CREATE,
            entityType: ActivityEntityType.BAKIM,
            entityId: created.id,
            summary: `${summaryPlaka} için bakım kaydı eklendi.`,
            actor,
            companyId: created.sirketId || actor.sirketId || null,
            metadata: {
                kategori: (created as any).kategori,
                tur: (created as any).tur,
                bakimTarihi: created.bakimTarihi,
                yapilanKm: created.yapilanKm,
                tutar: created.tutar,
                aracId: created.aracId,
                plaka: (created as any).plaka || plaka || null,
                arizaSikayet,
                degisenParca,
                islemYapanFirma,
                yapilanIslemler,
                soforId: BAKIM_HAS_SOFOR_ID ? (created as any).soforId || null : null,
            },
        });

        revalidateBakimPages(arac?.id, resolvedSoforId);
        return { success: true };
    } catch (error) {
        console.error("Bakım eklenirken hata:", error);
        return { success: false, error: "Servis bilgisi eklenirken bir hata oluştu." };
    }
}

export async function updateBakim(id: string, data: {
    aracId?: string | null;
    plaka?: string | null;
    soforId?: string | null;
    bakimTarihi: Date;
    yapilanKm?: number | null;
    kategori?: ServisKategoriInput;
    tur?: LegacyBakimTuruInput;
    servisAdi?: string;
    arizaSikayet?: string | null;
    degisenParca?: string | null;
    islemYapanFirma?: string | null;
    yapilanIslemler?: string;
    tutar: number;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "bakim",
            filterModel: "bakim",
            id,
            select: {
                aracId: true,
                plaka: true,
                sirketId: true,
                yapilanKm: true,
                ...(BAKIM_HAS_SOFOR_ID ? { soforId: true } : {}),
            },
            errorMessage: "Bakim kaydi bulunamadi veya yetkiniz yok.",
        });
        const oldAracId = normalizeOptionalText((mevcutKayit as any).aracId);
        const requestedAracId = normalizeOptionalText(data.aracId);
        const normalizedPlaka = normalizeOptionalPlate(data.plaka);

        let arac = requestedAracId
            ? await getScopedAracOrThrow(requestedAracId, { id: true, plaka: true, sirketId: true, kullaniciId: true, guncelKm: true })
            : (normalizedPlaka ? await findScopedAracByPlaka(normalizedPlaka) : null);

        if (!arac && !requestedAracId && !normalizedPlaka && oldAracId) {
            arac = await getScopedAracOrThrow(oldAracId, { id: true, plaka: true, sirketId: true, kullaniciId: true, guncelKm: true });
        }
        if (!arac && !normalizedPlaka) {
            throw new Error("Araç seçimi veya plaka bilgisi zorunludur.");
        }

        const nextAracId = arac?.id || null;
        const plaka = normalizeOptionalPlate(arac?.plaka) || normalizedPlaka;
        const rawYapilanKm = normalizeOptionalKm(
            data.yapilanKm,
            Number((mevcutKayit as any).yapilanKm || arac?.guncelKm || 0)
        );
        const yapilanKm = nextAracId && arac
            ? await assertKmWriteConsistency({
                aracId: nextAracId,
                km: rawYapilanKm,
                fieldLabel: "Bakim KM",
                currentRecord: oldAracId ? { aracId: oldAracId, km: (mevcutKayit as any).yapilanKm } : undefined,
                enforceMaxKnownKm: false,
            })
            : ensureNonNegativeKm(rawYapilanKm);
        const arizaSikayet = normalizeOptionalText(data.arizaSikayet);
        const islemYapanFirma = normalizeOptionalText(data.islemYapanFirma) || normalizeOptionalText(data.servisAdi);
        const degisenParca = normalizeOptionalText(data.degisenParca);
        const yapilanIslemler = normalizeOptionalText(data.yapilanIslemler);
        const kategori = resolveServisKategori(data.kategori, data.tur);
        const tur = resolveLegacyBakimTuru(kategori, data.tur);
        const effectiveKategori = arizaSikayet && kategori !== "ARIZA" ? "ARIZA" : kategori;
        const effectiveTur = resolveLegacyBakimTuru(effectiveKategori, tur);
        const resolvedSoforId = null;
        const resolvedSirketId = arac
            ? await resolveVehicleUsageCompanyId({
                aracId: arac.id
            })
            : normalizeOptionalText((mevcutKayit as any).sirketId) || (await resolveActionSirketId());
        const summaryPlaka = plaka || "araçsız kayıt";

        const updated = await (prisma as any).bakim.update({
            where: { id },
            data: {
                aracId: nextAracId,
                plaka,
                sirketId: resolvedSirketId,
                ...(BAKIM_HAS_SOFOR_ID ? { soforId: null } : {}),
                bakimTarihi: data.bakimTarihi,
                yapilanKm: Number(yapilanKm),
                kategori: effectiveKategori,
                tur: effectiveTur,
                arizaSikayet,
                degisenParca,
                islemYapanFirma,
                servisAdi: islemYapanFirma,
                yapilanIslemler,
                tutar: data.tutar,
            }
        });

        if (oldAracId && oldAracId !== nextAracId) {
            await syncAracGuncelKm(oldAracId);
        }
        if (nextAracId) {
            await syncAracGuncelKm(nextAracId);
        }

        await logEntityActivity({
            actionType: ActivityActionType.UPDATE,
            entityType: ActivityEntityType.BAKIM,
            entityId: updated.id,
            summary: `${summaryPlaka} için bakım kaydı güncellendi.`,
            actor,
            companyId: updated.sirketId || actor.sirketId || null,
            metadata: {
                kategori: (updated as any).kategori,
                tur: (updated as any).tur,
                bakimTarihi: updated.bakimTarihi,
                yapilanKm: updated.yapilanKm,
                tutar: updated.tutar,
                aracId: updated.aracId,
                plaka: (updated as any).plaka || plaka || null,
                arizaSikayet,
                degisenParca,
                islemYapanFirma,
                yapilanIslemler,
                soforId: BAKIM_HAS_SOFOR_ID ? (updated as any).soforId || null : null,
            },
        });

        revalidateBakimPages(nextAracId || undefined, resolvedSoforId);
        if (oldAracId && oldAracId !== nextAracId) {
            revalidateBakimPages(oldAracId);
        }
        if ((mevcutKayit as any).soforId && (mevcutKayit as any).soforId !== resolvedSoforId) {
            revalidateBakimPages(undefined, (mevcutKayit as any).soforId);
        }
        return { success: true };
    } catch (error) {
        console.error("Bakım güncellenirken hata:", error);
        return { success: false, error: "Servis bilgisi güncellenirken bir hata oluştu." };
    }
}

export async function deleteBakim(id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "bakim",
            filterModel: "bakim",
            id,
            select: { aracId: true, sirketId: true, kategori: true, tur: true, tutar: true, bakimTarihi: true },
            errorMessage: "Bakim kaydi bulunamadi veya yetkiniz yok.",
        });

        await softDeleteEntity("bakim", id, actor.id);
        revalidateBakimPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (error) {
        console.error("Bakım silinirken hata:", error);
        return { success: false, error: "Bakım kaydı çöp kutusuna taşınırken bir hata oluştu." };
    }
}
