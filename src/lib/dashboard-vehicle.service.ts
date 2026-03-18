import { MasrafKategorisi, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
    DashboardDateContext,
    DashboardVehicleCostItem,
    GenericWhere,
} from "@/lib/dashboard-types";
import { toNumber } from "@/lib/dashboard-helpers";

const EXCLUDED_MASRAF_TURLERI: readonly MasrafKategorisi[] = [
    MasrafKategorisi.YAKIT,
    MasrafKategorisi.HGS_YUKLEME,
];

type GroupRow = { aracId: string; _sum: { tutar: number | null } };

type VehicleAccumulator = {
    plaka: string;
    markaModel: string;
    toplam: number;
    yakit: number;
    bakim: number;
    muayene: number;
    hgs: number;
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

async function groupYakit(where: Prisma.YakitWhereInput) {
    return prisma.yakit.groupBy({ by: ["aracId"], where, _sum: { tutar: true } });
}

async function groupBakim(where: Prisma.BakimWhereInput) {
    return prisma.bakim.groupBy({ by: ["aracId"], where, _sum: { tutar: true } });
}

async function groupMuayene(where: Prisma.MuayeneWhereInput) {
    return prisma.muayene.groupBy({ by: ["aracId"], where, _sum: { tutar: true } });
}

async function groupHgs(where: Prisma.HgsYuklemeWhereInput) {
    return prisma.hgsYukleme.groupBy({ by: ["aracId"], where, _sum: { tutar: true } });
}

async function groupCeza(where: Prisma.CezaWhereInput) {
    return prisma.ceza.groupBy({ by: ["aracId"], where, _sum: { tutar: true } });
}

async function groupKasko(where: Prisma.KaskoWhereInput) {
    return prisma.kasko.groupBy({ by: ["aracId"], where, _sum: { tutar: true } });
}

async function groupTrafik(where: Prisma.TrafikSigortasiWhereInput) {
    return prisma.trafikSigortasi.groupBy({ by: ["aracId"], where, _sum: { tutar: true } });
}

async function groupMasraf(where: Prisma.MasrafWhereInput) {
    return prisma.masraf.groupBy({ by: ["aracId"], where, _sum: { tutar: true } });
}

export async function getFleetStatusData(scope: GenericWhere) {
    const [toplamArac, aktifArac, servisteArac, durumDagitimi] = await Promise.all([
        prisma.arac.count({ where: scope as Prisma.AracWhereInput }),
        prisma.arac.count({ where: { ...(scope as Prisma.AracWhereInput), durum: "AKTIF" } }),
        prisma.arac.count({ where: { ...(scope as Prisma.AracWhereInput), durum: "SERVISTE" } }),
        prisma.arac.groupBy({
            by: ["durum"],
            where: scope as Prisma.AracWhereInput,
            _count: { durum: true },
        }),
    ]);

    return {
        toplamArac,
        aktifArac,
        servisteArac,
        verimlilikOrani: toplamArac > 0 ? Math.round((aktifArac / toplamArac) * 100) : 0,
        durumData: durumDagitimi.map((row) => ({ name: row.durum, value: row._count.durum })),
    };
}

export async function getDashboardVehicleData(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    dateContext: DashboardDateContext;
}) {
    const { scope, cezaScope, dateContext } = params;
    const { seciliAyBasi, seciliAySonu, oncekiDonemBasi, oncekiDonemSonu } = dateContext;

    const [
        araclar,
        currentYakit,
        currentBakim,
        currentMuayene,
        currentHgs,
        currentCeza,
        currentKasko,
        currentTrafik,
        currentMasraf,
        prevYakit,
        prevBakim,
        prevMuayene,
        prevHgs,
        prevCeza,
        prevKasko,
        prevTrafik,
        prevMasraf,
    ] = await Promise.all([
        prisma.arac.findMany({
            where: scope as Prisma.AracWhereInput,
            select: { id: true, plaka: true, marka: true, model: true },
        }),
        groupYakit({ ...(scope as Prisma.YakitWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupBakim({ ...(scope as Prisma.BakimWhereInput), bakimTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupMuayene({ ...(scope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupHgs({ ...(scope as Prisma.HgsYuklemeWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupCeza({ ...(cezaScope as Prisma.CezaWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupKasko({ ...(scope as Prisma.KaskoWhereInput), baslangicTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupTrafik({ ...(scope as Prisma.TrafikSigortasiWhereInput), baslangicTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
        groupMasraf({
            ...(scope as Prisma.MasrafWhereInput),
            tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
            tarih: { gte: seciliAyBasi, lte: seciliAySonu },
        }),
        groupYakit({ ...(scope as Prisma.YakitWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupBakim({ ...(scope as Prisma.BakimWhereInput), bakimTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupMuayene({ ...(scope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupHgs({ ...(scope as Prisma.HgsYuklemeWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupCeza({ ...(cezaScope as Prisma.CezaWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupKasko({ ...(scope as Prisma.KaskoWhereInput), baslangicTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupTrafik({ ...(scope as Prisma.TrafikSigortasiWhereInput), baslangicTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
        groupMasraf({
            ...(scope as Prisma.MasrafWhereInput),
            tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
            tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu },
        }),
    ]);

    const vehicleMap: Record<string, VehicleAccumulator> = {};
    for (const arac of araclar) {
        vehicleMap[arac.id] = {
            plaka: arac.plaka,
            markaModel: `${arac.marka} ${arac.model}`.trim(),
            toplam: 0,
            yakit: 0,
            bakim: 0,
            muayene: 0,
            hgs: 0,
            ceza: 0,
            kasko: 0,
            trafik: 0,
            diger: 0,
        };
    }

    addVehicleCost(vehicleMap, currentYakit, "yakit");
    addVehicleCost(vehicleMap, currentBakim, "bakim");
    addVehicleCost(vehicleMap, currentMuayene, "muayene");
    addVehicleCost(vehicleMap, currentHgs, "hgs");
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
            bakim: row.bakim,
            muayene: row.muayene,
            hgs: row.hgs,
            ceza: row.ceza,
            kasko: row.kasko,
            trafik: row.trafik,
            diger: row.diger,
        }))
        .filter((row) => row.toplam > 0)
        .sort((a, b) => b.toplam - a.toplam);

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
    addPreviousRows(prevHgs);
    addPreviousRows(prevCeza);
    addPreviousRows(prevKasko);
    addPreviousRows(prevTrafik);
    addPreviousRows(prevMasraf);

    const previousValues = Object.values(previousTotalByVehicle).filter((value) => value > 0);

    return {
        vehicleCostReport: allVehicleCosts.slice(0, 10),
        top5Expenses: allVehicleCosts.slice(0, 5).map((row) => ({ plaka: row.plaka, tutar: row.toplam })),
        ortalamaAracMaliyeti: getAverage(allVehicleCosts.map((row) => row.toplam)),
        oncekiOrtalamaAracMaliyeti: getAverage(previousValues),
        aracMaliyetOrtalamaAdet: allVehicleCosts.length,
    };
}
