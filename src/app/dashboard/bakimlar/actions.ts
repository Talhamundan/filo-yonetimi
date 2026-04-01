"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";

const PATH = "/dashboard/bakimlar";
const ARACLAR_PATH = "/dashboard/araclar";
const PERSONEL_PATH = "/dashboard/personel";
const BAKIM_HAS_SOFOR_ID = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.Bakim?.fields?.some((field: any) => field?.name === "soforId")
);

function revalidateBakimPages(aracId?: string, soforId?: string | null) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    revalidatePath(PERSONEL_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    if (soforId) revalidatePath(`${PERSONEL_PATH}/${soforId}`);
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
    aracId: string;
    soforId?: string | null;
    bakimTarihi: Date;
    yapilanKm: number;
    kategori?: ServisKategoriInput;
    tur?: LegacyBakimTuruInput;
    servisAdi?: string;
    yapilanIslemler?: string;
    tutar: number;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
            kullaniciId: true,
        });
        const yapilanKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: data.yapilanKm,
            fieldLabel: "Bakim KM",
            enforceMaxKnownKm: false,
        });
        const kategori = resolveServisKategori(data.kategori, data.tur);
        const tur = resolveLegacyBakimTuru(kategori, data.tur);
        const fallbackSoforId = await getAracActiveSoforId(arac.id, arac.kullaniciId || null);
        const resolvedSoforId = await resolveBakimSoforId(data.soforId, fallbackSoforId);

        const created = await prisma.bakim.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                ...(BAKIM_HAS_SOFOR_ID ? { soforId: resolvedSoforId } : {}),
                bakimTarihi: data.bakimTarihi,
                yapilanKm: Number(yapilanKm),
                kategori,
                tur,
                servisAdi: data.servisAdi,
                yapilanIslemler: data.yapilanIslemler,
                tutar: data.tutar,
            }
        });

        await syncAracGuncelKm(arac.id);

        await logEntityActivity({
            actionType: ActivityActionType.CREATE,
            entityType: ActivityEntityType.BAKIM,
            entityId: created.id,
            summary: `${arac.plaka} için bakım kaydı eklendi.`,
            actor,
            companyId: created.sirketId || actor.sirketId || null,
            metadata: {
                kategori: created.kategori,
                tur: created.tur,
                bakimTarihi: created.bakimTarihi,
                yapilanKm: created.yapilanKm,
                tutar: created.tutar,
                aracId: created.aracId,
                soforId: BAKIM_HAS_SOFOR_ID ? (created as any).soforId || null : null,
            },
        });

        revalidateBakimPages(arac.id, resolvedSoforId);
        return { success: true };
    } catch (error) {
        console.error("Bakım eklenirken hata:", error);
        return { success: false, error: "Servis bilgisi eklenirken bir hata oluştu." };
    }
}

export async function updateBakim(id: string, data: {
    aracId: string;
    soforId?: string | null;
    bakimTarihi: Date;
    yapilanKm: number;
    kategori?: ServisKategoriInput;
    tur?: LegacyBakimTuruInput;
    servisAdi?: string;
    yapilanIslemler?: string;
    tutar: number;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "bakim",
            filterModel: "bakim",
            id,
            select: { aracId: true, sirketId: true, yapilanKm: true, ...(BAKIM_HAS_SOFOR_ID ? { soforId: true } : {}) },
            errorMessage: "Bakim kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, plaka: true, sirketId: true, kullaniciId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, plaka: true, sirketId: true, kullaniciId: true });
        const yapilanKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: data.yapilanKm,
            fieldLabel: "Bakim KM",
            currentRecord: { aracId: mevcutKayit.aracId, km: mevcutKayit.yapilanKm },
            enforceMaxKnownKm: false,
        });
        const kategori = resolveServisKategori(data.kategori, data.tur);
        const tur = resolveLegacyBakimTuru(kategori, data.tur);
        const vehicleChanged = Boolean(data.aracId && data.aracId !== mevcutKayit.aracId);
        const fallbackSoforId = vehicleChanged
            ? await getAracActiveSoforId(arac.id, arac.kullaniciId || null)
            : ((mevcutKayit as any).soforId ?? null);
        const resolvedSoforId = await resolveBakimSoforId(data.soforId, fallbackSoforId);

        const updated = await prisma.bakim.update({
            where: { id },
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                ...(BAKIM_HAS_SOFOR_ID ? { soforId: resolvedSoforId } : {}),
                bakimTarihi: data.bakimTarihi,
                yapilanKm: Number(yapilanKm),
                kategori,
                tur,
                servisAdi: data.servisAdi,
                yapilanIslemler: data.yapilanIslemler,
                tutar: data.tutar,
            }
        });

        await syncAracGuncelKm(arac.id);

        await logEntityActivity({
            actionType: ActivityActionType.UPDATE,
            entityType: ActivityEntityType.BAKIM,
            entityId: updated.id,
            summary: `${arac.plaka} için bakım kaydı güncellendi.`,
            actor,
            companyId: updated.sirketId || actor.sirketId || null,
            metadata: {
                kategori: updated.kategori,
                tur: updated.tur,
                bakimTarihi: updated.bakimTarihi,
                yapilanKm: updated.yapilanKm,
                tutar: updated.tutar,
                aracId: updated.aracId,
                soforId: BAKIM_HAS_SOFOR_ID ? (updated as any).soforId || null : null,
            },
        });

        revalidateBakimPages(arac.id, resolvedSoforId);
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
