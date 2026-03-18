"use server";
import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";

const PATH = "/dashboard/personel";
const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");

type ActorUser = {
    id: string;
    rol: string;
    sirketId?: string | null;
};

async function assertAdmin() {
    const session = await auth();
    const user = session?.user as ActorUser | undefined;
    if (!user || user.rol !== "ADMIN") {
        throw new Error("Bu işlem için yetkiniz yok.");
    }
    return user;
}

export async function createPersonel(data: { ad: string; soyad: string; eposta?: string; telefon?: string; rol: string; sirketId?: string; sehir?: string; tcNo?: string }) {
    try {
        const actor = await assertAdmin();

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

        await logEntityActivity({
            actionType: ActivityActionType.CREATE,
            entityType: ActivityEntityType.KULLANICI,
            entityId: created.id,
            summary: `${created.ad} ${created.soyad} kullanıcısı oluşturuldu.`,
            actor,
            companyId: created.sirketId || actor.sirketId || null,
            metadata: {
                rol: created.rol,
                eposta: created.eposta,
                sirketId: created.sirketId,
            },
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
        const actor = await assertAdmin();
        const oncekiKayit = await prisma.kullanici.findUnique({
            where: { id },
            select: { rol: true, ad: true, soyad: true, sirketId: true },
        });

        const updated = await prisma.kullanici.update({
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

        const roleChanged = Boolean(oncekiKayit && oncekiKayit.rol !== updated.rol);
        await logEntityActivity({
            actionType: roleChanged ? ActivityActionType.ROLE_CHANGE : ActivityActionType.UPDATE,
            entityType: ActivityEntityType.KULLANICI,
            entityId: updated.id,
            summary: roleChanged
                ? `${updated.ad} ${updated.soyad} kullanıcısının rolü değiştirildi.`
                : `${updated.ad} ${updated.soyad} kullanıcısı güncellendi.`,
            actor,
            companyId: updated.sirketId || actor.sirketId || null,
            metadata: {
                oncekiRol: oncekiKayit?.rol || null,
                yeniRol: updated.rol,
                oncekiSirketId: oncekiKayit?.sirketId || null,
                yeniSirketId: updated.sirketId || null,
            },
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
        const actor = await assertAdmin();
        await softDeleteEntity("kullanici", id, actor.id);
        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Personel çöp kutusuna taşınamadı." };
    }
}

export async function araciBirak(personelId: string) {
    try {
        // Sadece admin veya ilgili kullanıcının kendisi bu işlemi yapabilsin
        const session = await auth();
        const currentUser = session?.user as ActorUser | undefined;
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

        await logEntityActivity({
            actionType: ActivityActionType.STATUS_CHANGE,
            entityType: ActivityEntityType.KULLANICI,
            entityId: personelId,
            summary: "Kullanıcının araç zimmeti sonlandırıldı.",
            actor: currentUser,
            companyId: arac.sirketId || currentUser.sirketId || null,
            metadata: {
                aracId: arac.id,
                plaka: arac.plaka,
            },
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
