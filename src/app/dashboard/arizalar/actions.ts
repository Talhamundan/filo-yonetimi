"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { getModelFilter } from "@/lib/auth-utils";
import { assertKmWriteConsistency, normalizeKmInput, syncAracGuncelKm } from "@/lib/km-consistency";
import { syncAracDurumu } from "@/lib/arac-durum";
import { logEntityActivity } from "@/lib/activity-log";
import { resolveVehicleUsageCompanyId } from "@/lib/vehicle-usage-company";

const ARIZALAR_PATH = "/dashboard/arizalar";
const ARACLAR_PATH = "/dashboard/araclar";
const SERVIS_KAYITLARI_PATH = "/dashboard/servis-kayitlari";
const LEGACY_BAKIMLAR_PATH = "/dashboard/bakimlar";
const PERSONEL_PATH = "/dashboard/personel";
const DASHBOARD_PATH = "/dashboard";

const OPEN_DURUMLAR = ["ACIK", "SERVISTE"] as const;
type ArizaOncelikInput = "DUSUK" | "ORTA" | "YUKSEK" | "KRITIK";
const ARIZA_HAS_SOFOR_ID = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.ArizaKaydi?.fields?.some((field: any) => field?.name === "soforId")
);
const BAKIM_HAS_SOFOR_ID = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.Bakim?.fields?.some((field: any) => field?.name === "soforId")
);

function normalizeArizaOncelik(oncelik?: ArizaOncelikInput) {
    if (oncelik === "KRITIK") return "YUKSEK";
    return oncelik || "ORTA";
}

async function resolveArizaSoforId(inputSoforId: string | null | undefined, fallbackSoforId?: string | null) {
    if (!ARIZA_HAS_SOFOR_ID) {
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
    if (personel?.rol === "ADMIN") {
        throw new Error("Arıza kaydı için admin seçilemez.");
    }

    return personel.id as string;
}

function resolveArizaActionError(error: unknown, fallback: string) {
    const message = String((error as any)?.message || "");
    if (
        message.includes('"ArizaKaydi"') &&
        (message.toLowerCase().includes("does not exist") || message.toLowerCase().includes("relation"))
    ) {
        return "Arıza kayıt tablosu bulunamadı. Veritabanı migration işlemi uygulanmalı.";
    }
    return message || fallback;
}

function revalidateArizaPages(aracId?: string, soforId?: string | null) {
    revalidatePath(ARIZALAR_PATH);
    revalidatePath(ARACLAR_PATH);
    revalidatePath(SERVIS_KAYITLARI_PATH);
    revalidatePath(LEGACY_BAKIMLAR_PATH);
    revalidatePath(PERSONEL_PATH);
    revalidatePath(DASHBOARD_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    if (soforId) revalidatePath(`${PERSONEL_PATH}/${soforId}`);
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

export async function createArizaKaydi(data: {
    aracId: string;
    soforId?: string | null;
    aciklama: string;
    oncelik?: ArizaOncelikInput;
    km?: number | null;
    servisAdi?: string | null;
    yapilanIslemler?: string | null;
    tutar?: number | null;
    bildirimTarihi?: Date | null;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
            kullaniciId: true,
            durum: true,
        });

        const activeCount = await (prisma as any).arizaKaydi.count({
            where: {
                aracId: arac.id,
                durum: { in: [...OPEN_DURUMLAR] },
            },
        });
        if (activeCount > 0) {
            return {
                success: false,
                error: `${arac.plaka} için aktif bir arıza kaydı zaten bulunuyor.`,
            };
        }

        const normalizedKm =
            data.km != null
                ? await assertKmWriteConsistency({
                      aracId: arac.id,
                      km: data.km,
                      fieldLabel: "Arıza KM",
                      enforceMaxKnownKm: false,
                  })
                : null;
        const fallbackSoforId = await getAracActiveSoforId(arac.id, arac.kullaniciId || null);
        const resolvedSoforId = await resolveArizaSoforId(data.soforId, fallbackSoforId);
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id
        });

        const created = await (prisma as any).arizaKaydi.create({
            data: {
                aracId: arac.id,
                ...(ARIZA_HAS_SOFOR_ID ? { soforId: resolvedSoforId } : {}),
                sirketId: usageSirketId,
                aciklama: data.aciklama,
                oncelik: normalizeArizaOncelik(data.oncelik),
                km: normalizedKm,
                servisAdi: data.servisAdi || null,
                yapilanIslemler: data.yapilanIslemler || null,
                tutar: typeof data.tutar === "number" ? data.tutar : 0,
                bildirimTarihi: data.bildirimTarihi || new Date(),
            },
        });

        await syncAracDurumu(arac.id);

        await logEntityActivity({
            actionType: ActivityActionType.CREATE,
            entityType: ActivityEntityType.DIGER,
            entityId: created.id,
            summary: `${arac.plaka} için arıza kaydı açıldı.`,
            actor,
            companyId: created.sirketId || actor.sirketId || null,
            metadata: {
                aracId: created.aracId,
                oncelik: created.oncelik,
                durum: created.durum,
                km: created.km,
                soforId: ARIZA_HAS_SOFOR_ID ? (created as any).soforId || null : null,
            },
        });

        revalidateArizaPages(arac.id, resolvedSoforId);
        return { success: true };
    } catch (error) {
        console.error("Arıza kaydı oluşturulamadı:", error);
        return { success: false, error: resolveArizaActionError(error, "Arıza kaydı oluşturulurken bir hata oluştu.") };
    }
}

export async function updateArizaKaydi(
    id: string,
    data: {
        soforId?: string | null;
        aciklama: string;
        oncelik?: ArizaOncelikInput;
        km?: number | null;
        servisAdi?: string | null;
        yapilanIslemler?: string | null;
        tutar?: number | null;
        bildirimTarihi?: Date | null;
    }
) {
    try {
        const actor = await assertAuthenticatedUser();
        const mevcut = await getScopedRecordOrThrow({
            prismaModel: "arizaKaydi",
            filterModel: "arizaKaydi",
            id,
            select: {
                id: true,
                aracId: true,
                ...(ARIZA_HAS_SOFOR_ID ? { soforId: true } : {}),
                sirketId: true,
                durum: true,
                bildirimTarihi: true,
            },
            errorMessage: "Arıza kaydı bulunamadı veya yetkiniz yok.",
        });
        const arac = await getScopedAracOrThrow(mevcut.aracId, {
            id: true,
            plaka: true,
            sirketId: true,
            kullaniciId: true,
        });

        const normalizedKm =
            data.km != null
                ? await assertKmWriteConsistency({
                      aracId: arac.id,
                      km: data.km,
                      fieldLabel: "Arıza KM",
                      enforceMaxKnownKm: false,
                  })
                : null;
        const fallbackSoforId = await getAracActiveSoforId(
            arac.id,
            mevcut.soforId || arac.kullaniciId || null
        );
        const resolvedSoforId = await resolveArizaSoforId(data.soforId, fallbackSoforId);
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id
        });

        const updated = await (prisma as any).arizaKaydi.update({
            where: { id },
            data: {
                ...(ARIZA_HAS_SOFOR_ID ? { soforId: resolvedSoforId } : {}),
                sirketId: usageSirketId || mevcut.sirketId,
                aciklama: data.aciklama,
                oncelik: normalizeArizaOncelik(data.oncelik),
                km: normalizedKm,
                servisAdi: data.servisAdi || null,
                yapilanIslemler: data.yapilanIslemler || null,
                tutar: typeof data.tutar === "number" ? data.tutar : 0,
                bildirimTarihi: data.bildirimTarihi || mevcut.bildirimTarihi,
            },
        });

        if (mevcut.durum === "ACIK") {
            await syncAracDurumu(arac.id);
        }

        await logEntityActivity({
            actionType: ActivityActionType.UPDATE,
            entityType: ActivityEntityType.DIGER,
            entityId: updated.id,
            summary: `${arac.plaka} için arıza kaydı güncellendi.`,
            actor,
            companyId: updated.sirketId || actor.sirketId || null,
            metadata: {
                aracId: updated.aracId,
                oncelik: updated.oncelik,
                durum: updated.durum,
                km: updated.km,
                soforId: ARIZA_HAS_SOFOR_ID ? (updated as any).soforId || null : null,
            },
        });

        const updatedSoforId = ARIZA_HAS_SOFOR_ID ? ((updated as any).soforId || null) : null;
        const mevcutSoforId = ARIZA_HAS_SOFOR_ID ? ((mevcut as any).soforId || null) : null;

        revalidateArizaPages(arac.id, updatedSoforId);
        if (mevcutSoforId && mevcutSoforId !== updatedSoforId) {
            revalidateArizaPages(undefined, mevcutSoforId);
        }
        return { success: true };
    } catch (error) {
        console.error("Arıza kaydı güncellenemedi:", error);
        return { success: false, error: resolveArizaActionError(error, "Arıza kaydı güncellenirken bir hata oluştu.") };
    }
}

export async function seviseGonderArizaKaydi(id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const filter = await getModelFilter("arizaKaydi");
        const kayit = await (prisma as any).arizaKaydi.findFirst({
            where: {
                id,
                ...(filter as any),
            },
            include: {
                arac: { select: { id: true, plaka: true, sirketId: true } },
            },
        });

        if (!kayit) {
            return { success: false, error: "Arıza kaydı bulunamadı veya yetkiniz yok." };
        }
        if (kayit.durum !== "ACIK") {
            return { success: false, error: "Sadece açık arızalar servise gönderilebilir." };
        }

        await (prisma as any).arizaKaydi.update({
            where: { id },
            data: {
                durum: "SERVISTE",
                serviseSevkTarihi: kayit.serviseSevkTarihi || new Date(),
            },
        });
        await syncAracDurumu(kayit.aracId);

        await logEntityActivity({
            actionType: ActivityActionType.STATUS_CHANGE,
            entityType: ActivityEntityType.DIGER,
            entityId: kayit.id,
            summary: `${kayit.arac.plaka} arızası servise gönderildi.`,
            actor,
            companyId: kayit.sirketId || kayit.arac.sirketId || actor.sirketId || null,
            metadata: {
                aracId: kayit.aracId,
                durum: "SERVISTE",
            },
        });

        revalidateArizaPages(kayit.aracId, kayit.soforId || null);
        return { success: true };
    } catch (error) {
        console.error("Arıza servise gönderilemedi:", error);
        return { success: false, error: resolveArizaActionError(error, "Arıza servise gönderilirken bir hata oluştu.") };
    }
}

export async function tamamlaArizaKaydi(
    id: string,
    data?: {
        servisAdi?: string | null;
        yapilanIslemler?: string | null;
        tutar?: number | null;
        km?: number | null;
        createBakim?: boolean;
    }
) {
    try {
        const actor = await assertAuthenticatedUser();
        const filter = await getModelFilter("arizaKaydi");
        const kayit = await (prisma as any).arizaKaydi.findFirst({
            where: {
                id,
                ...(filter as any),
            },
            include: {
                arac: { select: { id: true, plaka: true, sirketId: true, kullaniciId: true } },
            },
        });

        if (!kayit) {
            return { success: false, error: "Arıza kaydı bulunamadı veya yetkiniz yok." };
        }
        if (kayit.durum === "TAMAMLANDI") {
            return { success: false, error: "Arıza kaydı zaten tamamlandı." };
        }
        if (kayit.durum === "IPTAL") {
            return { success: false, error: "İptal edilen arıza tamamlanamaz." };
        }

        const normalizedKmInput = normalizeKmInput(data?.km);
        const km =
            normalizedKmInput != null
                ? await assertKmWriteConsistency({
                      aracId: kayit.aracId,
                      km: normalizedKmInput,
                      fieldLabel: "Arıza Kapanış KM",
                      enforceMaxKnownKm: false,
                  })
                : kayit.km ?? kayit.arac.guncelKm;

        const servisAdi = data?.servisAdi ?? kayit.servisAdi ?? null;
        const yapilanIslemler = data?.yapilanIslemler ?? kayit.yapilanIslemler ?? null;
        const tutar = typeof data?.tutar === "number" ? data.tutar : typeof kayit.tutar === "number" ? kayit.tutar : 0;
        const shouldCreateBakim = data?.createBakim !== false;
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: kayit.aracId
        });

        let bakimId = kayit.bakimId as string | null;
        if (shouldCreateBakim && !bakimId) {
            const bakim = await (prisma as any).bakim.create({
                data: {
                    aracId: kayit.aracId,
                    sirketId: usageSirketId || kayit.sirketId || kayit.arac.sirketId,
                    ...(BAKIM_HAS_SOFOR_ID ? { soforId: null } : {}),
                    bakimTarihi: new Date(),
                    yapilanKm: km,
                    kategori: "ARIZA",
                    tur: "ARIZA",
                    arizaSikayet: kayit.aciklama || null,
                    islemYapanFirma: servisAdi,
                    servisAdi,
                    yapilanIslemler,
                    tutar,
                },
            });
            bakimId = bakim.id;
        }

        await (prisma as any).arizaKaydi.update({
            where: { id },
            data: {
                durum: "TAMAMLANDI",
                km,
                servisAdi,
                yapilanIslemler,
                tutar,
                bakimId,
                kapanisTarihi: new Date(),
                serviseSevkTarihi: kayit.serviseSevkTarihi || new Date(),
            },
        });

        await syncAracGuncelKm(kayit.aracId);
        await syncAracDurumu(kayit.aracId);

        await logEntityActivity({
            actionType: ActivityActionType.STATUS_CHANGE,
            entityType: ActivityEntityType.DIGER,
            entityId: kayit.id,
            summary: `${kayit.arac.plaka} arızası tamamlandı.`,
            actor,
            companyId: kayit.sirketId || kayit.arac.sirketId || actor.sirketId || null,
            metadata: {
                aracId: kayit.aracId,
                bakimId,
                tutar,
                km,
            },
        });

        revalidateArizaPages(kayit.aracId, kayit.soforId || null);
        return { success: true };
    } catch (error) {
        console.error("Arıza tamamlanamadı:", error);
        return { success: false, error: resolveArizaActionError(error, "Arıza tamamlanırken bir hata oluştu.") };
    }
}

export async function iptalEtArizaKaydi(id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const filter = await getModelFilter("arizaKaydi");
        const kayit = await (prisma as any).arizaKaydi.findFirst({
            where: {
                id,
                ...(filter as any),
            },
            include: {
                arac: { select: { id: true, plaka: true, sirketId: true, kullaniciId: true } },
            },
        });

        if (!kayit) {
            return { success: false, error: "Arıza kaydı bulunamadı veya yetkiniz yok." };
        }
        if (kayit.durum === "TAMAMLANDI") {
            return { success: false, error: "Tamamlanan arıza kaydı iptal edilemez." };
        }
        if (kayit.durum === "IPTAL") {
            return { success: true };
        }

        await (prisma as any).arizaKaydi.update({
            where: { id },
            data: {
                durum: "IPTAL",
                kapanisTarihi: new Date(),
            },
        });

        await syncAracDurumu(kayit.aracId);

        await logEntityActivity({
            actionType: ActivityActionType.STATUS_CHANGE,
            entityType: ActivityEntityType.DIGER,
            entityId: kayit.id,
            summary: `${kayit.arac.plaka} arıza kaydı iptal edildi.`,
            actor,
            companyId: kayit.sirketId || kayit.arac.sirketId || actor.sirketId || null,
            metadata: {
                aracId: kayit.aracId,
                durum: "IPTAL",
            },
        });

        revalidateArizaPages(kayit.aracId, kayit.soforId || null);
        return { success: true };
    } catch (error) {
        console.error("Arıza iptal edilemedi:", error);
        return { success: false, error: resolveArizaActionError(error, "Arıza iptal edilirken bir hata oluştu.") };
    }
}

export async function deleteArizaKaydi(id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const filter = await getModelFilter("arizaKaydi");
        const kayit = await (prisma as any).arizaKaydi.findFirst({
            where: {
                id,
                ...(filter as any),
            },
            include: {
                arac: { select: { id: true, plaka: true, sirketId: true, kullaniciId: true } },
            },
        });

        if (!kayit) {
            return { success: false, error: "Arıza kaydı bulunamadı veya yetkiniz yok." };
        }
        if (kayit.bakimId || kayit.durum === "TAMAMLANDI") {
            return {
                success: false,
                error: "Bakım kaydı ile ilişkilenen veya tamamlanan arızalar silinemez.",
            };
        }

        await (prisma as any).arizaKaydi.delete({ where: { id } });
        await syncAracDurumu(kayit.aracId);

        await logEntityActivity({
            actionType: ActivityActionType.DELETE,
            entityType: ActivityEntityType.DIGER,
            entityId: kayit.id,
            summary: `${kayit.arac.plaka} arıza kaydı silindi.`,
            actor,
            companyId: kayit.sirketId || kayit.arac.sirketId || actor.sirketId || null,
            metadata: {
                aracId: kayit.aracId,
                durum: kayit.durum,
            },
        });

        revalidateArizaPages(kayit.aracId, kayit.soforId || null);
        return { success: true };
    } catch (error) {
        console.error("Arıza kaydı silinemedi:", error);
        return { success: false, error: resolveArizaActionError(error, "Arıza kaydı silinirken bir hata oluştu.") };
    }
}
