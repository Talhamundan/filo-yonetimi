import { MasrafKategorisi, Prisma } from "@prisma/client";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import type {
    CostBreakdown,
    DashboardCompanyCostItem,
    DashboardDateContext,
    DashboardMonthlyTrendItem,
    GenericWhere,
} from "@/lib/dashboard-types";
import { toNumber } from "@/lib/dashboard-helpers";

const EXCLUDED_MASRAF_TURLERI: readonly MasrafKategorisi[] = [
    MasrafKategorisi.YAKIT,
    MasrafKategorisi.HGS_YUKLEME,
];

type SumResult = { _sum: { tutar: number | null } };

function getSumTutar(result: SumResult) {
    return toNumber(result._sum.tutar);
}

async function sumYakit(where: Prisma.YakitWhereInput) {
    const result = await prisma.yakit.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumBakim(where: Prisma.BakimWhereInput) {
    const result = await prisma.bakim.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumMuayene(where: Prisma.MuayeneWhereInput) {
    const result = await prisma.muayene.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumHgs(where: Prisma.HgsYuklemeWhereInput) {
    const result = await prisma.hgsYukleme.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumCeza(where: Prisma.CezaWhereInput) {
    const result = await prisma.ceza.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumKasko(where: Prisma.KaskoWhereInput) {
    const result = await prisma.kasko.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumTrafik(where: Prisma.TrafikSigortasiWhereInput) {
    const result = await prisma.trafikSigortasi.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumDigerMasraf(where: Prisma.MasrafWhereInput) {
    const result = await prisma.masraf.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

type DashboardCostServiceResult = {
    current: CostBreakdown;
    previous: CostBreakdown;
    monthlyExpenseTrend: DashboardMonthlyTrendItem[];
    sixMonthsTrend: { name: string; gider: number }[];
    companyCostReport: DashboardCompanyCostItem[];
};

type GroupedSumRow = { sirketId: string | null; _sum: { tutar: number | null } };
type CompanyCostCategoryKey = "yakit" | "bakim" | "muayene" | "hgs" | "ceza" | "kasko" | "trafik" | "diger";
type CompanyCostAccumulator = {
    sirketId: string | null;
    yakit: number;
    bakim: number;
    muayene: number;
    hgs: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
    toplam: number;
};

function mergeGroupedSums(
    groupedTotals: Map<string, CompanyCostAccumulator>,
    rows: GroupedSumRow[],
    category: CompanyCostCategoryKey
) {
    for (const row of rows) {
        const key = row.sirketId || "__BAGIMSIZ__";
        const existing = groupedTotals.get(key) || {
            sirketId: row.sirketId,
            yakit: 0,
            bakim: 0,
            muayene: 0,
            hgs: 0,
            ceza: 0,
            kasko: 0,
            trafik: 0,
            diger: 0,
            toplam: 0,
        };
        const amount = toNumber(row._sum.tutar);
        existing[category] += amount;
        existing.toplam += amount;
        groupedTotals.set(key, existing);
    }
}

export async function getCompanyCostReportForPeriod(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    start: Date;
    end: Date;
}): Promise<DashboardCompanyCostItem[]> {
    const { scope, cezaScope, start, end } = params;
    const groupedTotals = new Map<string, CompanyCostAccumulator>();

    const [
        yakitRows,
        bakimRows,
        muayeneRows,
        hgsRows,
        cezaRows,
        kaskoRows,
        trafikRows,
        digerRows,
    ] = await Promise.all([
        prisma.yakit.groupBy({
            by: ["sirketId"],
            where: { ...(scope as Prisma.YakitWhereInput), tarih: { gte: start, lte: end } },
            _sum: { tutar: true },
        }),
        prisma.bakim.groupBy({
            by: ["sirketId"],
            where: { ...(scope as Prisma.BakimWhereInput), bakimTarihi: { gte: start, lte: end } },
            _sum: { tutar: true },
        }),
        prisma.muayene.groupBy({
            by: ["sirketId"],
            where: { ...(scope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: start, lte: end } },
            _sum: { tutar: true },
        }),
        prisma.hgsYukleme.groupBy({
            by: ["sirketId"],
            where: { ...(scope as Prisma.HgsYuklemeWhereInput), tarih: { gte: start, lte: end } },
            _sum: { tutar: true },
        }),
        prisma.ceza.groupBy({
            by: ["sirketId"],
            where: { ...(cezaScope as Prisma.CezaWhereInput), tarih: { gte: start, lte: end } },
            _sum: { tutar: true },
        }),
        prisma.kasko.groupBy({
            by: ["sirketId"],
            where: { ...(scope as Prisma.KaskoWhereInput), baslangicTarihi: { gte: start, lte: end } },
            _sum: { tutar: true },
        }),
        prisma.trafikSigortasi.groupBy({
            by: ["sirketId"],
            where: { ...(scope as Prisma.TrafikSigortasiWhereInput), baslangicTarihi: { gte: start, lte: end } },
            _sum: { tutar: true },
        }),
        prisma.masraf.groupBy({
            by: ["sirketId"],
            where: {
                ...(scope as Prisma.MasrafWhereInput),
                tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
                tarih: { gte: start, lte: end },
            },
            _sum: { tutar: true },
        }),
    ]);

    mergeGroupedSums(groupedTotals, yakitRows, "yakit");
    mergeGroupedSums(groupedTotals, bakimRows, "bakim");
    mergeGroupedSums(groupedTotals, muayeneRows, "muayene");
    mergeGroupedSums(groupedTotals, hgsRows, "hgs");
    mergeGroupedSums(groupedTotals, cezaRows, "ceza");
    mergeGroupedSums(groupedTotals, kaskoRows, "kasko");
    mergeGroupedSums(groupedTotals, trafikRows, "trafik");
    mergeGroupedSums(groupedTotals, digerRows, "diger");

    const sirketIds = [...groupedTotals.values()]
        .map((item) => item.sirketId)
        .filter((id): id is string => Boolean(id));

    const sirketler = sirketIds.length
        ? await prisma.sirket.findMany({
              where: { id: { in: sirketIds } },
              select: { id: true, ad: true },
          })
        : [];

    const sirketAdMap = new Map(sirketler.map((item) => [item.id, item.ad]));

    return [...groupedTotals.values()]
        .map((item) => ({
            sirketId: item.sirketId,
            sirketAd: item.sirketId ? sirketAdMap.get(item.sirketId) || "Silinmiş Şirket" : "Bağımsız",
            yakit: Math.round(item.yakit),
            bakim: Math.round(item.bakim),
            muayene: Math.round(item.muayene),
            hgs: Math.round(item.hgs),
            ceza: Math.round(item.ceza),
            kasko: Math.round(item.kasko),
            trafik: Math.round(item.trafik),
            diger: Math.round(item.diger),
            toplam: Math.round(item.toplam),
        }))
        .sort((a, b) => b.toplam - a.toplam);
}

async function getBreakdownForPeriod(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    start: Date;
    end: Date;
}): Promise<CostBreakdown> {
    const { scope, cezaScope, start, end } = params;

    const [
        yakit,
        bakim,
        muayene,
        hgs,
        ceza,
        kasko,
        trafik,
        diger,
    ] = await Promise.all([
        sumYakit({ ...(scope as Prisma.YakitWhereInput), tarih: { gte: start, lte: end } }),
        sumBakim({ ...(scope as Prisma.BakimWhereInput), bakimTarihi: { gte: start, lte: end } }),
        sumMuayene({ ...(scope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: start, lte: end } }),
        sumHgs({ ...(scope as Prisma.HgsYuklemeWhereInput), tarih: { gte: start, lte: end } }),
        sumCeza({ ...(cezaScope as Prisma.CezaWhereInput), tarih: { gte: start, lte: end } }),
        sumKasko({ ...(scope as Prisma.KaskoWhereInput), baslangicTarihi: { gte: start, lte: end } }),
        sumTrafik({ ...(scope as Prisma.TrafikSigortasiWhereInput), baslangicTarihi: { gte: start, lte: end } }),
        sumDigerMasraf({
            ...(scope as Prisma.MasrafWhereInput),
            tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
            tarih: { gte: start, lte: end },
        }),
    ]);

    return {
        yakit,
        bakim,
        muayene,
        hgs,
        ceza,
        kasko,
        trafik,
        diger,
        toplam: yakit + bakim + muayene + hgs + ceza + kasko + trafik + diger,
    };
}

export async function getDashboardCostData(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    dateContext: DashboardDateContext;
}): Promise<DashboardCostServiceResult> {
    const { scope, cezaScope, dateContext } = params;
    const { seciliAyBasi, seciliAySonu, oncekiDonemBasi, oncekiDonemSonu, normalizedYear, normalizedMonth } = dateContext;

    const [current, previous] = await Promise.all([
        getBreakdownForPeriod({ scope, cezaScope, start: seciliAyBasi, end: seciliAySonu }),
        getBreakdownForPeriod({ scope, cezaScope, start: oncekiDonemBasi, end: oncekiDonemSonu }),
    ]);
    const companyCostReport = await getCompanyCostReportForPeriod({
        scope,
        cezaScope,
        start: seciliAyBasi,
        end: seciliAySonu,
    });

    const endMonthIndex = normalizedMonth - 1;
    const startMonthIndex = Math.max(0, endMonthIndex - 5);
    const periods = Array.from({ length: endMonthIndex - startMonthIndex + 1 }, (_, idx) => {
        const month = startMonthIndex + idx;
        const date = new Date(normalizedYear, month, 1);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        const ay = format(start, "MMM", { locale: tr });
        return { start, end, name: ay.charAt(0).toUpperCase() + ay.slice(1) };
    });

    const monthlyExpenseTrend: DashboardMonthlyTrendItem[] = await Promise.all(
        periods.map(async ({ start, end, name }) => {
            const breakdown = await getBreakdownForPeriod({ scope, cezaScope, start, end });
            return { name, ...breakdown };
        })
    );

    return {
        current,
        previous,
        monthlyExpenseTrend,
        sixMonthsTrend: monthlyExpenseTrend.map((item) => ({ name: item.name, gider: item.toplam })),
        companyCostReport,
    };
}
