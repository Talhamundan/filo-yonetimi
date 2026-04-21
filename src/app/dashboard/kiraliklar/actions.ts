"use server";

import { revalidatePath } from "next/cache";
import { Prisma, Rol } from "@prisma/client";
import prisma from "@/lib/prisma";
import { assertAuthenticatedUser } from "@/lib/action-scope";
import { canAccessAllCompanies, getCurrentUserRole, getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { createPersonel, deletePersonel, updatePersonel } from "@/app/dashboard/personel/actions";
import { deleteArac } from "@/app/dashboard/araclar/actions";
import { syncAracDurumu } from "@/lib/arac-durum";

type KiralikAracInput = {
    plaka: string;
    sirketId: string;
    disFirmaId: string;
    kullaniciId?: string | null;
};

type KiralikPersonelInput = {
    ad: string;
    soyad: string;
    telefon?: string;
    sirketId: string;
    disFirmaId: string;
};

function normalizePlaka(value: string) {
    return value.replace(/\s+/g, "").toLocaleUpperCase("tr-TR").trim();
}

async function assertKiralikManageAccess() {
    const [actor, role, hasGlobalCompanyAccess] = await Promise.all([
        assertAuthenticatedUser(),
        getCurrentUserRole(),
        canAccessAllCompanies(),
    ]);

    const canManage = role === "ADMIN" || (role === "YETKILI" && hasGlobalCompanyAccess);
    if (!canManage) {
        throw new Error("Kiralık yönetimi için yetkiniz yok.");
    }

    return actor;
}

async function ensureAccessibleSirket(sirketId: string) {
    const normalizedId = (sirketId || "").trim();
    if (!normalizedId) {
        throw new Error("Çalıştığı firmamız zorunludur.");
    }

    const sirketScopeFilter = await getSirketListFilter();
    const sirket = await prisma.sirket.findFirst({
        where: {
            AND: [
                { id: normalizedId },
                sirketScopeFilter as Prisma.SirketWhereInput,
            ],
        },
        select: { id: true, ad: true, bulunduguIl: true },
    });
    if (!sirket) {
        throw new Error("Seçilen şirket bulunamadı veya erişim yetkiniz yok.");
    }
    return sirket;
}

async function ensureKiralikDisFirma(disFirmaId: string) {
    const normalizedId = (disFirmaId || "").trim();
    if (!normalizedId) {
        throw new Error("Taşeron firma zorunludur.");
    }

    const disFirma = await prisma.disFirma.findFirst({
        where: { id: normalizedId, tur: "KIRALIK" },
        select: { id: true, ad: true },
    });
    if (!disFirma) {
        throw new Error("Seçilen firma kiralık türünde bulunamadı.");
    }
    return disFirma;
}

async function ensureKiralikDriver(kullaniciId: string | null | undefined, disFirmaId: string) {
    const normalizedId = (kullaniciId || "").trim();
    if (!normalizedId) return null;

    const personelScopeFilter = await getModelFilter("personel");
    const driver = await prisma.kullanici.findFirst({
        where: {
            AND: [
                { id: normalizedId, deletedAt: null, disFirmaId },
                personelScopeFilter as Prisma.KullaniciWhereInput,
            ],
        },
        select: { id: true, ad: true, soyad: true },
    });

    if (!driver) {
        throw new Error("Seçilen şoför kiralık personel listesinde bulunamadı.");
    }

    return driver;
}

async function ensureDriverNotAssignedElsewhere(kullaniciId: string | null, excludedAracId?: string) {
    if (!kullaniciId) return;
    const assignedVehicle = await prisma.arac.findFirst({
        where: {
            kullaniciId,
            deletedAt: null,
            ...(excludedAracId ? { NOT: { id: excludedAracId } } : {}),
        },
        select: { id: true, plaka: true },
    });
    if (assignedVehicle) {
        throw new Error(`${assignedVehicle.plaka || "-"} plakalı araçta seçili şoför zaten aktif.`);
    }
}

function revalidateKiralikPaths() {
    revalidatePath("/dashboard/kiraliklar");
    revalidatePath("/dashboard/araclar");
    revalidatePath("/dashboard/personel");
    revalidatePath("/dashboard/yakitlar");
    revalidatePath("/dashboard/zimmetler");
}

export async function createKiralikArac(input: KiralikAracInput) {
    try {
        await assertKiralikManageAccess();

        const plaka = normalizePlaka(input.plaka || "");
        if (!plaka) {
            return { success: false, error: "Plaka zorunludur." };
        }

        const [sirket, disFirma] = await Promise.all([
            ensureAccessibleSirket(input.sirketId),
            ensureKiralikDisFirma(input.disFirmaId),
        ]);
        const driver = await ensureKiralikDriver(input.kullaniciId || null, disFirma.id);
        await ensureDriverNotAssignedElsewhere(driver?.id || null);

        const existing = await prisma.arac.findUnique({
            where: { plaka },
            select: { id: true, deletedAt: true },
        });
        if (existing?.deletedAt) {
            return { success: false, error: "Bu plaka çöp kutusunda kayıtlı. Önce geri yükleyin." };
        }
        if (existing) {
            return { success: false, error: "Bu plaka zaten kayıtlı." };
        }

        const arac = await prisma.arac.create({
            data: {
                plaka,
                marka: "KIRALIK",
                model: "ARAC",
                yil: new Date().getFullYear(),
                guncelKm: 0,
                bulunduguIl: sirket.bulunduguIl || "BURSA",
                durum: driver ? "AKTIF" : "BOSTA",
                kategori: "BINEK",
                sirketId: sirket.id,
                disFirmaId: disFirma.id,
                calistigiKurum: sirket.ad,
                kullaniciId: driver?.id || null,
            },
            select: { id: true, guncelKm: true },
        });

        if (driver) {
            await prisma.kullaniciZimmet.create({
                data: {
                    aracId: arac.id,
                    kullaniciId: driver.id,
                    baslangic: new Date(),
                    baslangicKm: arac.guncelKm || 0,
                },
            });
        }

        await syncAracDurumu(arac.id).catch(() => null);
        revalidateKiralikPaths();
        return { success: true };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { success: false, error: "Bu plaka veya şoför zaten farklı kayıtta kullanımda." };
        }
        return { success: false, error: error instanceof Error ? error.message : "Kiralık araç eklenemedi." };
    }
}

export async function updateKiralikArac(id: string, input: KiralikAracInput) {
    try {
        await assertKiralikManageAccess();

        const plaka = normalizePlaka(input.plaka || "");
        if (!plaka) {
            return { success: false, error: "Plaka zorunludur." };
        }

        const aracScopeFilter = await getModelFilter("arac");
        const mevcut = await prisma.arac.findFirst({
            where: {
                AND: [
                    { id, deletedAt: null, disFirma: { is: { tur: "KIRALIK" } } },
                    aracScopeFilter as Prisma.AracWhereInput,
                ],
            },
            select: {
                id: true,
                kullaniciId: true,
                guncelKm: true,
                bulunduguIl: true,
            },
        });
        if (!mevcut) {
            return { success: false, error: "Kiralık araç kaydı bulunamadı." };
        }

        const [sirket, disFirma] = await Promise.all([
            ensureAccessibleSirket(input.sirketId),
            ensureKiralikDisFirma(input.disFirmaId),
        ]);
        const driver = await ensureKiralikDriver(input.kullaniciId || null, disFirma.id);
        await ensureDriverNotAssignedElsewhere(driver?.id || null, mevcut.id);

        if ((mevcut.kullaniciId || null) !== (driver?.id || null)) {
            await prisma.kullaniciZimmet.updateMany({
                where: { aracId: mevcut.id, bitis: null },
                data: { bitis: new Date(), bitisKm: mevcut.guncelKm || 0 },
            });

            if (driver) {
                await prisma.kullaniciZimmet.create({
                    data: {
                        aracId: mevcut.id,
                        kullaniciId: driver.id,
                        baslangic: new Date(),
                        baslangicKm: mevcut.guncelKm || 0,
                    },
                });
            }
        }

        await prisma.arac.update({
            where: { id: mevcut.id },
            data: {
                plaka,
                sirketId: sirket.id,
                disFirmaId: disFirma.id,
                calistigiKurum: sirket.ad,
                bulunduguIl: sirket.bulunduguIl || mevcut.bulunduguIl || "BURSA",
                kullaniciId: driver?.id || null,
                durum: driver ? "AKTIF" : "BOSTA",
            },
        });

        await syncAracDurumu(mevcut.id).catch(() => null);
        revalidateKiralikPaths();
        return { success: true };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { success: false, error: "Bu plaka veya şoför başka kayıtta kullanımda." };
        }
        return { success: false, error: error instanceof Error ? error.message : "Kiralık araç güncellenemedi." };
    }
}

export async function deleteKiralikArac(id: string) {
    try {
        await assertKiralikManageAccess();
        const aracScopeFilter = await getModelFilter("arac");
        const kiralikArac = await prisma.arac.findFirst({
            where: {
                AND: [
                    { id, deletedAt: null, disFirma: { is: { tur: "KIRALIK" } } },
                    aracScopeFilter as Prisma.AracWhereInput,
                ],
            },
            select: { id: true },
        });
        if (!kiralikArac) {
            return { success: false, error: "Kiralık araç kaydı bulunamadı." };
        }

        const result = await deleteArac(id);
        if (result.success) {
            revalidateKiralikPaths();
        }
        return result;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Kiralık araç silinemedi." };
    }
}

export async function createKiralikPersonel(input: KiralikPersonelInput) {
    try {
        await assertKiralikManageAccess();

        const [sirket, disFirma] = await Promise.all([
            ensureAccessibleSirket(input.sirketId),
            ensureKiralikDisFirma(input.disFirmaId),
        ]);

        const result = await createPersonel({
            ad: input.ad,
            soyad: input.soyad,
            telefon: input.telefon || "",
            rol: "PERSONEL" as Rol,
            sirketId: sirket.id,
            disFirmaId: disFirma.id,
            calistigiKurum: sirket.ad,
            tcNo: "",
        });
        if (result.success) {
            revalidateKiralikPaths();
        }
        return result;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Kiralık personel eklenemedi." };
    }
}

export async function updateKiralikPersonel(id: string, input: KiralikPersonelInput) {
    try {
        await assertKiralikManageAccess();

        const [sirket, disFirma] = await Promise.all([
            ensureAccessibleSirket(input.sirketId),
            ensureKiralikDisFirma(input.disFirmaId),
        ]);

        const result = await updatePersonel(id, {
            ad: input.ad,
            soyad: input.soyad,
            telefon: input.telefon || "",
            rol: "PERSONEL" as Rol,
            sirketId: sirket.id,
            disFirmaId: disFirma.id,
            calistigiKurum: sirket.ad,
            tcNo: "",
        });
        if (result.success) {
            revalidateKiralikPaths();
        }
        return result;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Kiralık personel güncellenemedi." };
    }
}

export async function deleteKiralikPersonel(id: string) {
    try {
        await assertKiralikManageAccess();
        const personelScope = await getModelFilter("personel");
        const personel = await prisma.kullanici.findFirst({
            where: {
                AND: [
                    { id, deletedAt: null, disFirma: { is: { tur: "KIRALIK" } } },
                    personelScope as Prisma.KullaniciWhereInput,
                ],
            },
            select: { id: true },
        });

        if (!personel) {
            return { success: false, error: "Kiralık personel kaydı bulunamadı." };
        }

        const result = await deletePersonel(id);
        if (result.success) {
            revalidateKiralikPaths();
        }
        return result;
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Kiralık personel silinemedi." };
    }
}
