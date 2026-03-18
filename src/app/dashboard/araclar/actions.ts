"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import * as xlsx from "xlsx";
import { getSirketFilter } from "@/lib/auth-utils";
import { assertAuthenticatedUser, getScopedKullaniciOrThrow, resolveActionSirketId } from "@/lib/action-scope";
import { assertKmWriteConsistency, normalizeKmInput, resolveAracGuncelKmForUpdate, syncAracGuncelKm } from "@/lib/km-consistency";

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
        await assertAuthenticatedUser();
        const sirketId = await resolveActionSirketId(data.sirketId);

        if (!sirketId) {
            return { success: false, error: "Şirket bilgisi olmadan araç ekleyemezsiniz." };
        }
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
                durum: 'AKTIF',
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
        await assertAuthenticatedUser();
        const sirketFilter = await getSirketFilter();

        const oldArac = await prisma.arac.findFirst({
            where: { id, ...(sirketFilter as any) },
            select: { kullaniciId: true, guncelKm: true, sirketId: true }
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
        await assertAuthenticatedUser();
        const sirketFilter = await getSirketFilter();

        const arac = await (prisma.arac as any).findFirst({
            where: { id, ...(sirketFilter as any) },
            select: { kullaniciId: true, guncelKm: true }
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
        await assertAuthenticatedUser();
        const sirketFilter = await getSirketFilter();

        const arac = await prisma.arac.findFirst({
            where: { id, ...(sirketFilter as any) },
            select: {
                id: true,
                plaka: true,
                durum: true,
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

        await prisma.$transaction([
            prisma.trafikSigortasi.deleteMany({ where: { aracId: id } }),
            prisma.kasko.deleteMany({ where: { aracId: id } }),
            prisma.muayene.deleteMany({ where: { aracId: id } }),
            prisma.bakim.deleteMany({ where: { aracId: id } }),
            prisma.ceza.deleteMany({ where: { aracId: id } }),
            prisma.masraf.deleteMany({ where: { aracId: id } }),
            prisma.kullaniciZimmet.deleteMany({ where: { aracId: id } }),
            prisma.yakit.deleteMany({ where: { aracId: id } }),
            prisma.dokuman.deleteMany({ where: { aracId: id } }),
            (prisma as any).hgsYukleme.deleteMany({ where: { aracId: id } }),
            prisma.arac.delete({ where: { id } })
        ]);

        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Araç silinemedi. Sistemde bir hata oluştu." };
    }
}

export async function importAraclarFromExcel(formData: FormData) {
    try {
        await assertAuthenticatedUser();
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
            durum: 'AKTIF' as const,
            kategori: (row.Kategori || row.kategori || 'BINEK') as any
        })).filter(r => r.plaka && r.marka);
        
        if (formattedData.length === 0) {
            return { success: false, error: 'Geçerli veri bulunamadı. Lütfen Plaka ve Marka sütunlarını kontrol edin.' };
        }

        const result = await prisma.arac.createMany({
            data: formattedData,
            skipDuplicates: true
        });
        
        revalidatePath(PATH);
        return { success: true, count: result.count };
    } catch (error) {
        console.error("Excel import error:", error);
        return { success: false, error: 'Dosya işlenirken sunucuda bir hata oluştu.' };
    }
}
