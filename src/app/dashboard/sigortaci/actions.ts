"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { assertAuthenticatedUser, getScopedAracOrThrow } from "@/lib/action-scope";
import { resolveVehicleUsageCompanyId } from "@/lib/vehicle-usage-company";
import { ensureSigortaTeklifTable, type SigortaTeklifDurum, type SigortaTeklifTur } from "@/lib/sigorta-teklif-schema-compat";
import { ensureSigortaAcenteColumns, getExistingSigortaColumns, isSigortaOptionalFieldCompatibilityError } from "@/lib/sigorta-schema-compat";

const PATH = "/dashboard/sigortaci";
const KASKO_PATH = "/dashboard/kasko";
const TRAFIK_PATH = "/dashboard/trafik-sigortasi";
const EVRAK_PATH = "/dashboard/stok-takibi";
const ARACLAR_PATH = "/dashboard/araclar";

type TeklifInput = {
    aracId: string;
    tur: SigortaTeklifTur;
    acente?: string;
    sigortaSirketi?: string;
    policeNo?: string;
    baslangicTarihi: string;
    bitisTarihi: string;
    teklifTutar: number;
    notlar?: string;
};

type TeklifDbRow = {
    id: string;
    aracId: string;
    tur: SigortaTeklifTur;
    acente: string | null;
    sigortaSirketi: string | null;
    policeNo: string | null;
    baslangicTarihi: Date;
    bitisTarihi: Date;
    teklifTutar: number;
    durum: SigortaTeklifDurum;
    olusturulanKayitId: string | null;
    olusturulanKayitTur: string | null;
};

function cleanText(value: unknown) {
    const text = String(value || "").trim();
    return text || null;
}

function parseDateOrThrow(value: string, fieldLabel: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`${fieldLabel} geçersiz.`);
    }
    return date;
}

function revalidateSigortaciRelatedPaths(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(KASKO_PATH);
    revalidatePath(TRAFIK_PATH);
    revalidatePath(EVRAK_PATH);
    revalidatePath(ARACLAR_PATH);
    if (aracId) {
        revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    }
}

async function getTeklifByIdOrThrow(id: string) {
    await ensureSigortaTeklifTable();
    const rows = await prisma.$queryRaw<
        Array<{
            id: string;
            aracId: string;
            tur: string;
            acente: string | null;
            sigortaSirketi: string | null;
            policeNo: string | null;
            baslangicTarihi: Date;
            bitisTarihi: Date;
            teklifTutar: number;
            durum: string;
            olusturulanKayitId: string | null;
            olusturulanKayitTur: string | null;
        }>
    >`
        SELECT
            "id",
            "aracId",
            "tur",
            "acente",
            "sigortaSirketi",
            "policeNo",
            "baslangicTarihi",
            "bitisTarihi",
            "teklifTutar",
            "durum",
            "olusturulanKayitId",
            "olusturulanKayitTur"
        FROM "SigortaTeklif"
        WHERE "id" = ${id}
        LIMIT 1
    `;

    const rawRow = rows[0];
    const tur = rawRow?.tur === "TRAFIK" ? "TRAFIK" : rawRow?.tur === "KASKO" ? "KASKO" : null;
    const durum =
        rawRow?.durum === "ONAYLANDI" || rawRow?.durum === "REDDEDILDI" || rawRow?.durum === "BEKLIYOR" ? rawRow.durum : null;
    const row = rawRow && tur && durum
        ? ({
              ...rawRow,
              tur,
              durum,
          } as TeklifDbRow)
        : null;
    if (!row) {
        throw new Error("Teklif kaydı bulunamadı.");
    }
    return row;
}

async function createPolicyFromApprovedTeklif(teklif: TeklifDbRow) {
    const arac = await getScopedAracOrThrow(teklif.aracId, { id: true });
    const usageSirketId = await resolveVehicleUsageCompanyId({ aracId: arac.id });
    const prismaModel = teklif.tur === "KASKO" ? "kasko" : "trafikSigortasi";
    const tableName = teklif.tur === "KASKO" ? "Kasko" : "TrafikSigortasi";

    const runCreate = async (columns: Set<string>) => {
        const createData: any = {
            aracId: arac.id,
            sirket: cleanText(teklif.sigortaSirketi),
            policeNo: cleanText(teklif.policeNo),
            baslangicTarihi: new Date(teklif.baslangicTarihi),
            bitisTarihi: new Date(teklif.bitisTarihi),
            tutar: Number(teklif.teklifTutar) > 0 ? Number(teklif.teklifTutar) : null,
            aktifMi: true,
        };
        if (columns.has("sirketId")) createData.sirketId = usageSirketId || null;
        if (columns.has("acente")) createData.acente = cleanText(teklif.acente);

        return prisma.$transaction(async (tx) => {
            await (tx as any)[prismaModel].updateMany({
                where: { aracId: arac.id, aktifMi: true },
                data: { aktifMi: false },
            });
            const created = await (tx as any)[prismaModel].create({
                data: createData,
                select: { id: true },
            });
            return String(created.id);
        });
    };

    const columns = await getExistingSigortaColumns(tableName);
    try {
        return await runCreate(columns);
    } catch (dbError) {
        if (!isSigortaOptionalFieldCompatibilityError(dbError)) throw dbError;
        await ensureSigortaAcenteColumns();
        const retryColumns = await getExistingSigortaColumns(tableName);
        try {
            return await runCreate(retryColumns);
        } catch (retryError) {
            if (!isSigortaOptionalFieldCompatibilityError(retryError)) throw retryError;
            const safestColumns = new Set<string>();
            return await runCreate(safestColumns);
        }
    }
}

function resolveLinkedPolicyModel(teklif: TeklifDbRow) {
    const linkedType =
        teklif.olusturulanKayitTur === "KASKO" || teklif.olusturulanKayitTur === "TRAFIK"
            ? (teklif.olusturulanKayitTur as SigortaTeklifTur)
            : teklif.tur;
    return linkedType === "KASKO" ? "kasko" : "trafikSigortasi";
}

async function setLinkedPolicyActiveState(teklif: TeklifDbRow, aktifMi: boolean) {
    if (!teklif.olusturulanKayitId) return;
    const prismaModel = resolveLinkedPolicyModel(teklif);

    await prisma.$transaction(async (tx) => {
        if (aktifMi) {
            await (tx as any)[prismaModel].updateMany({
                where: {
                    aracId: teklif.aracId,
                    aktifMi: true,
                    NOT: { id: teklif.olusturulanKayitId },
                },
                data: { aktifMi: false },
            });
        }

        await (tx as any)[prismaModel].updateMany({
            where: {
                id: teklif.olusturulanKayitId,
                aracId: teklif.aracId,
            },
            data: { aktifMi },
        });
    });
}

export async function createSigortaTeklif(data: TeklifInput) {
    try {
        const actor = await assertAuthenticatedUser();
        await ensureSigortaTeklifTable();

        if (!data?.aracId) {
            throw new Error("Araç seçimi zorunlu.");
        }
        if (data.tur !== "KASKO" && data.tur !== "TRAFIK") {
            throw new Error("Geçersiz teklif türü.");
        }

        const teklifTutar = Number(data.teklifTutar);
        if (!Number.isFinite(teklifTutar) || teklifTutar <= 0) {
            throw new Error("Teklif tutarı 0'dan büyük olmalı.");
        }

        const baslangicTarihi = parseDateOrThrow(data.baslangicTarihi, "Başlangıç tarihi");
        const bitisTarihi = parseDateOrThrow(data.bitisTarihi, "Bitiş tarihi");
        if (bitisTarihi <= baslangicTarihi) {
            throw new Error("Bitiş tarihi başlangıç tarihinden sonra olmalı.");
        }

        const arac = await getScopedAracOrThrow(data.aracId, { id: true });
        const usageSirketId = await resolveVehicleUsageCompanyId({ aracId: arac.id });

        await prisma.$executeRaw`
            INSERT INTO "SigortaTeklif"
                ("id", "aracId", "tur", "acente", "sigortaSirketi", "policeNo", "baslangicTarihi", "bitisTarihi", "teklifTutar", "durum", "notlar", "sirketId", "createdBy", "createdAt", "updatedAt")
            VALUES
                (
                    ${randomUUID()},
                    ${arac.id},
                    ${data.tur},
                    ${cleanText(data.acente)},
                    ${cleanText(data.sigortaSirketi)},
                    ${cleanText(data.policeNo)},
                    ${baslangicTarihi},
                    ${bitisTarihi},
                    ${teklifTutar},
                    ${"BEKLIYOR"},
                    ${cleanText(data.notlar)},
                    ${usageSirketId || null},
                    ${String((actor as any)?.id || "") || null},
                    NOW(),
                    NOW()
                )
        `;

        revalidateSigortaciRelatedPaths(arac.id);
        return { success: true };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: (error as { message?: string } | null)?.message || "Teklif oluşturulamadı.",
        };
    }
}

export async function updateSigortaTeklifDurum(id: string, durum: SigortaTeklifDurum) {
    try {
        await assertAuthenticatedUser();
        await ensureSigortaTeklifTable();
        if (!id?.trim()) {
            throw new Error("Teklif kaydı seçilmedi.");
        }
        if (!["BEKLIYOR", "ONAYLANDI", "REDDEDILDI"].includes(durum)) {
            throw new Error("Geçersiz teklif durumu.");
        }

        const teklif = await getTeklifByIdOrThrow(id);
        await getScopedAracOrThrow(teklif.aracId, { id: true });

        if (durum === "ONAYLANDI") {
            if (!teklif.olusturulanKayitId) {
                const olusturulanKayitId = await createPolicyFromApprovedTeklif(teklif);
                await prisma.$executeRaw`
                    UPDATE "SigortaTeklif"
                    SET "durum" = ${durum},
                        "olusturulanKayitId" = ${olusturulanKayitId},
                        "olusturulanKayitTur" = ${teklif.tur},
                        "olusturulmaTarihi" = COALESCE("olusturulmaTarihi", NOW()),
                        "updatedAt" = NOW()
                    WHERE "id" = ${id}
                `;
            } else {
                await setLinkedPolicyActiveState(teklif, true);
                await prisma.$executeRaw`
                    UPDATE "SigortaTeklif"
                    SET "durum" = ${durum},
                        "updatedAt" = NOW()
                    WHERE "id" = ${id}
                `;
            }
        } else {
            await setLinkedPolicyActiveState(teklif, false);
            await prisma.$executeRaw`
                UPDATE "SigortaTeklif"
                SET "durum" = ${durum},
                    "updatedAt" = NOW()
                WHERE "id" = ${id}
            `;
        }

        revalidateSigortaciRelatedPaths(teklif.aracId);
        return { success: true };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: (error as { message?: string } | null)?.message || "Teklif durumu güncellenemedi.",
        };
    }
}

export async function deleteSigortaTeklif(id: string) {
    try {
        await assertAuthenticatedUser();
        if (!id?.trim()) {
            throw new Error("Teklif kaydı seçilmedi.");
        }

        const teklif = await getTeklifByIdOrThrow(id);
        await getScopedAracOrThrow(teklif.aracId, { id: true });

        await prisma.$executeRaw`
            DELETE FROM "SigortaTeklif"
            WHERE "id" = ${id}
        `;

        revalidateSigortaciRelatedPaths(teklif.aracId);
        return { success: true };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            error: (error as { message?: string } | null)?.message || "Teklif silinemedi.",
        };
    }
}
