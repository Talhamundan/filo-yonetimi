import { MasrafKategorisi, Prisma } from "@prisma/client";
import { eachDayOfInterval, endOfMonth, format, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";
import type {
    DashboardComparisonGranularity,
    CostBreakdown,
    DashboardCompanyCostItem,
    DashboardDailyTrendItem,
    DashboardDateContext,
    DashboardMonthlyTrendItem,
    GenericWhere,
} from "@/lib/dashboard-types";
import { getVehicleUsageScopeWhere, toNumber } from "@/lib/dashboard-helpers";

const EXCLUDED_MASRAF_TURLERI: readonly MasrafKategorisi[] = [
    MasrafKategorisi.YAKIT,
];

type SumResult = { _sum: { tutar: number | null } };

function getSumTutar(result: SumResult) {
    return toNumber(result._sum.tutar);
}

async function sumYakit(where: Prisma.YakitWhereInput) {
    const result = await prisma.yakit.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumYakitLitre(where: Prisma.YakitWhereInput) {
    const result = await prisma.yakit.aggregate({ _sum: { litre: true }, where });
    return toNumber(result._sum.litre);
}

function roundOneDecimal(value: number) {
    return Math.round(value * 10) / 10;
}

async function getPeriodAverageLitresPer100Km(
    where: Prisma.YakitWhereInput,
    start: Date,
    end: Date
) {
    const periodRows = await prisma.yakit.findMany({
        where: { ...where, tarih: { gte: start, lte: end } },
        select: { id: true, aracId: true, tarih: true, km: true, litre: true, tutar: true },
    });

    if (periodRows.length === 0) {
        return 0;
    }

    const periodVehicleIds = Array.from(
        new Set(periodRows.map((row) => row.aracId).filter((aracId): aracId is string => Boolean(aracId)))
    );

    const boundaryRows = periodVehicleIds.length
        ? await prisma.yakit.findMany({
              where: {
                  ...where,
                  aracId: { in: periodVehicleIds },
                  tarih: { lt: start },
              },
              distinct: ["aracId"],
              orderBy: [{ aracId: "asc" }, { tarih: "desc" }, { id: "desc" }],
              select: { id: true, aracId: true, tarih: true, km: true, litre: true, tutar: true },
          })
        : [];

    const rows = [...boundaryRows, ...periodRows];
    if (rows.length < 2) {
        return 0;
    }

    const metrics = buildFuelIntervalMetrics(rows);
    const vehicleAverages = [...metrics.byVehicleId.values()]
        .map((row) => toNumber(row.averageLitresPer100Km))
        .filter((value) => value > 0);

    if (!vehicleAverages.length) {
        return 0;
    }

    const average = vehicleAverages.reduce((sum, value) => sum + value, 0) / vehicleAverages.length;
    return roundOneDecimal(average);
}

async function sumBakim(where: Prisma.BakimWhereInput) {
    const result = await prisma.bakim.aggregate({ _sum: { tutar: true }, where });
    return getSumTutar(result);
}

async function sumMuayene(where: Prisma.MuayeneWhereInput) {
    const result = await prisma.muayene.aggregate({ _sum: { tutar: true }, where });
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
    dailyExpenseTrend: DashboardDailyTrendItem[];
    sixMonthsTrend: { name: string; gider: number }[];
    companyCostReport: DashboardCompanyCostItem[];
};

type DashboardFuelConsumptionResult = {
    currentLitres: number;
    previousLitres: number;
    currentAverageLitresPer100Km: number;
    previousAverageLitresPer100Km: number;
};

type GroupedByVehicleSumRow = { aracId: string; sirketId: string | null; _sum: { tutar: number | null } };
type GroupedByVehicleYakitSumRow = {
    aracId: string;
    sirketId: string | null;
    _sum: { tutar: number | null; litre: number | null };
};
type CompanyCostCategoryKey = "yakit" | "bakim" | "muayene" | "ceza" | "kasko" | "trafik" | "diger";
type UsageCompanyInfo = {
    key: string;
    sirketId: string | null;
    label: string;
};
type CompanyCostAccumulator = {
    groupKey: string;
    sirketId: string | null;
    groupLabel: string;
    yakit: number;
    yakitLitre: number;
    bakim: number;
    muayene: number;
    ceza: number;
    kasko: number;
    trafik: number;
    diger: number;
    toplam: number;
};

type AracCompanyResolveRow = {
    id: string;
    calistigiKurum: string | null;
    sirket: { id: string; ad: string } | null;
    kullanici: {
        deletedAt: Date | null;
        calistigiKurum: string | null;
        sirket: { id: string; ad: string } | null;
    } | null;
    kullaniciGecmisi: Array<{
        kullanici: {
            deletedAt: Date | null;
            calistigiKurum: string | null;
            sirket: { id: string; ad: string } | null;
        } | null;
    }>;
};

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

function normalizeCompanyId(value: string | null | undefined) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
}

function normalizeCompanyText(value: string | null | undefined) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
}

function getUsageCompanyKey(params: { sirketId: string | null; label: string }) {
    const normalizedSirketId = normalizeCompanyId(params.sirketId);
    if (normalizedSirketId) {
        return `sirket:${normalizedSirketId}`;
    }
    const normalizedLabel = (normalizeCompanyText(params.label) || "Bağımsız").toLocaleLowerCase("tr-TR");
    return `kurum:${normalizedLabel}`;
}

function getOrCreateCompanyAccumulator(
    groupedTotals: Map<string, CompanyCostAccumulator>,
    usage: UsageCompanyInfo
) {
    const key = usage.key;
    const existing = groupedTotals.get(key);
    if (existing) {
        return existing;
    }

    const created: CompanyCostAccumulator = {
        groupKey: key,
        sirketId: usage.sirketId,
        groupLabel: usage.label,
        yakit: 0,
        yakitLitre: 0,
        bakim: 0,
        muayene: 0,
        ceza: 0,
        kasko: 0,
        trafik: 0,
        diger: 0,
        toplam: 0,
    };
    groupedTotals.set(key, created);
    return created;
}

function addCompanyCategoryAmount(
    groupedTotals: Map<string, CompanyCostAccumulator>,
    usage: UsageCompanyInfo,
    category: CompanyCostCategoryKey,
    amount: number
) {
    if (amount <= 0) return;
    const accumulator = getOrCreateCompanyAccumulator(groupedTotals, usage);
    accumulator[category] += amount;
    accumulator.toplam += amount;
    groupedTotals.set(accumulator.groupKey, accumulator);
}

function addCompanyFuelLitres(groupedTotals: Map<string, CompanyCostAccumulator>, usage: UsageCompanyInfo, litres: number) {
    if (litres <= 0) return;
    const accumulator = getOrCreateCompanyAccumulator(groupedTotals, usage);
    accumulator.yakitLitre += litres;
    groupedTotals.set(accumulator.groupKey, accumulator);
}

function cloneCompanyAccumulator(item: CompanyCostAccumulator): CompanyCostAccumulator {
    return { ...item };
}

function mergeCompanyAccumulator(target: CompanyCostAccumulator, source: CompanyCostAccumulator) {
    target.yakit += source.yakit;
    target.yakitLitre += source.yakitLitre;
    target.bakim += source.bakim;
    target.muayene += source.muayene;
    target.ceza += source.ceza;
    target.kasko += source.kasko;
    target.trafik += source.trafik;
    target.diger += source.diger;
    target.toplam += source.toplam;
    if (!target.sirketId && source.sirketId) {
        target.sirketId = source.sirketId;
    }
}

function getCompanyLabelKey(label: string | null | undefined) {
    return (normalizeCompanyText(label) || "Bağımsız").toLocaleLowerCase("tr-TR");
}

function mergeDuplicateCompanyAccumulators(values: CompanyCostAccumulator[]) {
    const mergedByPrimaryKey = new Map<string, CompanyCostAccumulator>();

    for (const item of values) {
        const normalizedSirketId = normalizeCompanyId(item.sirketId);
        const key = normalizedSirketId ? `sirket:${normalizedSirketId}` : `kurum:${getCompanyLabelKey(item.groupLabel)}`;
        const existing = mergedByPrimaryKey.get(key);
        if (!existing) {
            mergedByPrimaryKey.set(key, cloneCompanyAccumulator(item));
            continue;
        }
        mergeCompanyAccumulator(existing, item);
    }

    const sirketRowsByLabel = new Map<string, CompanyCostAccumulator>();
    for (const row of mergedByPrimaryKey.values()) {
        if (!normalizeCompanyId(row.sirketId)) continue;
        sirketRowsByLabel.set(getCompanyLabelKey(row.groupLabel), row);
    }

    for (const [key, row] of [...mergedByPrimaryKey.entries()]) {
        if (normalizeCompanyId(row.sirketId)) continue;
        const matchingSirketRow = sirketRowsByLabel.get(getCompanyLabelKey(row.groupLabel));
        if (!matchingSirketRow) continue;
        mergeCompanyAccumulator(matchingSirketRow, row);
        mergedByPrimaryKey.delete(key);
    }

    return [...mergedByPrimaryKey.values()];
}

function resolveUsageCompanyInfo(arac: AracCompanyResolveRow): UsageCompanyInfo {
    const aktifZimmetKullanici = arac.kullaniciGecmisi?.[0]?.kullanici || null;
    const aktifKullanici = aktifZimmetKullanici || arac.kullanici || null;
    const gecerliKullanici = aktifKullanici?.deletedAt ? null : aktifKullanici;
    
    // Araçlar sayfasındaki "Kullanıcı Firma" mantığı:
    // 1. arac.calistigiKurum var mı?
    // 2. Yoksa zimmetli personelin kendi bağlı olduğu sirket (kullanici.sirket)
    // Ruhsat sahibine (arac.sirket) ASLA dönülmez.
    
    const manualFirma = normalizeCompanyText(arac.calistigiKurum);
    const kullaniciSirketAd = normalizeCompanyText(gecerliKullanici?.sirket?.ad);
    const kullaniciSirketId = normalizeCompanyId(gecerliKullanici?.sirket?.id);

    // KULLANICI FİRMA ÖNCELİĞİ:
    // 1. ZİMMETLİ PERSONELİN ASIL FİRMASI (kullaniciSirketAd)
    // 2. BOŞTAYSA ARAÇ ÜZERİNDE ELLE BELİRTİLEN FİRMA (manualFirma)
    const sirketAd = kullaniciSirketAd || manualFirma || "Bağımsız";
    const sirketId = kullaniciSirketAd ? kullaniciSirketId : (manualFirma ? null : null);

    return {
        key: getUsageCompanyKey({ sirketId, label: sirketAd }),
        sirketId,
        label: sirketAd,
    };
}

function getDefaultUsageCompanyInfo(): UsageCompanyInfo {
    const label = "Bağımsız";
    return { key: getUsageCompanyKey({ sirketId: null, label }), sirketId: null, label };
}

async function getUsageCompanyByAracId(aracIds: string[]) {
    if (!aracIds.length) return new Map<string, UsageCompanyInfo>();

    const araclar = (await prisma.arac.findMany({
        where: { id: { in: aracIds } },
        select: {
            id: true,
            calistigiKurum: true,
            sirket: { select: { id: true, ad: true } },
            kullanici: {
                select: {
                    deletedAt: true,
                    calistigiKurum: true,
                    sirket: { select: { id: true, ad: true } },
                },
            },
            kullaniciGecmisi: {
                where: { bitis: null },
                orderBy: { baslangic: "desc" },
                take: 1,
                select: {
                    kullanici: {
                        select: {
                            deletedAt: true,
                            calistigiKurum: true,
                            sirket: { select: { id: true, ad: true } },
                        },
                    },
                },
            },
        },
    })) as AracCompanyResolveRow[];

    const map = new Map<string, UsageCompanyInfo>();
    for (const arac of araclar) {
        map.set(arac.id, resolveUsageCompanyInfo(arac));
    }

    return map;
}

function mergeGroupedByVehicleSums(
    groupedTotals: Map<string, CompanyCostAccumulator>,
    rows: GroupedByVehicleSumRow[],
    category: CompanyCostCategoryKey,
    usageCompanyByAracId: Map<string, UsageCompanyInfo>,
    usageCompanyBySirketId: Map<string, UsageCompanyInfo>
) {
    const defaultUsage = getDefaultUsageCompanyInfo();
    for (const row of rows) {
        const normalizedSirketId = normalizeCompanyId(row.sirketId);
        const usage =
            usageCompanyByAracId.get(row.aracId) ||
            (normalizedSirketId ? usageCompanyBySirketId.get(normalizedSirketId) : null) ||
            defaultUsage;
        addCompanyCategoryAmount(groupedTotals, usage, category, toNumber(row._sum.tutar));
    }
}

export async function getCompanyCostReportForPeriod(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    vehicleScope?: GenericWhere;
    start: Date;
    end: Date;
}): Promise<DashboardCompanyCostItem[]> {
    const { scope, vehicleScope, start, end } = params;
    const expenseScope = getExpenseScopedWhere(scope, vehicleScope);
    const expenseCezaScope = getExpenseScopedWhere(scope, vehicleScope);
    const groupedTotals = new Map<string, CompanyCostAccumulator>();

    const [
        yakitRows,
        bakimRows,
        muayeneRows,
        cezaRows,
        kaskoRows,
        trafikRows,
        digerRows,
    ] = await Promise.all([
        (prisma as any).yakit.groupBy({
            by: ["aracId", "sirketId"],
            where: { ...(expenseScope as Prisma.YakitWhereInput), tarih: { gte: start, lte: end } },
            _sum: { tutar: true, litre: true },
        }) as Promise<GroupedByVehicleYakitSumRow[]>,
        (prisma as any).bakim.groupBy({
            by: ["aracId", "sirketId"],
            where: { ...(expenseScope as Prisma.BakimWhereInput), bakimTarihi: { gte: start, lte: end } },
            _sum: { tutar: true },
        }) as Promise<GroupedByVehicleSumRow[]>,
        (prisma as any).muayene.groupBy({
            by: ["aracId", "sirketId"],
            where: { ...(expenseScope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: start, lte: end } },
            _sum: { tutar: true },
        }) as Promise<GroupedByVehicleSumRow[]>,
        (prisma as any).ceza.groupBy({
            by: ["aracId", "sirketId"],
            where: { ...(expenseCezaScope as Prisma.CezaWhereInput), tarih: { gte: start, lte: end } },
            _sum: { tutar: true },
        }) as Promise<GroupedByVehicleSumRow[]>,
        (prisma as any).kasko.groupBy({
            by: ["aracId", "sirketId"],
            where: { ...(expenseScope as Prisma.KaskoWhereInput), baslangicTarihi: { gte: start, lte: end } },
            _sum: { tutar: true },
        }) as Promise<GroupedByVehicleSumRow[]>,
        (prisma as any).trafikSigortasi.groupBy({
            by: ["aracId", "sirketId"],
            where: { ...(expenseScope as Prisma.TrafikSigortasiWhereInput), baslangicTarihi: { gte: start, lte: end } },
            _sum: { tutar: true },
        }) as Promise<GroupedByVehicleSumRow[]>,
        (prisma as any).masraf.groupBy({
            by: ["aracId", "sirketId"],
            where: {
                ...(expenseScope as Prisma.MasrafWhereInput),
                tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
                tarih: { gte: start, lte: end },
            },
            _sum: { tutar: true },
        }) as Promise<GroupedByVehicleSumRow[]>,
    ]);

    const aracIds = Array.from(
        new Set(
            [
                ...yakitRows.map((row) => row.aracId),
                ...bakimRows.map((row) => row.aracId),
                ...muayeneRows.map((row) => row.aracId),
                ...cezaRows.map((row) => row.aracId),
                ...kaskoRows.map((row) => row.aracId),
                ...trafikRows.map((row) => row.aracId),
                ...digerRows.map((row) => row.aracId),
            ].filter((aracId) => typeof aracId === "string" && aracId.length > 0)
        )
    );
    const usageCompanyByAracId = await getUsageCompanyByAracId(aracIds);
    const sirketIds = Array.from(
        new Set(
            [
                ...yakitRows.map((row) => normalizeCompanyId(row.sirketId)),
                ...bakimRows.map((row) => normalizeCompanyId(row.sirketId)),
                ...muayeneRows.map((row) => normalizeCompanyId(row.sirketId)),
                ...cezaRows.map((row) => normalizeCompanyId(row.sirketId)),
                ...kaskoRows.map((row) => normalizeCompanyId(row.sirketId)),
                ...trafikRows.map((row) => normalizeCompanyId(row.sirketId)),
                ...digerRows.map((row) => normalizeCompanyId(row.sirketId)),
            ].filter((id): id is string => typeof id === "string" && id.length > 0)
        )
    );
    const sirketRows = sirketIds.length
        ? await prisma.sirket.findMany({ where: { id: { in: sirketIds } }, select: { id: true, ad: true } })
        : [];
    const usageCompanyBySirketId = new Map<string, UsageCompanyInfo>();
    for (const sirket of sirketRows) {
        const sirketId = normalizeCompanyId(sirket.id);
        if (!sirketId) continue;
        const label = normalizeCompanyText(sirket.ad) || "Bağımsız";
        usageCompanyBySirketId.set(sirketId, {
            key: getUsageCompanyKey({ sirketId, label }),
            sirketId,
            label,
        });
    }

    const defaultUsage = getDefaultUsageCompanyInfo();
    for (const row of yakitRows) {
        const normalizedSirketId = normalizeCompanyId(row.sirketId);
        const usage =
            usageCompanyByAracId.get(row.aracId) ||
            (normalizedSirketId ? usageCompanyBySirketId.get(normalizedSirketId) : null) ||
            defaultUsage;
        addCompanyCategoryAmount(groupedTotals, usage, "yakit", toNumber(row._sum.tutar));
        addCompanyFuelLitres(groupedTotals, usage, toNumber(row._sum.litre));
    }
    mergeGroupedByVehicleSums(groupedTotals, bakimRows, "bakim", usageCompanyByAracId, usageCompanyBySirketId);
    mergeGroupedByVehicleSums(groupedTotals, muayeneRows, "muayene", usageCompanyByAracId, usageCompanyBySirketId);
    mergeGroupedByVehicleSums(groupedTotals, cezaRows, "ceza", usageCompanyByAracId, usageCompanyBySirketId);
    mergeGroupedByVehicleSums(groupedTotals, kaskoRows, "kasko", usageCompanyByAracId, usageCompanyBySirketId);
    mergeGroupedByVehicleSums(groupedTotals, trafikRows, "trafik", usageCompanyByAracId, usageCompanyBySirketId);
    mergeGroupedByVehicleSums(groupedTotals, digerRows, "diger", usageCompanyByAracId, usageCompanyBySirketId);

    return mergeDuplicateCompanyAccumulators([...groupedTotals.values()])
        .map((item) => ({
            sirketId: item.sirketId,
            sirketAd: item.groupLabel || "Bağımsız",
            yakit: Math.round(item.yakit),
            yakitLitre: Math.round(item.yakitLitre * 10) / 10,
            bakim: Math.round(item.bakim),
            muayene: Math.round(item.muayene),
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
        ceza,
        kasko,
        trafik,
        diger,
    ] = await Promise.all([
        sumYakit({ ...(scope as Prisma.YakitWhereInput), tarih: { gte: start, lte: end } }),
        sumBakim({ ...(scope as Prisma.BakimWhereInput), bakimTarihi: { gte: start, lte: end } }),
        sumMuayene({ ...(scope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: start, lte: end } }),
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
        ceza,
        kasko,
        trafik,
        diger,
        toplam: yakit + bakim + muayene + ceza + kasko + trafik + diger,
    };
}

function createEmptyDailyTrendItem(date: Date): DashboardDailyTrendItem {
    const dateKey = format(date, "yyyy-MM-dd");
    return {
        dateKey,
        gun: Number(format(date, "d")),
        name: format(date, "d"),
        yakit: 0,
        yakitLitre: 0,
        bakim: 0,
        muayene: 0,
        ceza: 0,
        kasko: 0,
        trafik: 0,
        diger: 0,
        toplam: 0,
    };
}

function addDailyFuelLitres(map: Map<string, DashboardDailyTrendItem>, date: Date, litres: number) {
    const dateKey = format(date, "yyyy-MM-dd");
    const item = map.get(dateKey);
    if (!item) return;
    item.yakitLitre = toNumber(item.yakitLitre) + litres;
}

function addDailyAmount(
    map: Map<string, DashboardDailyTrendItem>,
    date: Date,
    category: "yakit" | "bakim" | "muayene" | "ceza" | "kasko" | "trafik" | "diger",
    amount: number
) {
    const dateKey = format(date, "yyyy-MM-dd");
    const item = map.get(dateKey);
    if (!item) return;
    item[category] += amount;
    item.toplam += amount;
}

async function getDailyExpenseTrendForPeriod(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    start: Date;
    end: Date;
}): Promise<DashboardDailyTrendItem[]> {
    const { scope, cezaScope, start, end } = params;
    const dayMap = new Map<string, DashboardDailyTrendItem>();

    for (const day of eachDayOfInterval({ start, end })) {
        const item = createEmptyDailyTrendItem(day);
        dayMap.set(item.dateKey, item);
    }

    const [yakitRows, bakimRows, muayeneRows, cezaRows, kaskoRows, trafikRows, digerRows] =
        await Promise.all([
            prisma.yakit.findMany({
                where: { ...(scope as Prisma.YakitWhereInput), tarih: { gte: start, lte: end } },
                select: { tarih: true, tutar: true, litre: true },
            }),
            prisma.bakim.findMany({
                where: { ...(scope as Prisma.BakimWhereInput), bakimTarihi: { gte: start, lte: end } },
                select: { bakimTarihi: true, tutar: true },
            }),
            prisma.muayene.findMany({
                where: { ...(scope as Prisma.MuayeneWhereInput), muayeneTarihi: { gte: start, lte: end } },
                select: { muayeneTarihi: true, tutar: true },
            }),
            prisma.ceza.findMany({
                where: { ...(cezaScope as Prisma.CezaWhereInput), tarih: { gte: start, lte: end } },
                select: { tarih: true, tutar: true },
            }),
            prisma.kasko.findMany({
                where: { ...(scope as Prisma.KaskoWhereInput), baslangicTarihi: { gte: start, lte: end } },
                select: { baslangicTarihi: true, tutar: true },
            }),
            prisma.trafikSigortasi.findMany({
                where: { ...(scope as Prisma.TrafikSigortasiWhereInput), baslangicTarihi: { gte: start, lte: end } },
                select: { baslangicTarihi: true, tutar: true },
            }),
            prisma.masraf.findMany({
                where: {
                    ...(scope as Prisma.MasrafWhereInput),
                    tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
                    tarih: { gte: start, lte: end },
                },
                select: { tarih: true, tutar: true },
            }),
        ]);

    for (const row of yakitRows) {
        addDailyAmount(dayMap, row.tarih, "yakit", toNumber(row.tutar));
        addDailyFuelLitres(dayMap, row.tarih, toNumber(row.litre));
    }
    for (const row of bakimRows) addDailyAmount(dayMap, row.bakimTarihi, "bakim", toNumber(row.tutar));
    for (const row of muayeneRows) addDailyAmount(dayMap, row.muayeneTarihi, "muayene", toNumber(row.tutar));
    for (const row of cezaRows) addDailyAmount(dayMap, row.tarih, "ceza", toNumber(row.tutar));
    for (const row of kaskoRows) addDailyAmount(dayMap, row.baslangicTarihi, "kasko", toNumber(row.tutar));
    for (const row of trafikRows) addDailyAmount(dayMap, row.baslangicTarihi, "trafik", toNumber(row.tutar));
    for (const row of digerRows) addDailyAmount(dayMap, row.tarih, "diger", toNumber(row.tutar));

    return [...dayMap.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export async function getDashboardCostData(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    vehicleScope?: GenericWhere;
    dateContext: DashboardDateContext;
    comparisonGranularity: DashboardComparisonGranularity;
}): Promise<DashboardCostServiceResult> {
    const { scope, vehicleScope, dateContext, comparisonGranularity } = params;
    const usageExpenseScope = getExpenseScopedWhere(scope, vehicleScope);
    const usageExpenseCezaScope = getExpenseScopedWhere(scope, vehicleScope);
    const { seciliAyBasi, seciliAySonu, oncekiDonemBasi, oncekiDonemSonu, normalizedYear, normalizedMonth } = dateContext;

    const [current, previous, dailyExpenseTrend] = await Promise.all([
        getBreakdownForPeriod({ scope: usageExpenseScope, cezaScope: usageExpenseCezaScope, start: seciliAyBasi, end: seciliAySonu }),
        getBreakdownForPeriod({
            scope: usageExpenseScope,
            cezaScope: usageExpenseCezaScope,
            start: oncekiDonemBasi,
            end: oncekiDonemSonu,
        }),
        getDailyExpenseTrendForPeriod({
            scope: usageExpenseScope,
            cezaScope: usageExpenseCezaScope,
            start: seciliAyBasi,
            end: seciliAySonu,
        }),
    ]);
    const companyCostReport = await getCompanyCostReportForPeriod({
        scope: usageExpenseScope,
        cezaScope: usageExpenseCezaScope,
        vehicleScope,
        start: seciliAyBasi,
        end: seciliAySonu,
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const effectiveEndMonth =
        comparisonGranularity === "YIL"
            ? normalizedYear < currentYear
                ? 12
                : Math.min(normalizedMonth, currentMonth)
            : normalizedMonth;
    const endMonthIndex = Math.max(0, effectiveEndMonth - 1);
    const startMonthIndex = comparisonGranularity === "YIL" ? 0 : Math.max(0, endMonthIndex - 5);
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
            const [breakdown, yakitLitre] = await Promise.all([
                getBreakdownForPeriod({ scope: usageExpenseScope, cezaScope: usageExpenseCezaScope, start, end }),
                sumYakitLitre({ ...(usageExpenseScope as Prisma.YakitWhereInput), tarih: { gte: start, lte: end } }),
            ]);
            return { name, ...breakdown, yakitLitre };
        })
    );

    return {
        current,
        previous,
        monthlyExpenseTrend,
        dailyExpenseTrend,
        sixMonthsTrend: monthlyExpenseTrend.map((item) => ({ name: item.name, gider: item.toplam })),
        companyCostReport,
    };
}

export async function getDashboardFuelConsumptionData(params: {
    scope: GenericWhere;
    vehicleScope?: GenericWhere;
    dateContext: DashboardDateContext;
}): Promise<DashboardFuelConsumptionResult> {
    const { scope, vehicleScope, dateContext } = params;
    const usageExpenseScope = getExpenseScopedWhere(scope, vehicleScope);
    const { seciliAyBasi, seciliAySonu, oncekiDonemBasi, oncekiDonemSonu } = dateContext;

    const [current, previous, currentAverageLitresPer100Km, previousAverageLitresPer100Km] = await Promise.all([
        prisma.yakit.aggregate({
            where: { ...(usageExpenseScope as Prisma.YakitWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } },
            _sum: { litre: true },
        }),
        prisma.yakit.aggregate({
            where: { ...(usageExpenseScope as Prisma.YakitWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } },
            _sum: { litre: true },
        }),
        getPeriodAverageLitresPer100Km(
            usageExpenseScope as Prisma.YakitWhereInput,
            seciliAyBasi,
            seciliAySonu
        ),
        getPeriodAverageLitresPer100Km(
            usageExpenseScope as Prisma.YakitWhereInput,
            oncekiDonemBasi,
            oncekiDonemSonu
        ),
    ]);

    return {
        currentLitres: toNumber(current._sum.litre),
        previousLitres: toNumber(previous._sum.litre),
        currentAverageLitresPer100Km,
        previousAverageLitresPer100Km,
    };
}
