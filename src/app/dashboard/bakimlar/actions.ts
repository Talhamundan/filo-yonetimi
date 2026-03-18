"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { assertKmWriteConsistency, syncAracGuncelKm } from "@/lib/km-consistency";

const PATH = "/dashboard/bakimlar";
const ARACLAR_PATH = "/dashboard/araclar";

function revalidateBakimPages(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(ARACLAR_PATH);
    if (aracId) revalidatePath(`${ARACLAR_PATH}/${aracId}`);
}

type ServisKategoriInput = "PERIYODIK_BAKIM" | "ARIZA";
type LegacyBakimTuruInput = "PERIYODIK" | "ARIZA" | "KAPORTA";

function resolveServisKategori(kategori?: ServisKategoriInput, tur?: LegacyBakimTuruInput): ServisKategoriInput {
    if (kategori === "ARIZA") return "ARIZA";
    if (tur === "ARIZA") return "ARIZA";
    return "PERIYODIK_BAKIM";
}

function resolveLegacyBakimTuru(kategori: ServisKategoriInput, tur?: LegacyBakimTuruInput): LegacyBakimTuruInput {
    if (tur) return tur;
    return kategori === "ARIZA" ? "ARIZA" : "PERIYODIK";
}

export async function addBakim(data: {
    aracId: string;
    bakimTarihi: Date;
    yapilanKm: number;
    kategori?: ServisKategoriInput;
    tur?: LegacyBakimTuruInput;
    servisAdi?: string;
    yapilanIslemler?: string;
    tutar: number;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
        });
        const yapilanKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: data.yapilanKm,
            fieldLabel: "Bakim KM",
            enforceMaxKnownKm: false,
        });
        const kategori = resolveServisKategori(data.kategori, data.tur);
        const tur = resolveLegacyBakimTuru(kategori, data.tur);

        await prisma.bakim.create({
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId,
                bakimTarihi: data.bakimTarihi,
                yapilanKm: Number(yapilanKm),
                kategori,
                tur,
                servisAdi: data.servisAdi,
                yapilanIslemler: data.yapilanIslemler,
                tutar: data.tutar,
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateBakimPages(arac.id);
        return { success: true };
    } catch (error) {
        console.error("Bakım eklenirken hata:", error);
        return { success: false, error: "Servis bilgisi eklenirken bir hata oluştu." };
    }
}

export async function updateBakim(id: string, data: {
    aracId: string;
    bakimTarihi: Date;
    yapilanKm: number;
    kategori?: ServisKategoriInput;
    tur?: LegacyBakimTuruInput;
    servisAdi?: string;
    yapilanIslemler?: string;
    tutar: number;
}) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "bakim",
            filterModel: "bakim",
            id,
            select: { aracId: true, sirketId: true, yapilanKm: true },
            errorMessage: "Bakim kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true });
        const yapilanKm = await assertKmWriteConsistency({
            aracId: arac.id,
            km: data.yapilanKm,
            fieldLabel: "Bakim KM",
            currentRecord: { aracId: mevcutKayit.aracId, km: mevcutKayit.yapilanKm },
            enforceMaxKnownKm: false,
        });
        const kategori = resolveServisKategori(data.kategori, data.tur);
        const tur = resolveLegacyBakimTuru(kategori, data.tur);

        await prisma.bakim.update({
            where: { id },
            data: {
                aracId: arac.id,
                sirketId: arac.sirketId || mevcutKayit.sirketId,
                bakimTarihi: data.bakimTarihi,
                yapilanKm: Number(yapilanKm),
                kategori,
                tur,
                servisAdi: data.servisAdi,
                yapilanIslemler: data.yapilanIslemler,
                tutar: data.tutar,
            }
        });

        await syncAracGuncelKm(arac.id);

        revalidateBakimPages(arac.id);
        return { success: true };
    } catch (error) {
        console.error("Bakım güncellenirken hata:", error);
        return { success: false, error: "Servis bilgisi güncellenirken bir hata oluştu." };
    }
}

export async function deleteBakim(id: string) {
    try {
        await assertAuthenticatedUser();
        const kayit = await getScopedRecordOrThrow({
            prismaModel: "bakim",
            filterModel: "bakim",
            id,
            select: { aracId: true },
            errorMessage: "Bakim kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.bakim.delete({ where: { id } });
        revalidateBakimPages((kayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (error) {
        console.error("Bakım silinirken hata:", error);
        return { success: false, error: "Bakım silinirken bir hata oluştu." };
    }
}
