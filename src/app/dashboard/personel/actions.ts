"use server";
import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { ActivityActionType, ActivityEntityType, Prisma, Rol } from "@prisma/client";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import { logEntityActivity } from "@/lib/activity-log";
import { softDeleteEntity } from "@/lib/soft-delete";
import { resolveActionSirketId } from "@/lib/action-scope";
import { syncAracDurumu } from "@/lib/arac-durum";

const PATH = "/dashboard/personel";
const SIRKETLER_PATH = "/dashboard/sirketler";
const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");
const PERSONEL_ID_RETRY_LIMIT = 6;
let hasCachedCalistigiKurumColumn: boolean | null = null;

type ActorUser = {
    id: string;
    rol: string;
    sirketId?: string | null;
};

import { normalizeRole } from "@/lib/policy";

async function assertAuthorized() {
    const session = await auth();
    const user = session?.user as ActorUser | undefined;
    if (!user) throw new Error("Oturum bulunamadı.");
    const role = normalizeRole(user.rol);
    if (role === "ADMIN" || role === "TEKNIK" || role === "YETKILI") {
        return user;
    }
    throw new Error("Bu işlem için yetkiniz yok.");
}

async function getNextSequentialPersonelId() {
    const rows = await prisma.$queryRaw<Array<{ maxId: number | null }>>`
        SELECT MAX(CAST("id" AS INTEGER)) AS "maxId"
        FROM "Personel"
        WHERE "id" ~ '^[0-9]+$'
    `;

    const currentMax = rows[0]?.maxId ?? -1;
    return String(currentMax + 1).padStart(4, "0");
}

async function hasPersonelCalistigiKurumColumn() {
    if (hasCachedCalistigiKurumColumn !== null) {
        return hasCachedCalistigiKurumColumn;
    }
    try {
        const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'Personel'
                  AND column_name = 'calistigiKurum'
            ) AS "exists"
        `;
        hasCachedCalistigiKurumColumn = Boolean(rows?.[0]?.exists);
    } catch {
        hasCachedCalistigiKurumColumn = false;
    }
    return hasCachedCalistigiKurumColumn;
}

export async function createPersonel(data: { ad: string; soyad: string; telefon?: string; rol: Rol; sirketId?: string; disFirmaId?: string; calistigiKurum?: string; tcNo?: string }) {
    try {
        const actor = await assertAuthorized();
        const sirketId = await resolveActionSirketId(data.sirketId);
        const disFirmaId = data.disFirmaId?.trim() || null;
        const canWriteCalistigiKurum = await hasPersonelCalistigiKurumColumn();
        const personelWriteSelect: any = {
            id: true,
            ad: true,
            soyad: true,
            rol: true,
            sirketId: true,
        };
        if (canWriteCalistigiKurum) {
            personelWriteSelect.calistigiKurum = true;
        }

        let created:
            | {
                  id: string;
                  ad: string;
                  soyad: string;
                  rol: Rol;
                  sirketId: string | null;
                  calistigiKurum?: string | null;
              }
            | null = null;
        for (let attempt = 0; attempt < PERSONEL_ID_RETRY_LIMIT; attempt += 1) {
            const nextId = await getNextSequentialPersonelId();
            try {
                created = (await prisma.kullanici.create({
                    data: {
                        id: nextId,
                        ad: forceUppercase(data.ad || ""),
                        soyad: forceUppercase(data.soyad || ""),
                        eposta: null,
                        sifre: null,
                        telefon: data.telefon || null,
                        rol: data.rol,
                        ...(sirketId ? { sirket: { connect: { id: sirketId } } } : {}),
                        ...(disFirmaId ? { disFirma: { connect: { id: disFirmaId } } } : {}),
                        ...(canWriteCalistigiKurum ? { calistigiKurum: data.calistigiKurum?.trim() || null } : {}),
                        tcNo: data.tcNo || null,
                        onayDurumu: "ONAYLANDI",
                    },
                    select: personelWriteSelect,
                })) as any;
                break;
            } catch (error) {
                const isIdConflict =
                    error instanceof Prisma.PrismaClientKnownRequestError &&
                    error.code === "P2002" &&
                    Array.isArray((error.meta as { target?: unknown })?.target) &&
                    ((error.meta as { target?: unknown[] }).target as unknown[]).includes("id");
                if (isIdConflict) {
                    continue;
                }
                throw error;
            }
        }

        if (!created) {
            return { success: false, error: "Personel ID üretilemedi. Lütfen tekrar deneyin." };
        }

        await logEntityActivity({
            actionType: ActivityActionType.CREATE,
            entityType: ActivityEntityType.KULLANICI,
            entityId: created.id,
            summary: `${created.ad} ${created.soyad} personeli oluşturuldu.`,
            actor,
            companyId: sirketId || actor.sirketId || null,
            metadata: {
                rol: created.rol,
                eposta: null,
                sirketId: sirketId || null,
                disFirmaId,
                calistigiKurum: canWriteCalistigiKurum ? ((created as any).calistigiKurum || null) : null,
            },
        });

        revalidatePath(PATH);
        revalidatePath(`${PATH}/${created.id}`);
        revalidatePath(SIRKETLER_PATH);
        return { success: true };
    } catch (e: any) {
        console.error("CreatePersonel Error:", e);
        const message = e instanceof Error ? e.message : "";
        if (message.includes("Invalid `prisma.kullanici.create()` invocation")) {
            return { success: false, error: "Personel kaydı sırasında şema uyumsuzluğu oluştu. Sunucuyu yeniden başlatıp tekrar deneyin." };
        }
        if (e.message) return { success: false, error: e.message };
        return { success: false, error: "Personel kaydedilemedi. Beklenmedik bir hata oluştu." };
    }
}

export async function updatePersonel(id: string, data: { ad: string; soyad: string; telefon?: string; rol: Rol; sirketId?: string; disFirmaId?: string; calistigiKurum?: string; tcNo?: string }) {
    try {
        const actor = await assertAuthorized();
        const sirketId = await resolveActionSirketId(data.sirketId);
        const disFirmaId = data.disFirmaId?.trim() || null;
        const canWriteCalistigiKurum = await hasPersonelCalistigiKurumColumn();
        const personelWriteSelect: any = {
            id: true,
            ad: true,
            soyad: true,
            rol: true,
            sirketId: true,
        };
        if (canWriteCalistigiKurum) {
            personelWriteSelect.calistigiKurum = true;
        }
        const oncekiKayit = await prisma.kullanici.findUnique({
            where: { id },
            select: { rol: true, ad: true, soyad: true, sirketId: true },
        });

        const updated = (await prisma.kullanici.update({
            where: { id },
            data: {
                ad: forceUppercase(data.ad || ""),
                soyad: forceUppercase(data.soyad || ""),
                telefon: data.telefon || null,
                rol: data.rol,
                ...(sirketId
                    ? { sirket: { connect: { id: sirketId } } }
                    : { sirket: { disconnect: true } }),
                ...(disFirmaId
                    ? { disFirma: { connect: { id: disFirmaId } } }
                    : { disFirma: { disconnect: true } }),
                ...(canWriteCalistigiKurum ? { calistigiKurum: data.calistigiKurum?.trim() || null } : {}),
                tcNo: data.tcNo || null,
            },
            select: personelWriteSelect,
        })) as any;

        const roleChanged = Boolean(oncekiKayit && oncekiKayit.rol !== updated.rol);
        await logEntityActivity({
            actionType: roleChanged ? ActivityActionType.ROLE_CHANGE : ActivityActionType.UPDATE,
            entityType: ActivityEntityType.KULLANICI,
            entityId: updated.id,
            summary: roleChanged
                ? `${updated.ad} ${updated.soyad} personelinin rolü değiştirildi.`
                : `${updated.ad} ${updated.soyad} personeli güncellendi.`,
            actor,
            companyId: sirketId || actor.sirketId || null,
            metadata: {
                oncekiRol: oncekiKayit?.rol || null,
                yeniRol: updated.rol,
                oncekiSirketId: oncekiKayit?.sirketId || null,
                yeniSirketId: sirketId || null,
                disFirmaId,
                calistigiKurum: canWriteCalistigiKurum ? ((updated as any).calistigiKurum || null) : null,
            },
        });

        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        revalidatePath(SIRKETLER_PATH);
        return { success: true };
    } catch (e: unknown) {
        console.error("UpdatePersonel Error:", e);
        const message = e instanceof Error ? e.message : "";

        if (
            message.includes("Invalid `prisma.kullanici.update()` invocation") ||
            message.includes("Unknown argument `sirketId`") ||
            message.includes("Unknown argument `calistigiKurum`") ||
            message.includes("column \"calistigiKurum\" does not exist") ||
            message.includes("column \"sehir\" does not exist")
        ) {
            return {
                success: false,
                error:
                    "Personel kurum alanı için şema güncel değil. `npx prisma generate` çalıştırıp dev sunucuyu yeniden başlatın, ardından migration'ı uygulayın.",
            };
        }

        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            const target = Array.isArray(e.meta?.target)
                ? e.meta.target.join(", ")
                : String(e.meta?.target || "benzersiz alan");
            return { success: false, error: `Aynı değerle başka personel kaydı var (${target}).` };
        }

        if (message) {
            return { success: false, error: message };
        }

        return { success: false, error: "Personel güncellenemedi." };
    }
}

export async function deletePersonel(id: string) {
    try {
        const actor = await assertAuthorized();
        const personel = await prisma.kullanici.findUnique({
            where: { id },
            select: {
                id: true,
                ad: true,
                soyad: true,
                arac: { select: { id: true, plaka: true } },
            },
        });

        if (!personel) {
            return { success: false, error: "Personel bulunamadı." };
        }

        const aktifZimmet = personel.arac
            ? personel.arac
            : await prisma.kullaniciZimmet.findFirst({
                  where: { kullaniciId: id, bitis: null },
                  select: { arac: { select: { id: true, plaka: true } } },
              }).then((row) => row?.arac || null);

        if (aktifZimmet) {
            return {
                success: false,
                code: "AKTIF_KULLANIM",
                error: `${personel.ad} ${personel.soyad} üzerinde ${aktifZimmet.plaka} plakalı aktif araç zimmeti var. Önce aracı personelden ayırın.`,
            };
        }

        await softDeleteEntity("kullanici", id, actor.id);
        revalidatePath(PATH);
        revalidatePath(`${PATH}/${id}`);
        revalidatePath(SIRKETLER_PATH);
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

        await syncAracDurumu(arac.id);
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
