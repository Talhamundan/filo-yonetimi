"use server";
import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";

const PATH = "/dashboard/personel";
const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");

async function assertAdmin() {
    const session = await auth();
    if (!session?.user || (session.user as any).rol !== "ADMIN") {
        throw new Error("Bu işlem için yetkiniz yok.");
    }
}

export async function createPersonel(data: { ad: string; soyad: string; eposta?: string; telefon?: string; rol: string; sirketId?: string; sehir?: string; tcNo?: string }) {
    try {
        await assertAdmin();

        const created = await prisma.kullanici.create({
            data: {
                ad: forceUppercase(data.ad || ""),
                soyad: forceUppercase(data.soyad || ""),
                eposta: data.eposta || null,
                telefon: data.telefon || null,
                rol: data.rol as any,
                sirketId: data.sirketId || null,
                sehir: data.sehir as any || null,
                tcNo: data.tcNo || null,
            }
        });
        revalidatePath(PATH);
        revalidatePath(`${PATH}/${created.id}`);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Personel kaydedilemedi. E-posta veya TC No çakışması olabilir." };
    }
}

export async function updatePersonel(id: string, data: { ad: string; soyad: string; eposta?: string; telefon?: string; rol: string; sirketId?: string; sehir?: string; tcNo?: string }) {
    try {
        await assertAdmin();

        await prisma.kullanici.update({
            where: { id },
            data: {
                ad: forceUppercase(data.ad || ""),
                soyad: forceUppercase(data.soyad || ""),
                eposta: data.eposta || null,
                telefon: data.telefon || null,
                rol: data.rol as any,
                sirketId: data.sirketId || null,
                sehir: data.sehir as any || null,
                tcNo: data.tcNo || null,
            }
        });
        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Personel güncellenemedi." };
    }
}

export async function deletePersonel(id: string) {
    try {
        await assertAdmin();

        await prisma.kullanici.delete({ where: { id } });
        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Personel silinemedi." };
    }
}

export async function araciBirak(personelId: string) {
    try {
        // Sadece admin veya ilgili kullanıcının kendisi bu işlemi yapabilsin
        const session = await auth();
        const currentUser = session?.user as any | undefined;
        if (!currentUser) {
            return { success: false, error: "Oturum bulunamadı." };
        }
        const isSelf = currentUser.id === personelId;
        const admin = await isAdmin();
        if (!admin && !isSelf) {
            return { success: false, error: "Bu işlem için yetkiniz yok." };
        }

        // 1. Personelin üzerindeki aracı bul
        const arac = await prisma.arac.findUnique({
            where: { kullaniciId: personelId }
        });

        if (!arac) {
            return { success: false, error: "Zimmetli araç bulunamadı." };
        }

        // 2. Aracı boşa çıkar
        await prisma.arac.update({
            where: { id: arac.id },
            data: {
                kullaniciId: null,
                durum: 'BOSTA'
            }
        });

        // 3. Aktif zimmet kaydını kapat (bitis tarihini bugüne çek)
        await prisma.kullaniciZimmet.updateMany({
            where: {
                kullaniciId: personelId,
                aracId: arac.id,
                bitis: null
            },
            data: {
                bitis: new Date(),
                notlar: (await prisma.kullaniciZimmet.findFirst({ where: { kullaniciId: personelId, aracId: arac.id, bitis: null } }))?.notlar + " (Sistem tarafından sonlandırıldı)"
            }
        });

        revalidatePath(PATH);
        revalidatePath(`${PATH}/${personelId}`);
        revalidatePath('/dashboard/araclar');
        revalidatePath(`/dashboard/araclar/${arac.id}`);
        
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Araç bırakma işlemi başarısız oldu." };
    }
}
