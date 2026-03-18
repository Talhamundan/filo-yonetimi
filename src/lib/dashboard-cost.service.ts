import { MasrafKategorisi, Prisma } from "@prisma/client";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import type {
    CostBreakdown,
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
};

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
    };
}
