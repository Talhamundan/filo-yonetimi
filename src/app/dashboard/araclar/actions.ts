"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import * as xlsx from "xlsx";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { getSirketFilter } from "@/lib/auth-utils";
import { assertAuthenticatedUser, getScopedKullaniciOrThrow, resolveActionSirketId } from "@/lib/action-scope";
import { assertKmWriteConsistency, normalizeKmInput, resolveAracGuncelKmForUpdate, syncAracGuncelKm } from "@/lib/km-consistency";
import { syncAracDurumu } from "@/lib/arac-durum";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";

const PATH = "/dashboard/araclar";
const toUpperTr = (value: string) => value.toLocaleUpperCase("tr-TR");

export async function createArac(data: {
    plaka: string;
    marka: string;
    model: string;
    yil: number;
    muayeneGecerlilikTarihi?: string | null;
    bulunduguIl: string;
    guncelKm: number;
    sirketId?: string | null;
    kullaniciId?: string | null;
    hgsNo?: string | null;
    ruhsatSeriNo?: string | null;
    saseNo?: string | null;
    kategori?: any;
}) {
    try {
        const actor = await assertAuthenticatedUser();
        const sirketId = await resolveActionSirketId(data.sirketId);
        const kullanici = data.kullaniciId
            ? await getScopedKullaniciOrThrow(data.kullaniciId, { id: true, sirketId: true })
            : null;
        const guncelKm = normalizeKmInput(data.guncelKm) ?? 0;
        
        const arac = await prisma.arac.create({
            data: {
                plaka: data.plaka.replace(/\s+/g, '').toUpperCase(),
                marka: toUpperTr(data.marka),
                model: toUpperTr(data.model),
                yil: Number(data.yil),
                bulunduguIl: data.bulunduguIl as any,
                guncelKm,
                sirketId,
                kullaniciId: kullanici?.id || null,
                hgsNo: data.hgsNo || null,
                ruhsatSeriNo: data.ruhsatSeriNo || null,
                saseNo: data.saseNo || null,
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
                kullaniciId: arac.kullaniciId,
            },
        });

        revalidatePath(PATH);
        revalidatePath('/dashboard/muayeneler');
        revalidatePath('/dashboard/zimmetler');
        return { success: true };
    } catch (e: any) {
        console.error(e);
        if (e.code === 'P2002') return { success: false, error: "Bu plaka zaten kayıtlı!" };
        return { success: false, error: "Araç kaydedilemedi." };
    }
}

export async function updateArac(id: string, data: any) {
    try {
        const actor = await assertAuthenticatedUser();
        const sirketFilter = await getSirketFilter();

        const oldArac = await prisma.arac.findFirst({
            where: { id, ...(sirketFilter as any) },
            select: { plaka: true, kullaniciId: true, guncelKm: true, sirketId: true }
        });

        if (!oldArac) {
            return { success: false, error: "Araç bulunamadı veya yetkiniz yok." };
        }
        const kullanici = data.kullaniciId
            ? await getScopedKullaniciOrThrow(data.kullaniciId, { id: true, sirketId: true })
            : null;
        const requestedGuncelKm = normalizeKmInput(data.guncelKm);
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
                bulunduguIl: data.bulunduguIl as any,
                guncelKm: resolvedGuncelKm,
                // Sirket ID client'tan gelmemeli; mevcut kaydı koru
                sirketId: oldArac.sirketId,
                kullaniciId: kullanici?.id || null,
                hgsNo: data.hgsNo || null,
                ruhsatSeriNo: data.ruhsatSeriNo || null,
                saseNo: data.saseNo || null,
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

        await syncAracGuncelKm(id);
        await syncAracDurumu(id);

        const nextPlaka = data.plaka?.replace(/\s+/g, "").toUpperCase() || oldArac.plaka;
        await logEntityActivity({
            actionType: ActivityActionType.UPDATE,
            entityType: ActivityEntityType.ARAC,
            entityId: id,
            summary: `${nextPlaka} plakalı araç güncellendi.`,
            actor,
            companyId: oldArac.sirketId || actor.sirketId || null,
            metadata: {
                plaka: nextPlaka,
                oncekiKullaniciId: oldArac.kullaniciId,
                yeniKullaniciId: kullanici?.id || null,
                guncelKm: resolvedGuncelKm,
                kategori: data.kategori || null,
            },
        });

        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        revalidatePath('/dashboard/zimmetler');
        return { success: true, info: guncelKmBilgiMesaji || undefined };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Araç güncellenemedi." };
    }
}

export async function unassignArac(id: string, bitisKm?: number) {
    try {
        const actor = await assertAuthenticatedUser();
        const sirketFilter = await getSirketFilter();

        const arac = await (prisma.arac as any).findFirst({
            where: { id, ...(sirketFilter as any) },
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
        const sirketFilter = await getSirketFilter();

        const arac = await prisma.arac.findFirst({
            where: { id, ...(sirketFilter as any) },
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
        revalidatePath("/dashboard/hgs");
        revalidatePath("/dashboard/cezalar");
        revalidatePath("/dashboard/ceza-masraflari");
        revalidatePath("/dashboard/masraflar");
        revalidatePath("/dashboard/dokumanlar");
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
            bulunduguIl: String(row.BulunduguIl || row.Il || row.il || 'İSTANBUL').toUpperCase() as any,
            guncelKm: parseInt(row.GuncelKm || row.Km || row.km) || 0,
            sirketId,
            durum: 'BOSTA' as const,
            kategori: (row.Kategori || row.kategori || 'BINEK') as any
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
