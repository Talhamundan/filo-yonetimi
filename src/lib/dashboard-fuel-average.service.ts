import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";
import { getVehicleUsageScopeWhere } from "@/lib/dashboard-helpers";
import type {
    DashboardDateContext,
    DashboardDriverFuelAverageItem,
    DashboardVehicleFuelAverageItem,
    GenericWhere,
} from "@/lib/dashboard-types";

type ZimmetRange = {
    kullaniciId: string;
    baslangic: number;
    bitis: number | null;
};

type FuelRow = {
    id: string;
    aracId: string;
    tarih: Date;
    km: number;
    litre: number;
    tutar: number;
    soforId: string | null;
    arac?: { kullaniciId: string | null } | null;
};

function roundTwo(value: number) {
    return Math.round(value * 100) / 100;
}

function getUsageScopedExpenseWhere(scope: GenericWhere): GenericWhere {
    const rawScope = (scope || {}) as Record<string, unknown>;
    const normalizedSirketId = typeof rawScope.sirketId === "string" ? rawScope.sirketId.trim() : "";
    if (!normalizedSirketId) {
        return scope;
    }

    const restScope = { ...rawScope };
    delete restScope.sirketId;

    const vehicleUsageWhere = getVehicleUsageScopeWhere({ sirketId: normalizedSirketId });
    const scopeParts: GenericWhere[] = [];
    if (Object.keys(restScope).length > 0) {
        scopeParts.push(restScope);
    }
    scopeParts.push({ arac: vehicleUsageWhere });

    return scopeParts.length === 1 ? scopeParts[0] : { AND: scopeParts };
}

function getExpenseScopedWhere(scope: GenericWhere, vehicleScope?: GenericWhere): GenericWhere {
    if (!vehicleScope || Object.keys((vehicleScope || {}) as Record<string, unknown>).length === 0) {
        return getUsageScopedExpenseWhere(scope);
    }

    const restScope = { ...((scope || {}) as Record<string, unknown>) };
    delete restScope.sirketId;

    const scopeParts: GenericWhere[] = [];
    if (Object.keys(restScope).length > 0) {
        scopeParts.push(restScope);
    }
    scopeParts.push({ arac: vehicleScope });

    return scopeParts.length === 1 ? scopeParts[0] : { AND: scopeParts };
}

function findDriverAtDate(
    zimmetByAracId: Record<string, ZimmetRange[]>,
    aracId: string,
    date: Date
) {
    const rows = zimmetByAracId[aracId];
    if (!rows?.length) return null;
    const target = date.getTime();

    for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (row.baslangic <= target && (row.bitis === null || row.bitis >= target)) {
            return row.kullaniciId;
        }
    }

    return null;
}

export async function getDashboardFuelAverageData(params: {
    scope: GenericWhere;
    dateContext: DashboardDateContext;
    vehicleScope?: GenericWhere;
}): Promise<{
    vehicleFuelAverageReport: DashboardVehicleFuelAverageItem[];
    driverFuelAverageReport: DashboardDriverFuelAverageItem[];
}> {
    const MACHINE_CATEGORY = "SANTIYE";
    const { scope, dateContext, vehicleScope } = params;
    const { seciliAyBasi, seciliAySonu } = dateContext;
    const usageScopedVehicleWhere = {
        ...((vehicleScope || getVehicleUsageScopeWhere(scope)) as Prisma.AracWhereInput),
        deletedAt: null,
    } as Prisma.AracWhereInput;
    const machineVehicleWhere = {
        AND: [usageScopedVehicleWhere, { kategori: MACHINE_CATEGORY }],
    } as Prisma.AracWhereInput;
    const expenseScope = getExpenseScopedWhere(scope, machineVehicleWhere);

    const [araclar, personeller, zimmetler, periodFuelRows] = await Promise.all([
        prisma.arac.findMany({
            where: machineVehicleWhere,
            select: { id: true, plaka: true, marka: true, model: true },
        }),
        prisma.kullanici.findMany({
            where: {
                AND: [scope as Prisma.KullaniciWhereInput, { deletedAt: null }],
            },
            select: { id: true, ad: true, soyad: true },
        }),
        prisma.kullaniciZimmet.findMany({
            where: { arac: machineVehicleWhere },
            select: { aracId: true, kullaniciId: true, baslangic: true, bitis: true },
        }),
        prisma.yakit.findMany({
            where: { ...(expenseScope as Prisma.YakitWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } },
            select: {
                id: true,
                aracId: true,
                tarih: true,
                km: true,
                litre: true,
                tutar: true,
                soforId: true,
                arac: { select: { kullaniciId: true } },
            },
            orderBy: [{ aracId: "asc" }, { tarih: "asc" }, { km: "asc" }],
        }),
    ]);

    if (periodFuelRows.length === 0) {
        return { vehicleFuelAverageReport: [], driverFuelAverageReport: [] };
    }

    const periodVehicleIds = Array.from(new Set(periodFuelRows.map((row) => row.aracId).filter(Boolean)));
    const boundaryRows = periodVehicleIds.length
        ? await prisma.yakit.findMany({
              where: {
                  ...(expenseScope as Prisma.YakitWhereInput),
                  aracId: { in: periodVehicleIds },
                  tarih: { lt: seciliAyBasi },
              },
              distinct: ["aracId"],
              orderBy: [{ aracId: "asc" }, { tarih: "desc" }, { id: "desc" }],
              select: {
                  id: true,
                  aracId: true,
                  tarih: true,
                  km: true,
                  litre: true,
                  tutar: true,
                  soforId: true,
                  arac: { select: { kullaniciId: true } },
              },
          })
        : [];

    const zimmetByAracId: Record<string, ZimmetRange[]> = {};
    for (const zimmet of zimmetler) {
        if (!zimmetByAracId[zimmet.aracId]) {
            zimmetByAracId[zimmet.aracId] = [];
        }
        zimmetByAracId[zimmet.aracId].push({
            kullaniciId: zimmet.kullaniciId,
            baslangic: zimmet.baslangic.getTime(),
            bitis: zimmet.bitis ? zimmet.bitis.getTime() : null,
        });
    }
    Object.values(zimmetByAracId).forEach((rows) => rows.sort((a, b) => a.baslangic - b.baslangic));

    const metrics = buildFuelIntervalMetrics(
        [...boundaryRows, ...periodFuelRows].map((row: FuelRow) => ({
            id: row.id,
            aracId: row.aracId,
            tarih: row.tarih,
            km: Number(row.km || 0),
            litre: Number(row.litre || 0),
            tutar: Number(row.tutar || 0),
            soforId:
                row.soforId ||
                findDriverAtDate(zimmetByAracId, row.aracId, row.tarih),
        }))
    );

    const aracMap = new Map<string, { plaka: string; markaModel: string }>();
    for (const arac of araclar) {
        aracMap.set(arac.id, {
            plaka: (arac.plaka || "-").trim(),
            markaModel: `${arac.marka || ""} ${arac.model || ""}`.trim(),
        });
    }

    const personelMap = new Map<string, string>();
    for (const personel of personeller) {
        personelMap.set(personel.id, `${personel.ad || ""} ${personel.soyad || ""}`.trim() || "Bilinmeyen Personel");
    }

    const vehicleFuelAverageReport: DashboardVehicleFuelAverageItem[] = [...metrics.byVehicleId.values()]
        .filter((metric) => metric.intervalCount > 0 && metric.averageLitresPer100Km > 0)
        .map((metric) => {
            const arac = aracMap.get(metric.vehicleId);
            return {
                aracId: metric.vehicleId,
                plaka: arac?.plaka || "-",
                markaModel: arac?.markaModel || "",
                averageLitresPer100Km: roundTwo(metric.averageLitresPer100Km),
                intervalCount: metric.intervalCount,
            };
        })
        .sort(
            (a, b) =>
                b.averageLitresPer100Km - a.averageLitresPer100Km ||
                b.intervalCount - a.intervalCount ||
                a.plaka.localeCompare(b.plaka, "tr")
        );

    const driverFuelAverageReport: DashboardDriverFuelAverageItem[] = [...metrics.byDriverId.values()]
        .filter((metric) => metric.intervalCount > 0 && metric.averageLitresPer100Km > 0)
        .map((metric) => ({
            soforId: metric.driverId,
            adSoyad: personelMap.get(metric.driverId) || "Bilinmeyen Personel",
            averageLitresPer100Km: roundTwo(metric.averageLitresPer100Km),
            intervalCount: metric.intervalCount,
        }))
        .sort(
            (a, b) =>
                b.averageLitresPer100Km - a.averageLitresPer100Km ||
                b.intervalCount - a.intervalCount ||
                a.adSoyad.localeCompare(b.adSoyad, "tr")
        );
    const driverAverageValues = driverFuelAverageReport
        .map((row) => Number(row.averageLitresPer100Km || 0))
        .filter((value) => Number.isFinite(value) && value > 0);
    const fleetAverage =
        driverAverageValues.length > 0
            ? roundTwo(driverAverageValues.reduce((sum, value) => sum + value, 0) / driverAverageValues.length)
            : 0;
    const withBenchmark: DashboardDriverFuelAverageItem[] = driverFuelAverageReport.map((row) => ({
        ...row,
        fleetAverageLitresPer100Km: fleetAverage,
        isAboveFleetAverage: fleetAverage > 0 ? Number(row.averageLitresPer100Km || 0) > fleetAverage : false,
    }));

    return { vehicleFuelAverageReport, driverFuelAverageReport: withBenchmark };
}
