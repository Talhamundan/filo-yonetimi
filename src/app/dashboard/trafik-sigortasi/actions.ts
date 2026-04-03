"use server";

import prisma from "../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAuthenticatedUser, getScopedAracOrThrow, getScopedRecordOrThrow } from "@/lib/action-scope";
import { ensureSigortaAcenteColumns, getExistingSigortaColumns, isSigortaOptionalFieldCompatibilityError } from "@/lib/sigorta-schema-compat";
import { resolveVehicleUsageCompanyId } from "@/lib/vehicle-usage-company";

const PATH = '/dashboard/trafik-sigortasi';
const EVRAK_PATH = "/dashboard/evrak-takip";
const ARACLAR_PATH = "/dashboard/araclar";

function revalidateSigortaRelatedPaths(aracId?: string) {
    revalidatePath(PATH);
    revalidatePath(EVRAK_PATH);
    revalidatePath(ARACLAR_PATH);
    if (aracId) {
        revalidatePath(`${ARACLAR_PATH}/${aracId}`);
    }
}

export async function createSigorta(data: {
    aracId: string;
    sirket?: string;
    acente?: string;
    policeNo?: string;
    baslangicTarihi: string;
    bitisTarihi: string;
    tutar?: number;
    aktifMi?: boolean;
}) {
    try {
        await assertAuthenticatedUser();
        const arac = await getScopedAracOrThrow(data.aracId, {
            id: true,
            sirketId: true,
        });
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id,
            fallbackSirketId: arac.sirketId,
        });
        const runCreate = async (columns: Set<string>) => {
            const createData: any = {
                aracId: arac.id,
                sirket: data.sirket || null,
                policeNo: data.policeNo || null,
                baslangicTarihi: new Date(data.baslangicTarihi),
                bitisTarihi: new Date(data.bitisTarihi),
                tutar: data.tutar !== undefined ? Number(data.tutar) : null,
                aktifMi: data.aktifMi ?? true,
            };
            if (columns.has("sirketId")) createData.sirketId = usageSirketId || null;
            if (columns.has("acente")) createData.acente = data.acente || null;

            const operations: any[] = [];
            if (createData.aktifMi) {
                operations.push(
                    prisma.trafikSigortasi.updateMany({
                        where: {
                            aracId: arac.id,
                            aktifMi: true,
                        },
                        data: { aktifMi: false },
                    })
                );
            }
            operations.push(prisma.trafikSigortasi.create({ data: createData, select: { id: true } }));
            await prisma.$transaction(operations);
        };

        const columns = await getExistingSigortaColumns("TrafikSigortasi");
        try {
            await runCreate(columns);
        } catch (dbError) {
            if (!isSigortaOptionalFieldCompatibilityError(dbError)) throw dbError;
            await ensureSigortaAcenteColumns();
            const retryColumns = await getExistingSigortaColumns("TrafikSigortasi");
            try {
                await runCreate(retryColumns);
            } catch (retryError) {
                if (!isSigortaOptionalFieldCompatibilityError(retryError)) throw retryError;
                const safestColumns = new Set<string>();
                await runCreate(safestColumns);
            }
        }

        revalidateSigortaRelatedPaths(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        const detail = (e as { message?: string } | null)?.message;
        return { success: false, error: detail ? `Trafik sigortası kaydı oluşturulamadı: ${detail}` : "Trafik sigortası kaydı oluşturulamadı." };
    }
}

export async function renewSigorta(id: string, data: {
    sirket?: string;
    acente?: string;
    policeNo?: string;
    yenilemeTarihi: string;
    bitisTarihi?: string;
    tutar?: number;
}) {
    try {
        await assertAuthenticatedUser();
        const runRenew = async (columns: Set<string>) => {
            const selectShape: any = {
                id: true,
                aracId: true,
                sirket: true,
                policeNo: true,
            };
            if (columns.has("sirketId")) selectShape.sirketId = true;
            if (columns.has("acente")) selectShape.acente = true;

            const mevcutKayit = await getScopedRecordOrThrow({
                prismaModel: "trafikSigortasi",
                filterModel: "trafikSigortasi",
                id,
                select: selectShape,
                errorMessage: "Sigorta kaydi bulunamadi veya yetkiniz yok.",
            });

            const arac = await getScopedAracOrThrow(mevcutKayit.aracId, {
                id: true,
                sirketId: true,
            });
            const usageSirketId = await resolveVehicleUsageCompanyId({
                aracId: arac.id,
                fallbackSirketId: arac.sirketId || (mevcutKayit as any).sirketId || null,
            });

            const yenilemeTarihi = new Date(data.yenilemeTarihi);
            const bitisTarihi = data.bitisTarihi
                ? new Date(data.bitisTarihi)
                : new Date(new Date(data.yenilemeTarihi).setFullYear(new Date(data.yenilemeTarihi).getFullYear() + 1));

            const createData: any = {
                aracId: mevcutKayit.aracId,
                sirket: data.sirket || mevcutKayit.sirket || null,
                policeNo: data.policeNo || mevcutKayit.policeNo || null,
                baslangicTarihi: yenilemeTarihi,
                bitisTarihi,
                tutar: data.tutar !== undefined ? Number(data.tutar) : null,
                aktifMi: true,
            };
            if (columns.has("sirketId")) createData.sirketId = usageSirketId || (mevcutKayit as any).sirketId || null;
            if (columns.has("acente")) createData.acente = data.acente || (mevcutKayit as any).acente || null;

            await prisma.$transaction([
                prisma.trafikSigortasi.updateMany({
                    where: {
                        aracId: mevcutKayit.aracId,
                        aktifMi: true,
                    },
                    data: { aktifMi: false },
                }),
                prisma.trafikSigortasi.create({ data: createData, select: { id: true } }),
            ]);

            return mevcutKayit.aracId as string;
        };

        const columns = await getExistingSigortaColumns("TrafikSigortasi");
        let renewedAracId: string | undefined;
        try {
            renewedAracId = await runRenew(columns);
        } catch (dbError) {
            if (!isSigortaOptionalFieldCompatibilityError(dbError)) throw dbError;
            await ensureSigortaAcenteColumns();
            const retryColumns = await getExistingSigortaColumns("TrafikSigortasi");
            try {
                renewedAracId = await runRenew(retryColumns);
            } catch (retryError) {
                if (!isSigortaOptionalFieldCompatibilityError(retryError)) throw retryError;
                const safestColumns = new Set<string>();
                renewedAracId = await runRenew(safestColumns);
            }
        }

        revalidateSigortaRelatedPaths(renewedAracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        const detail = (e as { message?: string } | null)?.message;
        return { success: false, error: detail ? `Trafik sigortasi yenileme islemi tamamlanamadi: ${detail}` : "Trafik sigortasi yenileme islemi tamamlanamadi." };
    }
}

export async function updateSigorta(id: string, data: any) {
    try {
        await assertAuthenticatedUser();
        const columns = await getExistingSigortaColumns("TrafikSigortasi");
        const selectShape: any = { aracId: true };
        if (columns.has("sirketId")) selectShape.sirketId = true;
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "trafikSigortasi",
            filterModel: "trafikSigortasi",
            id,
            select: selectShape,
            errorMessage: "Sigorta kaydi bulunamadi veya yetkiniz yok.",
        });
        const arac = data.aracId
            ? await getScopedAracOrThrow(data.aracId, { id: true, sirketId: true })
            : await getScopedAracOrThrow(mevcutKayit.aracId, { id: true, sirketId: true });
        const usageSirketId = await resolveVehicleUsageCompanyId({
            aracId: arac.id,
            fallbackSirketId: arac.sirketId || (mevcutKayit as any).sirketId || null,
        });

        const updateData: any = {
            aracId: arac.id,
            sirket: data.sirket ?? undefined,
            policeNo: data.policeNo ?? undefined,
            baslangicTarihi: data.baslangicTarihi ? new Date(data.baslangicTarihi) : undefined,
            bitisTarihi: data.bitisTarihi ? new Date(data.bitisTarihi) : undefined,
            tutar: data.tutar !== undefined ? Number(data.tutar) : undefined,
            aktifMi: typeof data.aktifMi === "boolean" ? data.aktifMi : undefined,
        };
        if (columns.has("sirketId")) updateData.sirketId = usageSirketId || (mevcutKayit as any).sirketId || null;
        if (columns.has("acente")) updateData.acente = data.acente ?? undefined;

        try {
            await prisma.trafikSigortasi.update({
                where: { id },
                data: updateData,
                select: { id: true },
            });
        } catch (dbError) {
            if (!isSigortaOptionalFieldCompatibilityError(dbError)) throw dbError;
            await ensureSigortaAcenteColumns();
            const retryColumns = await getExistingSigortaColumns("TrafikSigortasi");
            const retryData: any = { ...updateData };
            if (!retryColumns.has("sirketId")) delete retryData.sirketId;
            if (!retryColumns.has("acente")) delete retryData.acente;
            try {
                await prisma.trafikSigortasi.update({
                    where: { id },
                    data: retryData,
                    select: { id: true },
                });
            } catch (retryError) {
                if (!isSigortaOptionalFieldCompatibilityError(retryError)) throw retryError;
                const safeData: any = { ...retryData };
                delete safeData.sirketId;
                delete safeData.acente;
                await prisma.trafikSigortasi.update({
                    where: { id },
                    data: safeData,
                    select: { id: true },
                });
            }
        }
        if (data.aktifMi === true) {
            await prisma.trafikSigortasi.updateMany({
                where: {
                    aracId: arac.id,
                    aktifMi: true,
                    NOT: { id },
                },
                data: { aktifMi: false },
            });
        }

        revalidateSigortaRelatedPaths(arac.id);
        return { success: true };
    } catch (e) {
        console.error(e);
        const detail = (e as { message?: string } | null)?.message;
        return { success: false, error: detail ? `Trafik sigortası kaydı güncellenemedi: ${detail}` : "Trafik sigortası kaydı güncellenemedi." };
    }
}

export async function deleteSigorta(id: string) {
    try {
        await assertAuthenticatedUser();
        const mevcutKayit = await getScopedRecordOrThrow({
            prismaModel: "trafikSigortasi",
            filterModel: "trafikSigortasi",
            id,
            select: { aracId: true },
            errorMessage: "Sigorta kaydi bulunamadi veya yetkiniz yok.",
        });

        await prisma.trafikSigortasi.delete({ where: { id } });
        revalidateSigortaRelatedPaths((mevcutKayit as { aracId?: string } | null)?.aracId);
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Trafik sigortası kaydı silinemedi." };
    }
}
