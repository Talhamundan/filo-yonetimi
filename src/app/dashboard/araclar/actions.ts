"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import * as xlsx from "xlsx";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { canAccessAllCompanies, getCurrentSirketId, getModelFilter } from "@/lib/auth-utils";
import { assertAuthenticatedUser, getScopedKullaniciOrThrow, resolveActionSirketId } from "@/lib/action-scope";
import { assertKmWriteConsistency, normalizeKmInput, resolveAracGuncelKmForUpdate, syncAracGuncelKm } from "@/lib/km-consistency";
import { syncAracDurumu } from "@/lib/arac-durum";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";
import { KIRALIK_SIRKET_ADI, KIRALIK_SIRKET_OPTION_VALUE } from "@/lib/ruhsat-sahibi";
import { canRoleAssignIndependentRecords } from "@/lib/policy";

const PATH = "/dashboard/araclar";
const toUpperTr = (value: string) => value.toLocaleUpperCase("tr-TR");

function normalizeSirketSelection(value: unknown) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized || null;
}

async function ensureKiralikSirketId() {
    const existing = await prisma.sirket.findFirst({
        where: { ad: { equals: KIRALIK_SIRKET_ADI, mode: "insensitive" } },
        select: { id: true },
    });
    if (existing?.id) {
        return existing.id;
    }

    const created = await prisma.sirket.create({
        data: { ad: KIRALIK_SIRKET_ADI },
        select: { id: true },
    });
    return created.id;
}

async function resolveRuhsatSahibiSirketId(inputSirketId?: string | null) {
    const normalized = normalizeSirketSelection(inputSirketId);
    if (normalized === KIRALIK_SIRKET_OPTION_VALUE) {
        const [actor, hasGlobalAccess, currentSirketId] = await Promise.all([
            assertAuthenticatedUser(),
            canAccessAllCompanies(),
            getCurrentSirketId(),
        ]);
        if (!hasGlobalAccess || !canRoleAssignIndependentRecords((actor as any).rol, currentSirketId)) {
            throw new Error("Kiralık ruhsat sahibi seçimi için yetkiniz bulunmuyor.");
        }
        return ensureKiralikSirketId();
    }
    return resolveActionSirketId(normalized);
}

function normalizeIlEnum(value: unknown): string {
    return String(value || "")
        .trim()
        .toLocaleUpperCase("tr-TR");
}

function normalizeBedelInput(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0 ? value : null;
    }
    const raw = String(value).trim();
    if (!raw) return null;
    const sanitized = raw.replace(/[₺\s]/g, "");
    const normalized =
        sanitized.includes(",") && sanitized.includes(".")
            ? sanitized.replace(/\./g, "").replace(",", ".")
            : sanitized.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function createArac(data: {
    plaka: string;
    marka: string;
    model: string;
    yil: number;
    muayeneGecerlilikTarihi?: string | null;
    bulunduguIl: string;
    guncelKm: number;
    bedel?: number | string | null;
    aciklama?: string | null;
    calistigiKurum?: string | null;
    sirketId?: string | null;
    kullaniciId?: string | null;
    ruhsatSeriNo?: string | null;
    saseNo?: string | null;
    motorNo?: string | null;
    kategori?: any;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const requestedSirketId = await resolveRuhsatSahibiSirketId(data.sirketId);
        const normalizedPlaka = data.plaka.replace(/\s+/g, '').toUpperCase();
        const kullanici = data.kullaniciId
            ? await getScopedKullaniciOrThrow(data.kullaniciId, { id: true, sirketId: true, calistigiKurum: true })
            : null;
        const selectedKiralik = normalizeSirketSelection(data.sirketId) === KIRALIK_SIRKET_OPTION_VALUE;
        const sirketId = requestedSirketId || (selectedKiralik ? null : (kullanici?.sirketId || null));
        const guncelKm = normalizeKmInput(data.guncelKm) ?? 0;
        const bedel = normalizeBedelInput(data.bedel);
        const resolvedCalistigiKurum = data.calistigiKurum?.trim() || null;

        const existingByPlaka = await prisma.arac.findUnique({
            where: { plaka: normalizedPlaka },
            select: { id: true, deletedAt: true },
        });
        if (existingByPlaka) {
            if (existingByPlaka.deletedAt) {
                return { success: false, error: "Bu plaka çöp kutusunda kayıtlı. Önce çöp kutusundan geri yükleyin." };
            }
            return { success: false, error: "Bu plaka zaten kayıtlı!" };
        }

        if (kullanici) {
            const personelAktifArac = await prisma.arac.findFirst({
                where: {
                    kullaniciId: kullanici.id,
                    deletedAt: null,
                },
                select: { id: true, plaka: true },
            });
            if (personelAktifArac) {
                return { success: false, error: "Seçili personelde zaten zimmetli bir araç var." };
            }
        }
        
        const arac = await prisma.arac.create({
            data: {
                plaka: normalizedPlaka,
                marka: toUpperTr(data.marka),
                model: toUpperTr(data.model),
                yil: Number(data.yil),
                bulunduguIl: normalizeIlEnum(data.bulunduguIl),
                guncelKm,
                bedel,
                aciklama: data.aciklama?.trim() || null,
                calistigiKurum: resolvedCalistigiKurum,
                sirketId,
                kullaniciId: kullanici?.id || null,
                ruhsatSeriNo: data.ruhsatSeriNo || null,
                saseNo: data.saseNo || null,
                motorNo: data.motorNo || null,
                durum: kullanici ? "AKTIF" : "BOSTA",
                kategori: data.kategori || 'BINEK'
            }
        });

        // Zimmet kaydı oluştur
        if (kullanici) {
            await prisma.kullaniciZimmet.create({
                data: {
                    aracId: arac.id,
                    kullaniciId: kullanici.id,
                    baslangic: new Date(),
                    baslangicKm: guncelKm
                }
            });
        }

        // Opsiyonel ilk muayene geçerlilik bilgisi
        if (data.muayeneGecerlilikTarihi) {
            const gecerlilik = new Date(data.muayeneGecerlilikTarihi);
            if (!Number.isNaN(gecerlilik.getTime())) {
                await prisma.muayene.create({
                    data: {
                        aracId: arac.id,
                        sirketId,
                        muayeneTarihi: new Date(),
                        gecerlilikTarihi: gecerlilik,
                        km: guncelKm,
                        aktifMi: true,
                    }
                });
            }
        }

        await syncAracGuncelKm(arac.id);
        await syncAracDurumu(arac.id);

        await logEntityActivity({
            actionType: ActivityActionType.CREATE,
            entityType: ActivityEntityType.ARAC,
            entityId: arac.id,
            summary: `${arac.plaka} plakalı araç eklendi.`,
            actor,
            companyId: arac.sirketId || sirketId,
            metadata: {
                plaka: arac.plaka,
                marka: arac.marka,
                model: arac.model,
                yil: arac.yil,
                kategori: arac.kategori,
                guncelKm: arac.guncelKm,
                bedel: arac.bedel,
                aciklama: arac.aciklama,
                calistigiKurum: (arac as any).calistigiKurum ?? null,
                kullaniciId: arac.kullaniciId,
            },
        });

        revalidatePath(PATH);
        revalidatePath('/dashboard/muayeneler');
        revalidatePath('/dashboard/zimmetler');
        return { success: true };
    } catch (e: any) {
        console.error(e);
        if (e.code === 'P2002') {
            const target = Array.isArray(e?.meta?.target)
                ? e.meta.target.join(",")
                : String(e?.meta?.target || "");
            if (target.includes("plaka")) {
                return { success: false, error: "Bu plaka zaten kayıtlı!" };
            }
            if (target.includes("kullaniciId")) {
                return { success: false, error: "Seçili personelde zaten zimmetli bir araç var." };
            }
            return { success: false, error: "Kayıt benzersizlik kuralına takıldı." };
        }
        if (e instanceof Error && e.message.includes("bulunduguIl")) {
            return { success: false, error: "Bulunduğu il değeri geçersiz." };
        }
        return { success: false, error: "Araç kaydedilemedi." };
    }
}

export async function updateArac(id: string, data: any) {
    try {
        const actor = await assertAuthenticatedUser();
        const scopeFilter = await getModelFilter("arac");

        const oldArac = await prisma.arac.findFirst({
            where: { id, ...(scopeFilter as any) },
            select: { plaka: true, kullaniciId: true, guncelKm: true, sirketId: true }
        });

        if (!oldArac) {
            return { success: false, error: "Araç bulunamadı veya yetkiniz yok." };
        }
        const requestedSirketId = data.sirketId !== undefined
            ? await resolveRuhsatSahibiSirketId(data.sirketId)
            : oldArac.sirketId;
        const kullanici = data.kullaniciId
            ? await getScopedKullaniciOrThrow(data.kullaniciId, { id: true, sirketId: true, calistigiKurum: true })
            : null;
        const selectedKiralik = data.sirketId !== undefined && normalizeSirketSelection(data.sirketId) === KIRALIK_SIRKET_OPTION_VALUE;
        const nextSirketId = requestedSirketId || (selectedKiralik ? null : (kullanici?.sirketId || null));
        const resolvedCalistigiKurum = data.calistigiKurum !== undefined ? (data.calistigiKurum?.trim() || null) : undefined;
        const requestedGuncelKm = normalizeKmInput(data.guncelKm);
        const previousGuncelKm = Number(oldArac.guncelKm || 0);

        // Yanlis yuksek KM araca ilk yazildiginda, ayni deger zimmet kayitlarina da yansimis olabiliyor.
        // Aracta duzeltme yapilirken bu "eski guncel KM" ile birebir eslesen zimmet alanlarini da asagi cekiyoruz.
        if (requestedGuncelKm !== null && requestedGuncelKm < previousGuncelKm) {
            await Promise.all([
                prisma.kullaniciZimmet.updateMany({
                    where: { aracId: id, baslangicKm: previousGuncelKm },
                    data: { baslangicKm: requestedGuncelKm },
                }),
                prisma.kullaniciZimmet.updateMany({
                    where: { aracId: id, bitisKm: previousGuncelKm },
                    data: { bitisKm: requestedGuncelKm },
                }),
            ]);
        }

        const resolvedGuncelKm = await resolveAracGuncelKmForUpdate(id, data.guncelKm);
        const guncelKmBilgiMesaji =
            requestedGuncelKm !== null && resolvedGuncelKm !== null && requestedGuncelKm < resolvedGuncelKm
                ? `Guncel KM, arac gecmisindeki daha yuksek deger (${resolvedGuncelKm}) ile otomatik senkronlandi.`
                : null;

        await prisma.arac.update({
            where: { id },
            data: {
                plaka: data.plaka?.replace(/\s+/g, '').toUpperCase(),
                marka: data.marka ? toUpperTr(data.marka) : undefined,
                model: data.model ? toUpperTr(data.model) : undefined,
                yil: data.yil ? Number(data.yil) : undefined,
                bulunduguIl: data.bulunduguIl ? normalizeIlEnum(data.bulunduguIl) : undefined,
                guncelKm: resolvedGuncelKm,
                bedel: data.bedel !== undefined ? normalizeBedelInput(data.bedel) : undefined,
                aciklama: data.aciklama !== undefined ? (data.aciklama?.trim() || null) : undefined,
                calistigiKurum: resolvedCalistigiKurum,
                sirketId: nextSirketId,
                kullaniciId: kullanici?.id || null,
                ruhsatSeriNo: data.ruhsatSeriNo || null,
                saseNo: data.saseNo || null,
                motorNo: data.motorNo || null,
                kategori: data.kategori || undefined
            }
        });

        // Zimmet mantığı: kullaniciId değişmişse veya ilk defa atanıyorsa
        const isKullaniciChanged = data.kullaniciId !== undefined && data.kullaniciId !== (oldArac as any)?.kullaniciId;
        
        if (isKullaniciChanged) {
            // 1. Varsa eski aktif zimmetleri kapat
            await (prisma as any).kullaniciZimmet.updateMany({
                where: { aracId: id, bitis: null },
                data: { 
                    bitis: new Date(),
                    bitisKm: resolvedGuncelKm ?? oldArac?.guncelKm
                }
            });

            // 2. Yeni kullanıcı atanmışsa yeni zimmet aç
            if (kullanici) {
                await (prisma as any).kullaniciZimmet.create({
                    data: {
                        aracId: id,
                        kullaniciId: kullanici.id,
                        baslangic: new Date(),
                        baslangicKm: resolvedGuncelKm ?? (oldArac?.guncelKm || 0)
                    }
                });
            }
        }

        if (data.muayeneGecerlilikTarihi) {
            const gecerlilik = new Date(data.muayeneGecerlilikTarihi);
            if (!Number.isNaN(gecerlilik.getTime())) {
                await prisma.muayene.updateMany({
                    where: {
                        aracId: id,
                        aktifMi: true,
                    },
                    data: { aktifMi: false },
                });
                await prisma.muayene.create({
                    data: {
                        aracId: id,
                        sirketId: nextSirketId,
                        muayeneTarihi: new Date(),
                        gecerlilikTarihi: gecerlilik,
                        km: resolvedGuncelKm,
                        aktifMi: true,
                    },
                });
            }
        }

        await syncAracGuncelKm(id);
        await syncAracDurumu(id);

        const nextPlaka = data.plaka?.replace(/\s+/g, "").toUpperCase() || oldArac.plaka;
        await logEntityActivity({
            actionType: ActivityActionType.UPDATE,
            entityType: ActivityEntityType.ARAC,
            entityId: id,
            summary: `${nextPlaka} plakalı araç güncellendi.`,
            actor,
            companyId: nextSirketId || actor.sirketId || null,
            metadata: {
                plaka: nextPlaka,
                oncekiKullaniciId: oldArac.kullaniciId,
                yeniKullaniciId: kullanici?.id || null,
                guncelKm: resolvedGuncelKm,
                bedel: data.bedel !== undefined ? normalizeBedelInput(data.bedel) : undefined,
                kategori: data.kategori || null,
                aciklama: data.aciklama !== undefined ? (data.aciklama?.trim() || null) : undefined,
                calistigiKurum: resolvedCalistigiKurum ?? null,
            },
        });

        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        revalidatePath('/dashboard/muayeneler');
        revalidatePath('/dashboard/zimmetler');
        return { success: true, info: guncelKmBilgiMesaji || undefined };
    } catch (e) {
        console.error(e);
        if (e instanceof Error && e.message.includes("bulunduguIl")) {
            return { success: false, error: "Bulunduğu il değeri geçersiz." };
        }
        return { success: false, error: "Araç güncellenemedi." };
    }
}

export async function unassignArac(id: string, bitisKm?: number) {
    try {
        const actor = await assertAuthenticatedUser();
        const scopeFilter = await getModelFilter("arac");

        const arac = await (prisma.arac as any).findFirst({
            where: { id, ...(scopeFilter as any) },
            select: { plaka: true, kullaniciId: true, guncelKm: true, sirketId: true }
        });

        if (!(arac as any)?.kullaniciId) {
            return { success: false, error: "Araçta zaten şoför bulunmuyor." };
        }
        const normalizedBitisKm = normalizeKmInput(bitisKm);
        if (normalizedBitisKm !== null) {
            await assertKmWriteConsistency({
                aracId: id,
                km: normalizedBitisKm,
                fieldLabel: "Sofor Ayrilma KM",
            });
        }

        // 1. Aracı boşa çıkar
        await (prisma.arac as any).update({
            where: { id },
            data: { kullaniciId: null }
        });

        // 2. Aktif zimmeti kapat
        await (prisma as any).kullaniciZimmet.updateMany({
            where: { aracId: id, bitis: null },
            data: {
                bitis: new Date(),
                bitisKm: normalizedBitisKm ?? arac.guncelKm
            }
        });

        await syncAracGuncelKm(id);
        await syncAracDurumu(id);

        await logEntityActivity({
            actionType: ActivityActionType.STATUS_CHANGE,
            entityType: ActivityEntityType.ARAC,
            entityId: id,
            summary: `${arac.plaka} aracının aktif şoför ataması kaldırıldı.`,
            actor,
            companyId: arac.sirketId || actor.sirketId || null,
            metadata: {
                ayrilmaKm: normalizedBitisKm ?? arac.guncelKm,
            },
        });

        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        revalidatePath('/dashboard/zimmetler');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Şoför ayırma işlemi başarısız." };
    }
}

export async function deleteArac(id: string) {
    try {
        const actor = await assertAuthenticatedUser();
        const scopeFilter = await getModelFilter("arac");

        const arac = await prisma.arac.findFirst({
            where: { id, ...(scopeFilter as any) },
            select: {
                id: true,
                plaka: true,
                durum: true,
                sirketId: true,
                kullaniciId: true,
                kullanici: { select: { ad: true, soyad: true } },
            }
        });

        if (!arac) {
            return { success: false, error: "Araç bulunamadı veya yetkiniz yok." };
        }

        const aktifZimmetSayisi = await (prisma as any).kullaniciZimmet.count({
            where: { aracId: id, bitis: null },
        });

        if (arac.kullaniciId || aktifZimmetSayisi > 0) {
            const soforAdSoyad = arac.kullanici
                ? `${arac.kullanici.ad || ""} ${arac.kullanici.soyad || ""}`.trim()
                : null;
            const detay = soforAdSoyad
                ? `Aktif şoför: ${soforAdSoyad}.`
                : "Araçta aktif zimmet kaydı bulunuyor.";
            return {
                success: false,
                code: "AKTIF_KULLANIM",
                error: `${arac.plaka} plakalı araç aktif kullanımda. ${detay} Silmeden önce şoförü araçtan ayırın.`,
            };
        }

        await softDeleteEntity("arac", id, actor.id);

        revalidatePath(PATH);
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/evrak-takip");
        revalidatePath("/dashboard/finans");
        revalidatePath("/dashboard/kasko");
        revalidatePath("/dashboard/trafik-sigortasi");
        revalidatePath("/dashboard/muayeneler");
        revalidatePath("/dashboard/yakitlar");
        revalidatePath("/dashboard/cezalar");
        revalidatePath("/dashboard/ceza-masraflari");
        revalidatePath("/dashboard/masraflar");
        revalidatePath("/dashboard/dokumanlar");
        revalidatePath("/dashboard/servis-kayitlari");
        revalidatePath("/dashboard/bakimlar");
        revalidatePath("/dashboard/zimmetler");
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Araç çöp kutusuna taşınamadı. Sistemde bir hata oluştu." };
    }
}

export async function importAraclarFromExcel(formData: FormData) {
    try {
        const actor = await assertAuthenticatedUser();
        const file = formData.get('file') as File;
        if (!file) return { success: false, error: 'Dosya bulunamadı' };
        const sirketId = await resolveActionSirketId(String(formData.get("sirketId") || ""));

        if (!sirketId) {
            return { success: false, error: 'Excel aktarımı için bir şirket seçmelisiniz.' };
        }
        
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any[] = xlsx.utils.sheet_to_json(worksheet);
        
        const formattedData = data.map(row => ({
            plaka: String(row.Plaka || row.plaka || '').replace(/\s+/g, '').toUpperCase(),
            marka: toUpperTr(String(row.Marka || row.marka || '')),
            model: toUpperTr(String(row.Model || row.model || '')),
            yil: parseInt(row.Yil || row.yil) || new Date().getFullYear(),
            bulunduguIl: normalizeIlEnum(row.BulunduguIl || row.Il || row.il || "ISTANBUL"),
            guncelKm: parseInt(row.GuncelKm || row.Km || row.km) || 0,
            aciklama: row.Aciklama || row.aciklama || null,
            sirketId,
            durum: 'BOSTA' as const,
            kategori: (row.Kategori || row.kategori || 'BINEK') as any,
            saseNo: row.SaseNo || row.saseno || row.saseNo || null,
            motorNo: row.MotorNo || row.motorno || row.motorNo || null,
        })).filter(r => r.plaka && r.marka);
        
        if (formattedData.length === 0) {
            return { success: false, error: 'Geçerli veri bulunamadı. Lütfen Plaka ve Marka sütunlarını kontrol edin.' };
        }

        const result = await prisma.arac.createMany({
            data: formattedData,
            skipDuplicates: true
        });

        if (result.count > 0) {
            await logEntityActivity({
                actionType: ActivityActionType.CREATE,
                entityType: ActivityEntityType.ARAC,
                entityId: `BULK_IMPORT_${Date.now()}`,
                summary: `Excel ile ${result.count} araç kaydı eklendi.`,
                actor,
                companyId: sirketId,
                metadata: {
                    importedCount: result.count,
                    totalRows: formattedData.length,
                    fileName: file.name,
                },
            });
        }
        
        revalidatePath(PATH);
        return { success: true, count: result.count };
    } catch (error) {
        console.error("Excel import error:", error);
        return { success: false, error: 'Dosya işlenirken sunucuda bir hata oluştu.' };
    }
}
