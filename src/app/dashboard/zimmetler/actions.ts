"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedKullaniciOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";
import { syncAracDurumu } from "@/lib/arac-durum";

const PATH = '/dashboard/zimmetler';
const ARACLAR_PATH = '/dashboard/araclar';
const PERSONEL_PATH = '/dashboard/personel';

function revalidateZimmetPages(aracId?: string, kullaniciId?: string) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    revalidatePath(PERSONEL_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    if (kullaniciId) revalidatePath(`${PERSONEL_PATH}/${kullaniciId}`);
}

export async function createZimmet(data: {
    aracId: string;
    kullaniciId: string;
    baslangic: string;
    baslangicKm: number;
    notlar?: string;
}) {
    try {
        await assertAuthenticatedUser();
        const aracId = data.aracId || null;
        const kullaniciId = data.kullaniciId || null;

        if (!aracId) throw new Error("Araç ID zorunludur.");
        const arac = await getScopedAracOrThrow(aracId, {
            id: true,
            sirketId: true,
        });
        if (!kullaniciId) throw new Error("Personel ID zorunludur.");
        const kullanici = await getScopedKullaniciOrThrow(kullaniciId, { id: true, sirketId: true, calistigiKurum: true });
        const baslangicDate = new Date(data.baslangic);
        if (Number.isNaN(baslangicDate.getTime())) {
            throw new Error("Gecersiz teslim tarihi.");
        }
        const baslangicKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: data.baslangicKm,
            fieldLabel: "Zimmet Teslim KM",
            enforceMaxKnownKm: false,
        });

        const [aktifPersonelZimmeti, aktifAracZimmeti] = await Promise.all([
            prisma.kullaniciZimmet.findFirst({
                where: { kullaniciId: kullanici.id, bitis: null },
                select: { id: true, aracId: true },
            }),
            prisma.kullaniciZimmet.findFirst({
                where: { aracId: arac.id, bitis: null },
                select: { id: true, kullaniciId: true },
            }),
        ]);

        if (aktifPersonelZimmeti && aktifPersonelZimmeti.aracId !== arac.id) {
            throw new Error("Personele zimmetli araç mevcut.");
        }
        if (aktifAracZimmeti && aktifAracZimmeti.kullaniciId !== kullanici.id) {
            throw new Error("Araç için aktif zimmet mevcut.");
        }
        if (
            aktifPersonelZimmeti &&
            aktifAracZimmeti &&
            aktifPersonelZimmeti.aracId === arac.id &&
            aktifAracZimmeti.kullaniciId === kullanici.id
        ) {
            throw new Error("Bu araç zaten seçili personele aktif zimmetli.");
        }

        await prisma.$transaction(async (tx) => {
            await tx.arac.update({
                where: { id: arac.id },
                data: {
                    kullaniciId: kullanici.id,
                },
            });

            await tx.kullaniciZimmet.create({
                data: {
                    aracId: arac.id,
                    kullaniciId: kullanici.id,
                    baslangic: baslangicDate,
                    baslangicKm: Number(baslangicKm),
                    notlar: data.notlar || null,
                },
            });
        });

        await syncAracGuncelKm(arac.id);
        await syncAracDurumu(arac.id);

        revalidateZimmetPages(arac.id, kullanici.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Zimmet kaydı oluşturulamadı.";
        return { success: false, error: message };
    }
}

export async function deleteZimmet(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "kullaniciZimmet",
            filterModel: "kullaniciZimmet",
            id,
            select: { aracId: true },
            errorMessage: "Zimmet kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.kullaniciZimmet.delete({ where: { id } });
        if ((kayit as { aracId?: string } | null)?.aracId) {
            await syncAracDurumu((kayit as { aracId: string }).aracId);
        }
        revalidateZimmetPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Zimmet kaydı silinemedi." };
    }
}

export async function updateZimmet(id: string, data: {
    baslangic: string;
    bitis?: string | null;
    baslangicKm: number;
    bitisKm?: number | null;
    notlar?: string | null;
}) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "kullaniciZimmet",
            filterModel: "kullaniciZimmet",
            id,
            select: { aracId: true, kullaniciId: true, baslangicKm: true, bitisKm: true, bitis: true },
            errorMessage: "Zimmet kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = await getScopedAracOrThrow(kayit.aracId, {
            id: true,
        });

        const baslangic = new Date(data.baslangic);
        const bitisInput = data.bitis ? new Date(data.bitis) : null;
        if (Number.isNaN(baslangic.getTime())) {
            throw new Error("Gecersiz baslangic tarihi");
        }
        if (bitisInput && Number.isNaN(bitisInput.getTime())) {
            throw new Error("Gecersiz bitis tarihi");
        }

        const baslangicKm = Number(data.baslangicKm);
        const bitisKm = data.bitisKm !== null && data.bitisKm !== undefined ? Number(data.bitisKm) : null;
        if (Number.isNaN(baslangicKm)) {
            throw new Error("Gecersiz baslangic KM");
        }
        if (bitisKm !== null && Number.isNaN(bitisKm)) {
            throw new Error("Gecersiz bitis KM");
        }
        const normalizedBaslangicKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: baslangicKm,
            fieldLabel: "Zimmet Teslim KM",
            currentRecord: { aracId: kayit.aracId, km: kayit.baslangicKm },
            enforceMaxKnownKm: false,
        });
        const normalizedBitisKm =
            bitisKm !== null
                ? await assertKmWriteConsistency({
                    aracId: arac.id,
                    km: bitisKm,
                    fieldLabel: "Zimmet Iade KM",
                    currentRecord: { aracId: kayit.aracId, km: kayit.bitisKm },
                    enforceMaxKnownKm: false,
                })
                : null;
        if (normalizedBitisKm !== null && normalizedBaslangicKm !== null && normalizedBitisKm < normalizedBaslangicKm) {
            throw new Error("Iade KM, teslim KM'den kucuk olamaz.");
        }

        let bitis = bitisInput;
        if (!bitis && normalizedBitisKm !== null && !kayit.bitis) {
            bitis = new Date();
        }
        if (!bitis && kayit.bitis) {
            bitis = kayit.bitis;
        }
        if (bitis && bitis < baslangic) {
            throw new Error("Bitiş tarihi başlangıç tarihinden önce olamaz.");
        }

        const sonlandiriliyor = !kayit.bitis && !!bitis;
        if (sonlandiriliyor && normalizedBitisKm === null) {
            throw new Error("Zimmet sonlandırılırken iade KM zorunludur.");
        }

        await prisma.$transaction(async (tx) => {
            await tx.kullaniciZimmet.update({
                where: { id },
                data: {
                    baslangic,
                    bitis,
                    baslangicKm: Number(normalizedBaslangicKm),
                    bitisKm: normalizedBitisKm,
                    notlar: data.notlar || null,
                }
            });

            if (sonlandiriliyor) {
                await tx.arac.updateMany({
                    where: {
                        id: arac.id,
                        kullaniciId: kayit.kullaniciId,
                    },
                    data: { kullaniciId: null },
                });
            }
        });

        await syncAracGuncelKm(arac.id);
        await syncAracDurumu(arac.id);

        revalidateZimmetPages(arac.id, kayit.kullaniciId);
        return { success: true };
    } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Zimmet kaydı güncellenemedi.";
        return { success: false, error: message };
    }
}

export async function finalizeZimmet(
    id: string,
    data: {
        bitis: string;
        bitisKm: number;
        notlar?: string | null;
    }
) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "kullaniciZimmet",
            filterModel: "kullaniciZimmet",
            id,
            select: {
                id: true,
                aracId: true,
                kullaniciId: true,
                baslangic: true,
                baslangicKm: true,
                bitis: true,
                bitisKm: true,
                notlar: true,
            },
            errorMessage: "Zimmet kaydi bulunamadi veya yetkiniz yok.",
        });
        if (kayit.bitis) {
            return { success: false, error: "Bu zimmet kaydı zaten sonlandırılmış." };
        }

        const arac = await getScopedAracOrThrow(kayit.aracId, { id: true });
        const bitis = new Date(data.bitis);
        if (Number.isNaN(bitis.getTime())) {
            return { success: false, error: "Gecersiz iade tarihi." };
        }
        const normalizedBitisKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: data.bitisKm,
            fieldLabel: "Zimmet Iade KM",
            currentRecord: { aracId: kayit.aracId, km: kayit.bitisKm },
            enforceMaxKnownKm: false,
        });
        if (normalizedBitisKm === null || Number.isNaN(Number(normalizedBitisKm))) {
            return { success: false, error: "Gecersiz iade KM." };
        }
        if (normalizedBitisKm < Number(kayit.baslangicKm || 0)) {
            return { success: false, error: "Iade KM, teslim KM'den kucuk olamaz." };
        }
        if (bitis < new Date(kayit.baslangic)) {
            return { success: false, error: "Iade tarihi, teslim tarihinden once olamaz." };
        }

        const nextNotlar = data.notlar?.trim() || kayit.notlar || null;

        await prisma.$transaction(async (tx) => {
            await tx.kullaniciZimmet.update({
                where: { id: kayit.id },
                data: {
                    bitis,
                    bitisKm: Number(normalizedBitisKm),
                    notlar: nextNotlar,
                },
            });

            await tx.arac.updateMany({
                where: {
                    id: kayit.aracId,
                    kullaniciId: kayit.kullaniciId,
                },
                data: {
                    kullaniciId: null,
                },
            });
        });

        await syncAracGuncelKm(kayit.aracId);
        await syncAracDurumu(kayit.aracId);

        revalidateZimmetPages(kayit.aracId, kayit.kullaniciId);
        return { success: true };
    } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Zimmet sonlandırılamadı.";
        return { success: false, error: message };
    }
}
