"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import * as xlsx from "xlsx";
import { getCurrentSirketId } from "@/lib/auth-utils";

const PATH = '/dashboard/araclar';

export async function createArac(data: {
    plaka: string;
    marka: string;
    model: string;
    yil: number;
    bulunduguIl: string;
    guncelKm: number;
    sirketId?: string | null;
    kullaniciId?: string | null;
    hgsNo?: string | null;
    ruhsatSeriNo?: string | null;
    kategori?: any;
}) {
    try {
        const currentSirketId = await getCurrentSirketId();
        
        const arac = await prisma.arac.create({
            data: {
                plaka: data.plaka.replace(/\s+/g, '').toUpperCase(),
                marka: data.marka,
                model: data.model,
                yil: Number(data.yil),
                bulunduguIl: data.bulunduguIl as any,
                guncelKm: Number(data.guncelKm),
                sirketId: (currentSirketId || data.sirketId) || null,
                kullaniciId: data.kullaniciId || null,
                hgsNo: data.hgsNo || null,
                ruhsatSeriNo: data.ruhsatSeriNo || null,
                durum: 'AKTIF',
                kategori: data.kategori || 'BINEK'
            }
        });

        // Zimmet kaydı oluştur
        if (data.kullaniciId) {
            await prisma.kullaniciZimmet.create({
                data: {
                    aracId: arac.id,
                    kullaniciId: data.kullaniciId,
                    baslangic: new Date(),
                    baslangicKm: Number(data.guncelKm) || 0
                }
            });
        }

        revalidatePath(PATH);
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
        const oldArac = await prisma.arac.findUnique({ 
            where: { id }, 
            select: { kullaniciId: true, guncelKm: true } 
        });

        await prisma.arac.update({
            where: { id },
            data: {
                plaka: data.plaka?.replace(/\s+/g, '').toUpperCase(),
                marka: data.marka,
                model: data.model,
                yil: data.yil ? Number(data.yil) : undefined,
                bulunduguIl: data.bulunduguIl as any,
                guncelKm: data.guncelKm ? Number(data.guncelKm) : undefined,
                sirketId: data.sirketId || null,
                kullaniciId: data.kullaniciId || null,
                hgsNo: data.hgsNo || null,
                ruhsatSeriNo: data.ruhsatSeriNo || null,
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
                    bitisKm: data.guncelKm ? Number(data.guncelKm) : oldArac?.guncelKm
                }
            });

            // 2. Yeni kullanıcı atanmışsa yeni zimmet aç
            if (data.kullaniciId) {
                await (prisma as any).kullaniciZimmet.create({
                    data: {
                        aracId: id,
                        kullaniciId: data.kullaniciId,
                        baslangic: new Date(),
                        baslangicKm: data.guncelKm ? Number(data.guncelKm) : (oldArac?.guncelKm || 0)
                    }
                });
            }
        }

        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        revalidatePath('/dashboard/zimmetler');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Araç güncellenemedi." };
    }
}

export async function unassignArac(id: string, bitisKm?: number) {
    try {
        const arac = await (prisma.arac as any).findUnique({
            where: { id },
            select: { kullaniciId: true, guncelKm: true }
        });

        if (!(arac as any)?.kullaniciId) {
            return { success: false, error: "Araçta zaten şoför bulunmuyor." };
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
                bitisKm: bitisKm || arac.guncelKm
            }
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
        // Check for dependencies (sigorta, kasko, muayene etc) is handled by Prisma or we can do it manually
        await prisma.arac.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Araç silinemedi. Bağlı kayıtlar (poliçe, ceza vb.) olabilir." };
    }
}

export async function importAraclarFromExcel(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) return { success: false, error: 'Dosya bulunamadı' };
        
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any[] = xlsx.utils.sheet_to_json(worksheet);
        
        const formattedData = data.map(row => ({
            plaka: String(row.Plaka || row.plaka || '').replace(/\s+/g, '').toUpperCase(),
            marka: String(row.Marka || row.marka || ''),
            model: String(row.Model || row.model || ''),
            yil: parseInt(row.Yil || row.yil) || new Date().getFullYear(),
            bulunduguIl: String(row.BulunduguIl || row.Il || row.il || 'İSTANBUL').toUpperCase() as any,
            guncelKm: parseInt(row.GuncelKm || row.Km || row.km) || 0,
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
