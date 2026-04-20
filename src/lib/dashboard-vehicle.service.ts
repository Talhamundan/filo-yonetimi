import { MasrafKategorisi, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
    DashboardDateContext,
    DashboardVehicleCostItem,
    GenericWhere,
} from "@/lib/dashboard-types";
import { getVehicleUsageScopeWhere, toNumber } from "@/lib/dashboard-helpers";
import { KIRALIK_SIRKET_ADI } from "@/lib/ruhsat-sahibi";

const EXCLUDED_MASRAF_TURLERI: readonly MasrafKategorisi[] = [
    MasrafKategorisi.YAKIT,
];

type GroupRow = { aracId: string; _sum: { tutar: number | null } };
type YakitGroupRow = { aracId: string; _sum: { tutar: number | null; litre: number | null } };

type VehicleAccumulator = {
    plaka: string;
    markaModel: string;
    toplam: number;
    yakit: number;
    yakitLitre: number;
    bakim: number;
    muayene: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
};

function addVehicleCost(
    map: Record<string, VehicleAccumulator>,
    rows: GroupRow[],
    category: keyof Omit<VehicleAccumulator, "plaka" | "markaModel" | "toplam">
) {
    for (const row of rows) {
        if (!row?.aracId || !map[row.aracId]) continue;
        const value = toNumber(row._sum.tutar);
        if (value <= 0) continue;
        map[row.aracId][category] += value;
        map[row.aracId].toplam += value;
    }
}

function getAverage(values: number[]) {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
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

async function groupYakit(where: Prisma.YakitWhereInput) {
    return (prisma as any).yakit.groupBy({ by: ["aracId"], where, _sum: { tutar: true, litre: true } }) as Promise<YakitGroupRow[]>;
}

async function groupBakim(where: Prisma.BakimWhereInput) {
    return (prisma as any).bakim.groupBy({ by: ["aracId"], where: { ...where, deletedAt: null }, _sum: { tutar: true } }) as Promise<GroupRow[]>;
}

async function groupMuayene(where: Prisma.MuayeneWhereInput) {
    return (prisma as any).muayene.groupBy({ by: ["aracId"], where, _sum: { tutar: true } }) as Promise<GroupRow[]>;
}

async function groupCeza(where: Prisma.CezaWhereInput) {
    return (prisma as any).ceza.groupBy({ by: ["aracId"], where: { ...where, deletedAt: null }, _sum: { tutar: true } }) as Promise<GroupRow[]>;
}

async function groupKasko(where: Prisma.KaskoWhereInput) {
    return (prisma as any).kasko.groupBy({ by: ["aracId"], where, _sum: { tutar: true } }) as Promise<GroupRow[]>;
}

async function groupTrafik(where: Prisma.TrafikSigortasiWhereInput) {
    return (prisma as any).trafikSigortasi.groupBy({ by: ["aracId"], where, _sum: { tutar: true } }) as Promise<GroupRow[]>;
}

async function groupMasraf(where: Prisma.MasrafWhereInput) {
    return (prisma as any).masraf.groupBy({ by: ["aracId"], where: { ...where, deletedAt: null }, _sum: { tutar: true } }) as Promise<GroupRow[]>;
}

function addVehicleFuel(map: Record<string, VehicleAccumulator>, rows: YakitGroupRow[]) {
    for (const row of rows) {
        if (!row?.aracId || !map[row.aracId]) continue;
        const costValue = toNumber(row._sum.tutar);
        const litreValue = toNumber(row._sum.litre);
        map[row.aracId].yakit += costValue;
        map[row.aracId].yakitLitre += litreValue;
        map[row.aracId].toplam += costValue;
    }
}

export async function getFleetStatusData(scope: GenericWhere, vehicleScopeOverride?: GenericWhere) {
    const usageScopedVehicleWhere = vehicleScopeOverride || getVehicleUsageScopeWhere(scope);
    const vehicleScope = {
        AND: [
            usageScopedVehicleWhere as Prisma.AracWhereInput,
            { deletedAt: null },
            {
                NOT: {
                    OR: [
                        { disFirma: { tur: "KIRALIK" } },
                        { sirket: { ad: { equals: KIRALIK_SIRKET_ADI, mode: "insensitive" } } },
                    ],
                },
            },
        ],
    } as Prisma.AracWhereInput;

    const [toplamArac, aktifArac, servisteArac, arizaliArac, durumDagitimi] = await Promise.all([
        prisma.arac.count({ where: vehicleScope }),
        prisma.arac.count({ where: { ...vehicleScope, durum: "AKTIF" } }),
        prisma.arac.count({ where: { ...vehicleScope, durum: "SERVISTE" } }),
        prisma.arac.count({ where: { ...vehicleScope, durum: "ARIZALI" } }),
        prisma.arac.groupBy({
            by: ["durum"],
            where: vehicleScope,
            _count: { durum: true },
        }),
    ]);

    return {
        toplamArac,
        aktifArac,
        servisteArac,
        arizaliArac,
        verimlilikOrani: toplamArac > 0 ? Math.round((aktifArac / toplamArac) * 100) : 0,
        durumData: durumDagitimi.map((row) => ({ name: row.durum, value: row._count.durum })),
    };
}

export async function getDashboardVehicleData(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    dateContext: DashboardDateContext;
    vehicleScope?: GenericWhere;
}) {
    const { scope, dateContext, vehicleScope } = params;
    const { seciliAyBasi, seciliAySonu, oncekiDonemBasi, oncekiDonemSonu } = dateContext;
    const usageScopedVehicleWhere = vehicleScope || getVehicleUsageScopeWhere(scope);
    const expenseScope = getExpenseScopedWhere(scope, usageScopedVehicleWhere);
    const vehicleWhere = {
        ...(usageScopedVehicleWhere as Prisma.AracWhereInput),
        deletedAt: null,
    } as Prisma.AracWhereInput;

    const [
        araclar,
        currentYakit,
        currentBakim,
        currentMuayene,
        currentCeza,
        currentKasko,
        currentTrafik,
        currentMasraf,
        prevYakit,
        prevBakim,
        prevMuayene,
        prevCeza,
        prevKasko,
        prevTrafik,
        prevMasraf,
    ] = await Promise.all([
        prisma.arac.findMany({
            where: vehicleWhere,
            select: { id: true, plaka: true, marka: true, model: true },
        }),
        groupYakit({ ...(expenseScope as Prisma.YakitWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupBakim({ ...(expenseScope as Prisma.BakimWhereInput), bakimTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupMuayene({ ...(expenseScope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupCeza({ ...(expenseScope as Prisma.CezaWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupKasko({ ...(expenseScope as Prisma.KaskoWhereInput), baslangicTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupTrafik({
            ...(expenseScope as Prisma.TrafikSigortasiWhereInput),
            baslangicTarihi: { gte: seciliAyBasi, lte: seciliAySonu },
        }),
        groupMasraf({
            ...(expenseScope as Prisma.MasrafWhereInput),
            tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
            tarih: { gte: seciliAyBasi, lte: seciliAySonu },
        }),
        groupYakit({ ...(expenseScope as Prisma.YakitWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupBakim({ ...(expenseScope as Prisma.BakimWhereInput), bakimTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupMuayene({ ...(expenseScope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupCeza({ ...(expenseScope as Prisma.CezaWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupKasko({
            ...(expenseScope as Prisma.KaskoWhereInput),
            baslangicTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu },
        }),
        groupTrafik({
            ...(expenseScope as Prisma.TrafikSigortasiWhereInput),
            baslangicTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu },
        }),
        groupMasraf({
            ...(expenseScope as Prisma.MasrafWhereInput),
            tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
            tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu },
        }),
    ]);

    const vehicleMap: Record<string, VehicleAccumulator> = {};
    for (const arac of araclar) {
        vehicleMap[arac.id] = {
            plaka: arac.plaka || "-",
            markaModel: `${arac.marka} ${arac.model}`.trim(),
            toplam: 0,
            yakit: 0,
            yakitLitre: 0,
            bakim: 0,
            muayene: 0,
            ceza: 0,
            kasko: 0,
            trafik: 0,
            diger: 0,
        };
    }

    addVehicleFuel(vehicleMap, currentYakit);
    addVehicleCost(vehicleMap, currentBakim, "bakim");
    addVehicleCost(vehicleMap, currentMuayene, "muayene");
    addVehicleCost(vehicleMap, currentCeza, "ceza");
    addVehicleCost(vehicleMap, currentKasko, "kasko");
    addVehicleCost(vehicleMap, currentTrafik, "trafik");
    addVehicleCost(vehicleMap, currentMasraf, "diger");

    const allVehicleCosts: DashboardVehicleCostItem[] = Object.entries(vehicleMap)
        .map(([aracId, row]) => ({
            aracId,
            plaka: row.plaka,
            markaModel: row.markaModel,
            toplam: row.toplam,
            yakit: row.yakit,
            yakitLitre: row.yakitLitre,
            bakim: row.bakim,
            muayene: row.muayene,
            ceza: row.ceza,
            kasko: row.kasko,
            trafik: row.trafik,
            diger: row.diger,
        }))
        .filter((row) => row.toplam > 0 || toNumber(row.yakitLitre) > 0)
        .sort((a, b) => (b.toplam - a.toplam) || (toNumber(b.yakitLitre) - toNumber(a.yakitLitre)));

    const previousTotalByVehicle: Record<string, number> = {};
    const addPreviousRows = (rows: GroupRow[]) => {
        for (const row of rows) {
            if (!row?.aracId) continue;
            const value = toNumber(row._sum.tutar);
            if (value <= 0) continue;
            previousTotalByVehicle[row.aracId] = (previousTotalByVehicle[row.aracId] || 0) + value;
        }
    };

    addPreviousRows(prevYakit);
    addPreviousRows(prevBakim);
    addPreviousRows(prevMuayene);
    addPreviousRows(prevCeza);
    addPreviousRows(prevKasko);
    addPreviousRows(prevTrafik);
    addPreviousRows(prevMasraf);

    const previousValues = Object.values(previousTotalByVehicle).filter((value) => value > 0);

    return {
        vehicleCostReport: allVehicleCosts,
        top5Expenses: allVehicleCosts.slice(0, 5).map((row) => ({ plaka: row.plaka, tutar: row.toplam })),
        ortalamaAracMaliyeti: getAverage(allVehicleCosts.map((row) => row.toplam)),
        oncekiOrtalamaAracMaliyeti: getAverage(previousValues),
        aracMaliyetOrtalamaAdet: allVehicleCosts.length,
    };
}
