import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays, endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import { tr } from "date-fns/locale";

type GenericWhere = Record<string, unknown>;

let loggedMuayeneFallback = false;
let loggedCezaFallback = false;
let loggedHgsFallback = false;
let loggedSigortaFallback = false;
let loggedYakitFallback = false;
let loggedArizaFallback = false;

const EXCLUDED_MASRAF_TURLERI = ["YAKIT", "HGS_YUKLEME"] as const;

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function logOnce(ref: "muayene" | "ceza" | "hgs" | "sigorta" | "yakit" | "ariza", message: string, error: unknown) {
  if (ref === "muayene") {
    if (loggedMuayeneFallback) return;
    loggedMuayeneFallback = true;
  } else if (ref === "ceza") {
    if (loggedCezaFallback) return;
    loggedCezaFallback = true;
  } else if (ref === "hgs") {
    if (loggedHgsFallback) return;
    loggedHgsFallback = true;
  } else if (ref === "yakit") {
    if (loggedYakitFallback) return;
    loggedYakitFallback = true;
  } else if (ref === "ariza") {
    if (loggedArizaFallback) return;
    loggedArizaFallback = true;
  } else {
    if (loggedSigortaFallback) return;
    loggedSigortaFallback = true;
  }

  console.warn(message, error);
}

function formatDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getCezaScopeWhere(scope: GenericWhere) {
  const sirketId = typeof (scope as any)?.sirketId === "string" ? ((scope as any).sirketId as string) : null;
  if (!sirketId) {
    return scope;
  }

  const restScope = { ...(scope as GenericWhere) };
  delete (restScope as Record<string, unknown>).sirketId;

  return {
    AND: [
      restScope,
      {
        OR: [
          { sirketId },
          { AND: [{ sirketId: null }, { aracById: { sirketId } }] },
          { AND: [{ sirketId: null }, { arac: { sirketId } }] },
        ],
      },
    ],
  } as GenericWhere;
}

async function safeSumAggregate(params: {
  model: string;
  where?: GenericWhere;
  dateField?: string;
  start?: Date;
  end?: Date;
  logRef?: "muayene" | "ceza" | "hgs" | "sigorta";
  logMessage?: string;
}) {
  const { model, where = {}, dateField, start, end, logRef, logMessage } = params;
  const prismaModel = (prisma as any)[model];
  if (!prismaModel?.aggregate) {
    return 0;
  }

  const wherePayload: GenericWhere = { ...(where as GenericWhere) };
  if (dateField && start && end) {
    wherePayload[dateField] = { gte: start, lte: end };
  }

  try {
    const result = await prismaModel.aggregate({
      _sum: { tutar: true },
      where: wherePayload,
    });

    return toNumber(result?._sum?.tutar);
  } catch (error) {
    if (logRef && logMessage) {
      logOnce(logRef, logMessage, error);
    }
    return 0;
  }
}

async function safeGroupByAracTutar(params: {
  model: string;
  where?: GenericWhere;
  logRef?: "muayene" | "ceza" | "hgs" | "sigorta";
  logMessage?: string;
}) {
  const { model, where = {}, logRef, logMessage } = params;
  const prismaModel = (prisma as any)[model];
  if (!prismaModel?.groupBy) {
    return [] as Array<{ aracId: string; _sum: { tutar: number | null } }>;
  }

  try {
    return await prismaModel.groupBy({
      where: where as any,
      by: ["aracId"],
      _sum: { tutar: true },
    });
  } catch (error) {
    if (logRef && logMessage) {
      logOnce(logRef, logMessage, error);
    }
    return [] as Array<{ aracId: string; _sum: { tutar: number | null } }>;
  }
}

async function safeMuayeneAggregate(where: GenericWhere, start?: Date, end?: Date) {
  return safeSumAggregate({
    model: "muayene",
    where,
    dateField: start && end ? "muayeneTarihi" : undefined,
    start,
    end,
    logRef: "muayene",
    logMessage: "Muayene maliyet alani sorgulanamadi. Dashboard fallback (0) kullaniliyor.",
  });
}

async function safeMuayeneGroupBy(where: GenericWhere) {
  return safeGroupByAracTutar({
    model: "muayene",
    where,
    logRef: "muayene",
    logMessage: "Muayene arac bazli groupBy sorgulanamadi. Dashboard fallback (bos liste) kullaniliyor.",
  });
}

async function safeHgsAggregate(where: GenericWhere, start?: Date, end?: Date) {
  return safeSumAggregate({
    model: "hgsYukleme",
    where,
    dateField: start && end ? "tarih" : undefined,
    start,
    end,
    logRef: "hgs",
    logMessage: "HGS maliyet sorgusu okunamadi. Dashboard fallback (0) kullaniliyor.",
  });
}

async function safeHgsGroupBy(where: GenericWhere) {
  return safeGroupByAracTutar({
    model: "hgsYukleme",
    where,
    logRef: "hgs",
    logMessage: "HGS arac bazli groupBy sorgulanamadi. Dashboard fallback (bos liste) kullaniliyor.",
  });
}

function cezaDateWhere(where: GenericWhere, start: Date, end: Date, field: "tarih") {
  return {
    ...(where as GenericWhere),
    [field]: { gte: start, lte: end },
  };
}

async function safeCezaAggregate(where: GenericWhere, start?: Date, end?: Date) {
  const defaultWhere = where as GenericWhere;
  if (!start || !end) {
    try {
      const result = await prisma.ceza.aggregate({
        _sum: { tutar: true },
        where: defaultWhere as any,
      });
      return toNumber(result?._sum?.tutar);
    } catch (error) {
      logOnce("ceza", "Ceza aggregate sorgusu okunamadi. Dashboard fallback (0) kullaniliyor.", error);
      return 0;
    }
  }

  try {
    const result = await prisma.ceza.aggregate({
      _sum: { tutar: true },
      where: cezaDateWhere(defaultWhere, start, end, "tarih") as any,
    });
    return toNumber(result?._sum?.tutar);
  } catch (error) {
    logOnce("ceza", "Ceza tarih aggregate sorgusu okunamadi. Dashboard fallback (0) kullaniliyor.", error);
    return 0;
  }
}

async function safeCezaGroupBy(where: GenericWhere, start?: Date, end?: Date) {
  if (!start || !end) {
    try {
      return await prisma.ceza.groupBy({
        where: where as any,
        by: ["aracId"],
        _sum: { tutar: true },
      });
    } catch (error) {
      logOnce("ceza", "Ceza arac bazli groupBy sorgulanamadi. Dashboard fallback (bos liste) kullaniliyor.", error);
      return [] as Array<{ aracId: string; _sum: { tutar: number | null } }>;
    }
  }

  try {
    return await prisma.ceza.groupBy({
      where: cezaDateWhere(where, start, end, "tarih") as any,
      by: ["aracId"],
      _sum: { tutar: true },
    });
  } catch (error) {
    logOnce("ceza", "Ceza tarihli groupBy sorgulanamadi. Dashboard fallback (bos liste) kullaniliyor.", error);
    return [] as Array<{ aracId: string; _sum: { tutar: number | null } }>;
  }
}

async function safeSigortaAggregate(
  model: "kasko" | "trafikSigortasi",
  where: GenericWhere,
  start?: Date,
  end?: Date
) {
  return safeSumAggregate({
    model,
    where,
    dateField: start && end ? "baslangicTarihi" : undefined,
    start,
    end,
    logRef: "sigorta",
    logMessage: `${model} maliyet sorgusu okunamadi. Dashboard fallback (0) kullaniliyor.`,
  });
}

async function safeSigortaGroupBy(model: "kasko" | "trafikSigortasi", where: GenericWhere) {
  return safeGroupByAracTutar({
    model,
    where,
    logRef: "sigorta",
    logMessage: `${model} arac bazli groupBy sorgulanamadi. Dashboard fallback (bos liste) kullaniliyor.`,
  });
}

async function safeCezalarForCalendar(where: GenericWhere, start?: Date, end?: Date) {
  const dateWhere =
    start && end
      ? {
          OR: [
            { sonOdemeTarihi: { gte: start, lte: end } },
            { tarih: { gte: start, lte: end } },
          ],
        }
      : null;

  const wherePayload = {
    AND: [
      where as any,
      { odendiMi: { not: true } },
      ...(dateWhere ? [dateWhere] : []),
    ],
  };

  try {
    return await prisma.ceza.findMany({
      where: wherePayload as any,
      select: {
        id: true,
        aracId: true,
        sonOdemeTarihi: true,
        tarih: true,
        arac: {
          select: {
            plaka: true,
            marka: true,
            sirket: { select: { ad: true } },
          },
        },
      },
    } as any);
  } catch (error) {
    logOnce("ceza", "Ceza takvim sorgusu okunamadi. Dashboard ceza fallback (bos liste) kullaniliyor.", error);
  }

  return [] as any[];
}

async function safeYakitRecordsForDriverCost(where: GenericWhere) {
  try {
    return await prisma.yakit.findMany({
      where: where as any,
      select: { aracId: true, tarih: true, tutar: true, soforId: true },
    } as any);
  } catch (error) {
    logOnce("yakit", "Yakit sofor alanı okunamadi. Eski şema fallback devrede.", error);
  }

  try {
    const legacyRows = await prisma.yakit.findMany({
      where: where as any,
      select: { aracId: true, tarih: true, tutar: true },
    } as any);
    return legacyRows.map((row: any) => ({
      ...row,
      soforId: null,
    }));
  } catch (error) {
    logOnce("yakit", "Yakit fallback sorgusu da okunamadi. Bos liste kullaniliyor.", error);
    return [] as Array<{ aracId: string; tarih: Date; tutar: number; soforId: string | null }>;
  }
}

async function safeArizaRecordsForDriverCost(where: GenericWhere) {
  try {
    return await prisma.bakim.findMany({
      where: {
        ...(where as any),
        tur: "ARIZA",
      },
      select: { aracId: true, bakimTarihi: true, tutar: true },
    });
  } catch (error) {
    logOnce("ariza", "Ariza maliyetleri Bakim tablosundan okunamadi. Eski şema fallback devrede.", error);
  }

  const legacyArizaModel = (prisma as any).ariza;
  if (!legacyArizaModel?.findMany) {
    return [] as Array<{ aracId: string; bakimTarihi: Date; tutar: number }>;
  }

  try {
    const legacyRows = await legacyArizaModel.findMany({
      where: where as any,
      select: { aracId: true, arizaTarihi: true, tahminiTutar: true },
    });
    return legacyRows.map((row: any) => ({
      aracId: row.aracId,
      bakimTarihi: row.arizaTarihi,
      tutar: toNumber(row.tahminiTutar),
    }));
  } catch (error) {
    logOnce("ariza", "Ariza legacy fallback sorgusu da okunamadi. Bos liste kullaniliyor.", error);
    return [] as Array<{ aracId: string; bakimTarihi: Date; tutar: number }>;
  }
}

export type DashboardEventType = "TRAFIK" | "KASKO" | "MUAYENE" | "CEZA";
export type DashboardEventStatus = "GECIKTI" | "KRITIK" | "YAKLASTI" | "PLANLI";

export interface DashboardCalendarEvent {
  id: string;
  aracId: string;
  plaka: string;
  aracMarka: string;
  sirketAd?: string | null;
  type: DashboardEventType;
  status: DashboardEventStatus;
  title: string;
  date: string;
  daysLeft: number;
  href: string;
}

export interface DashboardMonthlyTrendItem {
  name: string;
  yakit: number;
  bakim: number;
  muayene: number;
  hgs: number;
  ceza: number;
  kasko: number;
  trafik: number;
  diger: number;
  toplam: number;
}

export interface DashboardVehicleCostItem {
  aracId: string;
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
}

export interface DashboardDriverCostItem {
  soforId: string | null;
  adSoyad: string;
  toplam: number;
  ceza: number;
  yakit: number;
  ariza: number;
}

export interface DashboardData {
  metrics: {
    aylikToplamGider: number;
    ortalamaAracMaliyeti: number;
    ortalamaSoforMaliyeti: number;
    kritikUyariSayisi: number;
    verimlilikOrani: number;
    ortalamaYakit: number;
    aracMaliyetOrtalamaAdet: number;
    soforMaliyetOrtalamaAdet: number;
    aktifArac: number;
    toplamArac: number;
    servisteArac: number;
    comparisonLabel: string;
    giderDegisimYuzdesi: number;
    aracMaliyetDegisimYuzdesi: number;
    soforMaliyetDegisimYuzdesi: number;
    yakitDegisimYuzdesi: number;
  };
  durumData: { name: string; value: number }[];
  alerts: { id: string; aracId: string; plaka: string; message: string; tarih: string }[];
  sixMonthsTrend: { name: string; gider: number }[];
  top5Expenses: { plaka: string; tutar: number }[];
  calendarEvents: DashboardCalendarEvent[];
  monthlyExpenseTrend: DashboardMonthlyTrendItem[];
  vehicleCostReport: DashboardVehicleCostItem[];
  driverCostReport: DashboardDriverCostItem[];
}

function getEmptyDashboardData(): DashboardData {
  return {
    metrics: {
      aylikToplamGider: 0,
      ortalamaAracMaliyeti: 0,
      ortalamaSoforMaliyeti: 0,
      kritikUyariSayisi: 0,
      verimlilikOrani: 0,
      ortalamaYakit: 0,
      aracMaliyetOrtalamaAdet: 0,
      soforMaliyetOrtalamaAdet: 0,
      aktifArac: 0,
      toplamArac: 0,
      servisteArac: 0,
      comparisonLabel: "geçen aya göre",
      giderDegisimYuzdesi: 0,
      aracMaliyetDegisimYuzdesi: 0,
      soforMaliyetDegisimYuzdesi: 0,
      yakitDegisimYuzdesi: 0,
    },
    durumData: [],
    alerts: [],
    sixMonthsTrend: [],
    top5Expenses: [],
    calendarEvents: [],
    monthlyExpenseTrend: [],
    vehicleCostReport: [],
    driverCostReport: [],
  };
}

type VehicleCostAccumulator = {
  plaka: string;
  markaModel: string;
  total: number;
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
  map: Record<string, VehicleCostAccumulator>,
  aracId: string,
  category: keyof Pick<VehicleCostAccumulator, "yakit" | "bakim" | "muayene" | "hgs" | "ceza" | "kasko" | "trafik" | "diger">,
  value: number
) {
  if (!aracId || value <= 0 || !map[aracId]) return;
  map[aracId][category] += value;
  map[aracId].total += value;
}

function isWithinSelectedRange(date: Date | null | undefined, rangeStart: Date, rangeEnd: Date) {
  if (!date) return false;
  const time = new Date(date).getTime();
  return time >= rangeStart.getTime() && time <= rangeEnd.getTime();
}

type EvrakLatestRecord = {
  id: string;
  aracId: string;
  gecerlilikTarihi: Date;
};

function buildLatestMap<T extends EvrakLatestRecord>(records: T[]) {
  const map = new Map<string, T>();
  for (const item of records) {
    if (!item?.aracId) continue;
    if (!map.has(item.aracId)) {
      map.set(item.aracId, item);
    }
  }
  return map;
}

type DriverCostAccumulator = {
  soforId: string;
  adSoyad: string;
  ceza: number;
  yakit: number;
  ariza: number;
  toplam: number;
};

function getOrCreateDriverCost(
  map: Record<string, DriverCostAccumulator>,
  soforId: string,
  adSoyadMap: Record<string, string>
) {
  const key = soforId;
  if (!map[key]) {
    map[key] = {
      soforId,
      adSoyad: adSoyadMap[soforId] || "Bilinmeyen Şoför",
      ceza: 0,
      yakit: 0,
      ariza: 0,
      toplam: 0,
    };
  }
  return map[key];
}

function findDriverAtDate(
  zimmetByAracId: Record<string, Array<{ kullaniciId: string; baslangic: number; bitis: number | null }>>,
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

export type DashboardComparisonGranularity = "AY" | "YIL";

function getDegisimYuzdesi(currentValue: number, previousValue: number) {
  const current = toNumber(currentValue);
  const previous = toNumber(previousValue);

  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }

  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

async function getDashboardDataUnsafe(
  sirketFilter: GenericWhere | null,
  selectedYil = new Date().getFullYear(),
  selectedAy = new Date().getMonth() + 1,
  comparisonGranularity: DashboardComparisonGranularity = "AY"
): Promise<DashboardData> {
  const scope = sirketFilter || {};
  const cezaScope = getCezaScopeWhere(scope);
  const now = new Date();
  const currentYear = now.getFullYear();
  const normalizedYear =
    Number.isInteger(selectedYil) && selectedYil >= 2000 && selectedYil <= 2100 ? selectedYil : currentYear;
  const normalizedMonth =
    Number.isInteger(selectedAy) && selectedAy >= 1 && selectedAy <= 12
      ? selectedAy
      : now.getMonth() + 1;
  const referenceDate = new Date(normalizedYear, normalizedMonth - 1, 1);
  const previousReferenceDate =
    comparisonGranularity === "AY"
      ? new Date(normalizedYear, normalizedMonth - 2, 1)
      : new Date(normalizedYear - 1, normalizedMonth - 1, 1);
  const bugun = startOfDay(now);
  const seciliAyBasi = startOfMonth(referenceDate);
  const seciliAySonu = endOfMonth(referenceDate);
  const oncekiDonemBasi = startOfMonth(previousReferenceDate);
  const oncekiDonemSonu = endOfMonth(previousReferenceDate);

  const masrafWhere = { ...(scope as GenericWhere), tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] } };

  const [toplamArac, aktifArac, servisteArac] = await Promise.all([
    prisma.arac.count({ where: scope }),
    prisma.arac.count({ where: { ...(scope as any), durum: "AKTIF" } }),
    prisma.arac.count({ where: { ...(scope as any), durum: "SERVISTE" } }),
  ]);

  const [
    aylikYakit,
    aylikBakim,
    aylikMuayene,
    aylikHgs,
    aylikCeza,
    aylikKasko,
    aylikTrafik,
    aylikDigerMasraf,
    oncekiYakit,
    oncekiBakim,
    oncekiMuayene,
    oncekiHgs,
    oncekiCeza,
    oncekiKasko,
    oncekiTrafik,
    oncekiDigerMasraf,
  ] =
    await Promise.all([
      safeSumAggregate({ model: "yakit", where: scope, dateField: "tarih", start: seciliAyBasi, end: seciliAySonu }),
      safeSumAggregate({ model: "bakim", where: scope, dateField: "bakimTarihi", start: seciliAyBasi, end: seciliAySonu }),
      safeMuayeneAggregate(scope, seciliAyBasi, seciliAySonu),
      safeHgsAggregate(scope, seciliAyBasi, seciliAySonu),
      safeCezaAggregate(cezaScope, seciliAyBasi, seciliAySonu),
      safeSigortaAggregate("kasko", scope, seciliAyBasi, seciliAySonu),
      safeSigortaAggregate("trafikSigortasi", scope, seciliAyBasi, seciliAySonu),
      safeSumAggregate({ model: "masraf", where: masrafWhere, dateField: "tarih", start: seciliAyBasi, end: seciliAySonu }),
      safeSumAggregate({ model: "yakit", where: scope, dateField: "tarih", start: oncekiDonemBasi, end: oncekiDonemSonu }),
      safeSumAggregate({ model: "bakim", where: scope, dateField: "bakimTarihi", start: oncekiDonemBasi, end: oncekiDonemSonu }),
      safeMuayeneAggregate(scope, oncekiDonemBasi, oncekiDonemSonu),
      safeHgsAggregate(scope, oncekiDonemBasi, oncekiDonemSonu),
      safeCezaAggregate(cezaScope, oncekiDonemBasi, oncekiDonemSonu),
      safeSigortaAggregate("kasko", scope, oncekiDonemBasi, oncekiDonemSonu),
      safeSigortaAggregate("trafikSigortasi", scope, oncekiDonemBasi, oncekiDonemSonu),
      safeSumAggregate({ model: "masraf", where: masrafWhere, dateField: "tarih", start: oncekiDonemBasi, end: oncekiDonemSonu }),
    ]);

  const aylikToplamGider =
    aylikYakit + aylikBakim + aylikMuayene + aylikHgs + aylikCeza + aylikKasko + aylikTrafik + aylikDigerMasraf;
  const oncekiDonemToplamGider =
    oncekiYakit + oncekiBakim + oncekiMuayene + oncekiHgs + oncekiCeza + oncekiKasko + oncekiTrafik + oncekiDigerMasraf;
  const ortalamaYakit = aktifArac > 0 ? Math.round(aylikYakit / aktifArac) : 0;
  const oncekiOrtalamaYakit = aktifArac > 0 ? Math.round(oncekiYakit / aktifArac) : 0;

  const [durumDagitimi, aracEvraklari, odenmemisCezalar] = await Promise.all([
    prisma.arac.groupBy({ where: scope, by: ["durum"], _count: { durum: true } }),
    prisma.arac.findMany({
      where: scope,
      select: {
        id: true,
        plaka: true,
        marka: true,
        sirket: { select: { ad: true } },
      },
    }),
    safeCezalarForCalendar(cezaScope, seciliAyBasi, seciliAySonu),
  ]);

  const durumData = durumDagitimi.map((d: any) => ({ name: d.durum, value: d._count.durum }));
  const aracIds = (aracEvraklari as any[]).map((a: any) => a.id).filter(Boolean);

  const [muayeneKayitlari, kaskoKayitlari, trafikKayitlari] = aracIds.length > 0
    ? await Promise.all([
      (prisma as any).muayene.findMany({
        where: { ...(scope as any), aracId: { in: aracIds } },
        orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { muayeneTarihi: "desc" }, { gecerlilikTarihi: "desc" }],
        select: { id: true, aracId: true, gecerlilikTarihi: true },
      }).catch(() => []),
      (prisma as any).kasko.findMany({
        where: { ...(scope as any), aracId: { in: aracIds } },
        orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { baslangicTarihi: "desc" }, { bitisTarihi: "desc" }],
        select: { id: true, aracId: true, bitisTarihi: true },
      }).catch(() => []),
      (prisma as any).trafikSigortasi.findMany({
        where: { ...(scope as any), aracId: { in: aracIds } },
        orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { baslangicTarihi: "desc" }, { bitisTarihi: "desc" }],
        select: { id: true, aracId: true, bitisTarihi: true },
      }).catch(() => []),
    ])
    : [[], [], []];

  const latestMuayene = buildLatestMap(
    (muayeneKayitlari as any[])
      .filter((item: any) => item?.gecerlilikTarihi)
      .map((item: any) => ({
        id: item.id,
        aracId: item.aracId,
        gecerlilikTarihi: new Date(item.gecerlilikTarihi),
      }))
  );

  const latestKasko = buildLatestMap(
    (kaskoKayitlari as any[])
      .filter((item: any) => item?.bitisTarihi)
      .map((item: any) => ({
        id: item.id,
        aracId: item.aracId,
        gecerlilikTarihi: new Date(item.bitisTarihi),
      }))
  );

  const latestTrafik = buildLatestMap(
    (trafikKayitlari as any[])
      .filter((item: any) => item?.bitisTarihi)
      .map((item: any) => ({
        id: item.id,
        aracId: item.aracId,
        gecerlilikTarihi: new Date(item.bitisTarihi),
      }))
  );

  const tumKritikUyarilar = (aracEvraklari as any[]).flatMap((arac) => {
    const aracUyarilari: DashboardData["alerts"] = [];
    const sonMuayene = latestMuayene.get(arac.id);
    const sonKasko = latestKasko.get(arac.id);
    const sonTrafikSigortasi = latestTrafik.get(arac.id);

    if (sonMuayene && isWithinSelectedRange(sonMuayene.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
      const kalanGun = differenceInCalendarDays(sonMuayene.gecerlilikTarihi, bugun);
      if (kalanGun <= 15) {
        aracUyarilari.push({
          id: `m-${sonMuayene.id}`,
          aracId: arac.id,
          plaka: arac.plaka,
          message: kalanGun < 0 ? "Muayene Gecikti" : "Muayene Yaklaştı",
          tarih: sonMuayene.gecerlilikTarihi.toISOString(),
        });
      }
    }

    if (sonKasko && isWithinSelectedRange(sonKasko.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
      const kalanGun = differenceInCalendarDays(sonKasko.gecerlilikTarihi, bugun);
      if (kalanGun <= 15) {
        aracUyarilari.push({
          id: `k-${sonKasko.id}`,
          aracId: arac.id,
          plaka: arac.plaka,
          message: kalanGun < 0 ? "Kasko Gecikti" : "Kasko Bitiyor",
          tarih: sonKasko.gecerlilikTarihi.toISOString(),
        });
      }
    }

    if (sonTrafikSigortasi && isWithinSelectedRange(sonTrafikSigortasi.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
      const kalanGun = differenceInCalendarDays(sonTrafikSigortasi.gecerlilikTarihi, bugun);
      if (kalanGun <= 15) {
        aracUyarilari.push({
          id: `ts-${sonTrafikSigortasi.id}`,
          aracId: arac.id,
          plaka: arac.plaka,
          message: kalanGun < 0 ? "Trafik Poliçesi Gecikti" : "Trafik Poliçesi Bitiyor",
          tarih: sonTrafikSigortasi.gecerlilikTarihi.toISOString(),
        });
      }
    }

    return aracUyarilari;
  });

  const alerts = tumKritikUyarilar
    .sort((a: any, b: any) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime())
    .slice(0, 4);
  const kritikUyariSayisi = tumKritikUyarilar.length;
  const verimlilikOrani = toplamArac > 0 ? Math.round((aktifArac / toplamArac) * 100) : 0;

  const endMonthIndex = normalizedMonth - 1;
  const startMonthIndex = Math.max(0, endMonthIndex - 5);
  const son6AyPeriod = Array.from({ length: endMonthIndex - startMonthIndex + 1 }, (_, idx) => {
    const month = startMonthIndex + idx;
    const d = new Date(normalizedYear, month, 1);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const ayIsmi = format(start, "MMM", { locale: tr });
    return { start, end, name: ayIsmi.charAt(0).toUpperCase() + ayIsmi.slice(1) };
  });

  const monthlyExpenseTrend: DashboardMonthlyTrendItem[] = await Promise.all(
    son6AyPeriod.map(async ({ start, end, name }) => {
      const [yakit, bakim, muayene, hgs, ceza, kasko, trafik, diger] = await Promise.all([
        safeSumAggregate({ model: "yakit", where: scope, dateField: "tarih", start, end }),
        safeSumAggregate({ model: "bakim", where: scope, dateField: "bakimTarihi", start, end }),
        safeMuayeneAggregate(scope, start, end),
        safeHgsAggregate(scope, start, end),
        safeCezaAggregate(cezaScope, start, end),
        safeSigortaAggregate("kasko", scope, start, end),
        safeSigortaAggregate("trafikSigortasi", scope, start, end),
        safeSumAggregate({ model: "masraf", where: masrafWhere, dateField: "tarih", start, end }),
      ]);

      return {
        name,
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
    })
  );

  const sixMonthsTrend = monthlyExpenseTrend.map((item) => ({ name: item.name, gider: item.toplam }));

  const [
    araclarForCost,
    yakitByArac,
    bakimByArac,
    muayeneByArac,
    hgsByArac,
    cezaByArac,
    kaskoByArac,
    trafikByArac,
    masrafByArac,
    oncekiYakitByArac,
    oncekiBakimByArac,
    oncekiMuayeneByArac,
    oncekiHgsByArac,
    oncekiCezaByArac,
    oncekiKaskoByArac,
    oncekiTrafikByArac,
    oncekiMasrafByArac,
  ] =
    await Promise.all([
      prisma.arac.findMany({
        where: scope,
        select: { id: true, plaka: true, marka: true, model: true },
      }),
      safeGroupByAracTutar({ model: "yakit", where: { ...(scope as any), tarih: { gte: seciliAyBasi, lte: seciliAySonu } } }),
      safeGroupByAracTutar({ model: "bakim", where: { ...(scope as any), bakimTarihi: { gte: seciliAyBasi, lte: seciliAySonu } } }),
      safeMuayeneGroupBy({ ...(scope as any), muayeneTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
      safeHgsGroupBy({ ...(scope as any), tarih: { gte: seciliAyBasi, lte: seciliAySonu } }),
      safeCezaGroupBy(cezaScope, seciliAyBasi, seciliAySonu),
      safeSigortaGroupBy("kasko", { ...(scope as any), baslangicTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
      safeSigortaGroupBy("trafikSigortasi", { ...(scope as any), baslangicTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
      safeGroupByAracTutar({ model: "masraf", where: { ...(masrafWhere as any), tarih: { gte: seciliAyBasi, lte: seciliAySonu } } }),
      safeGroupByAracTutar({ model: "yakit", where: { ...(scope as any), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } } }),
      safeGroupByAracTutar({ model: "bakim", where: { ...(scope as any), bakimTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } } }),
      safeMuayeneGroupBy({ ...(scope as any), muayeneTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
      safeHgsGroupBy({ ...(scope as any), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
      safeCezaGroupBy(cezaScope, oncekiDonemBasi, oncekiDonemSonu),
      safeSigortaGroupBy("kasko", { ...(scope as any), baslangicTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
      safeSigortaGroupBy("trafikSigortasi", { ...(scope as any), baslangicTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
      safeGroupByAracTutar({ model: "masraf", where: { ...(masrafWhere as any), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } } }),
    ]);

  const aracCostMap: Record<string, VehicleCostAccumulator> = {};
  for (const arac of araclarForCost) {
    aracCostMap[arac.id] = {
      plaka: arac.plaka,
      markaModel: `${arac.marka} ${arac.model}`.trim(),
      total: 0,
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

  yakitByArac.forEach((r: any) => addVehicleCost(aracCostMap, r.aracId, "yakit", toNumber(r?._sum?.tutar)));
  bakimByArac.forEach((r: any) => addVehicleCost(aracCostMap, r.aracId, "bakim", toNumber(r?._sum?.tutar)));
  muayeneByArac.forEach((r: any) => addVehicleCost(aracCostMap, r.aracId, "muayene", toNumber(r?._sum?.tutar)));
  hgsByArac.forEach((r: any) => addVehicleCost(aracCostMap, r.aracId, "hgs", toNumber(r?._sum?.tutar)));
  cezaByArac.forEach((r: any) => addVehicleCost(aracCostMap, r.aracId, "ceza", toNumber(r?._sum?.tutar)));
  kaskoByArac.forEach((r: any) => addVehicleCost(aracCostMap, r.aracId, "kasko", toNumber(r?._sum?.tutar)));
  trafikByArac.forEach((r: any) => addVehicleCost(aracCostMap, r.aracId, "trafik", toNumber(r?._sum?.tutar)));
  masrafByArac.forEach((r: any) => addVehicleCost(aracCostMap, r.aracId, "diger", toNumber(r?._sum?.tutar)));

  const tumAracMaliyetleri = Object.entries(aracCostMap)
    .map(([aracId, row]) => ({
      aracId,
      plaka: row.plaka,
      markaModel: row.markaModel,
      toplam: row.total,
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

  const ortalamaAracMaliyeti = tumAracMaliyetleri.length
    ? Math.round(tumAracMaliyetleri.reduce((sum, row) => sum + row.toplam, 0) / tumAracMaliyetleri.length)
    : 0;
  const aracMaliyetOrtalamaAdet = tumAracMaliyetleri.length;
  const vehicleCostReport = tumAracMaliyetleri.slice(0, 10);

  const top5Expenses = vehicleCostReport.slice(0, 5).map((row) => ({
    plaka: row.plaka,
    tutar: row.toplam,
  }));

  const oncekiAracToplamMap: Record<string, number> = {};
  const addOncekiAracMaliyet = (rows: Array<{ aracId: string; _sum?: { tutar?: number | null } }>) => {
    rows.forEach((row) => {
      if (!row?.aracId) return;
      const value = toNumber(row?._sum?.tutar);
      if (value <= 0) return;
      oncekiAracToplamMap[row.aracId] = (oncekiAracToplamMap[row.aracId] || 0) + value;
    });
  };

  addOncekiAracMaliyet(oncekiYakitByArac as any[]);
  addOncekiAracMaliyet(oncekiBakimByArac as any[]);
  addOncekiAracMaliyet(oncekiMuayeneByArac as any[]);
  addOncekiAracMaliyet(oncekiHgsByArac as any[]);
  addOncekiAracMaliyet(oncekiCezaByArac as any[]);
  addOncekiAracMaliyet(oncekiKaskoByArac as any[]);
  addOncekiAracMaliyet(oncekiTrafikByArac as any[]);
  addOncekiAracMaliyet(oncekiMasrafByArac as any[]);

  const oncekiAracToplamlari = Object.values(oncekiAracToplamMap).filter((value) => value > 0);
  const oncekiOrtalamaAracMaliyeti = oncekiAracToplamlari.length
    ? Math.round(oncekiAracToplamlari.reduce((sum, value) => sum + value, 0) / oncekiAracToplamlari.length)
    : 0;

  const [
    kullanicilar,
    tumZimmetler,
    yakitKayitlari,
    arizaKayitlari,
    cezaKayitlari,
    oncekiYakitKayitlari,
    oncekiArizaKayitlari,
    oncekiCezaKayitlari,
  ] = await Promise.all([
    prisma.kullanici.findMany({
      where: scope,
      select: { id: true, ad: true, soyad: true },
    }),
    prisma.kullaniciZimmet.findMany({
      where: { arac: scope as any },
      select: { aracId: true, kullaniciId: true, baslangic: true, bitis: true },
    }),
    safeYakitRecordsForDriverCost({ ...(scope as any), tarih: { gte: seciliAyBasi, lte: seciliAySonu } }),
    safeArizaRecordsForDriverCost({ ...(scope as any), bakimTarihi: { gte: seciliAyBasi, lte: seciliAySonu } }),
    prisma.ceza.findMany({
      where: { ...(cezaScope as any), tarih: { gte: seciliAyBasi, lte: seciliAySonu } } as any,
      select: { soforId: true, tutar: true },
    }),
    safeYakitRecordsForDriverCost({ ...(scope as any), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
    safeArizaRecordsForDriverCost({ ...(scope as any), bakimTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } }),
    prisma.ceza.findMany({
      where: { ...(cezaScope as any), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } } as any,
      select: { soforId: true, tutar: true },
    }),
  ]);

  const adSoyadMap: Record<string, string> = {};
  for (const k of kullanicilar as Array<{ id: string; ad: string; soyad: string }>) {
    adSoyadMap[k.id] = `${k.ad} ${k.soyad}`.trim();
  }

  const zimmetByAracId: Record<
    string,
    Array<{ kullaniciId: string; baslangic: number; bitis: number | null }>
  > = {};
  for (const z of tumZimmetler as Array<{ aracId: string; kullaniciId: string; baslangic: Date; bitis: Date | null }>) {
    if (!zimmetByAracId[z.aracId]) {
      zimmetByAracId[z.aracId] = [];
    }
    zimmetByAracId[z.aracId].push({
      kullaniciId: z.kullaniciId,
      baslangic: z.baslangic.getTime(),
      bitis: z.bitis ? z.bitis.getTime() : null,
    });
  }

  Object.values(zimmetByAracId).forEach((list) => {
    list.sort((a, b) => a.baslangic - b.baslangic);
  });

  const buildDriverCostRows = (params: {
    cezaRows: Array<{ soforId: string | null; tutar: number }>;
    yakitRows: Array<{ aracId: string; tarih: Date; tutar: number; soforId: string | null }>;
    arizaRows: Array<{ aracId: string; bakimTarihi: Date; tutar: number }>;
  }) => {
    const driverCostMap: Record<string, DriverCostAccumulator> = {};

    for (const ceza of params.cezaRows) {
      if (!ceza.soforId) continue;
      const row = getOrCreateDriverCost(driverCostMap, ceza.soforId, adSoyadMap);
      row.ceza += toNumber(ceza.tutar);
      row.toplam += toNumber(ceza.tutar);
    }

    for (const yakit of params.yakitRows) {
      const soforId = yakit.soforId || findDriverAtDate(zimmetByAracId, yakit.aracId, yakit.tarih);
      if (!soforId) continue;
      const row = getOrCreateDriverCost(driverCostMap, soforId, adSoyadMap);
      row.yakit += toNumber(yakit.tutar);
      row.toplam += toNumber(yakit.tutar);
    }

    for (const ariza of params.arizaRows) {
      const soforId = findDriverAtDate(zimmetByAracId, ariza.aracId, ariza.bakimTarihi);
      if (!soforId) continue;
      const row = getOrCreateDriverCost(driverCostMap, soforId, adSoyadMap);
      row.ariza += toNumber(ariza.tutar);
      row.toplam += toNumber(ariza.tutar);
    }

    return Object.values(driverCostMap)
      .filter((row) => row.toplam > 0)
      .sort((a, b) => b.toplam - a.toplam);
  };

  const tumSoforMaliyetleri = buildDriverCostRows({
    cezaRows: cezaKayitlari as Array<{ soforId: string | null; tutar: number }>,
    yakitRows: yakitKayitlari as Array<{ aracId: string; tarih: Date; tutar: number; soforId: string | null }>,
    arizaRows: arizaKayitlari as Array<{ aracId: string; bakimTarihi: Date; tutar: number }>,
  });
  const oncekiSoforMaliyetleri = buildDriverCostRows({
    cezaRows: oncekiCezaKayitlari as Array<{ soforId: string | null; tutar: number }>,
    yakitRows: oncekiYakitKayitlari as Array<{ aracId: string; tarih: Date; tutar: number; soforId: string | null }>,
    arizaRows: oncekiArizaKayitlari as Array<{ aracId: string; bakimTarihi: Date; tutar: number }>,
  });

  const ortalamaSoforMaliyeti = tumSoforMaliyetleri.length
    ? Math.round(tumSoforMaliyetleri.reduce((sum, row) => sum + row.toplam, 0) / tumSoforMaliyetleri.length)
    : 0;
  const soforMaliyetOrtalamaAdet = tumSoforMaliyetleri.length;
  const oncekiOrtalamaSoforMaliyeti = oncekiSoforMaliyetleri.length
    ? Math.round(oncekiSoforMaliyetleri.reduce((sum, row) => sum + row.toplam, 0) / oncekiSoforMaliyetleri.length)
    : 0;

  const driverCostReport: DashboardDriverCostItem[] = tumSoforMaliyetleri
    .filter((row) => row.toplam > 0)
    .slice(0, 10);

  const calendarEvents: DashboardCalendarEvent[] = [];
  const getEventStatus = (daysLeft: number): DashboardEventStatus => {
    if (daysLeft < 0) return "GECIKTI";
    if (daysLeft <= 15) return "KRITIK";
    if (daysLeft <= 30) return "YAKLASTI";
    return "PLANLI";
  };

  for (const arac of aracEvraklari as any[]) {
    const base = {
      aracId: arac.id as string,
      plaka: (arac.plaka || "-") as string,
      aracMarka: (arac.marka || "") as string,
      sirketAd: arac.sirket?.ad || null,
    };

    const sonMuayene = latestMuayene.get(arac.id);
    if (sonMuayene?.gecerlilikTarihi && isWithinSelectedRange(sonMuayene.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
      const daysLeft = differenceInCalendarDays(sonMuayene.gecerlilikTarihi, bugun);
      calendarEvents.push({
        ...base,
        id: `m-${sonMuayene.id}`,
        type: "MUAYENE",
        status: getEventStatus(daysLeft),
        title: "Muayene Son Geçerlilik",
        date: formatDateKey(sonMuayene.gecerlilikTarihi),
        daysLeft,
        href: "/dashboard/muayeneler",
      });
    }

    const sonKasko = latestKasko.get(arac.id);
    if (sonKasko?.gecerlilikTarihi && isWithinSelectedRange(sonKasko.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
      const daysLeft = differenceInCalendarDays(sonKasko.gecerlilikTarihi, bugun);
      calendarEvents.push({
        ...base,
        id: `k-${sonKasko.id}`,
        type: "KASKO",
        status: getEventStatus(daysLeft),
        title: "Kasko Bitiş",
        date: formatDateKey(sonKasko.gecerlilikTarihi),
        daysLeft,
        href: `/dashboard/kasko?yenileAracId=${arac.id}`,
      });
    }

    const sonTrafikSigortasi = latestTrafik.get(arac.id);
    if (sonTrafikSigortasi?.gecerlilikTarihi && isWithinSelectedRange(sonTrafikSigortasi.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
      const daysLeft = differenceInCalendarDays(sonTrafikSigortasi.gecerlilikTarihi, bugun);
      calendarEvents.push({
        ...base,
        id: `ts-${sonTrafikSigortasi.id}`,
        type: "TRAFIK",
        status: getEventStatus(daysLeft),
        title: "Trafik Sigortası Bitiş",
        date: formatDateKey(sonTrafikSigortasi.gecerlilikTarihi),
        daysLeft,
        href: `/dashboard/trafik-sigortasi?yenileAracId=${arac.id}`,
      });
    }
  }

  for (const ceza of odenmemisCezalar as any[]) {
    const dueDateRaw = ceza.sonOdemeTarihi ?? ceza.tarih ?? null;
    if (!dueDateRaw) continue;

    const dueDate = new Date(dueDateRaw);
    if (Number.isNaN(dueDate.getTime())) continue;

    const plaka = ceza.arac?.plaka || ceza.plaka || "-";
    const marka = ceza.arac?.marka || "";
    const sirketAd = ceza.arac?.sirket?.ad || null;
    const daysLeft = differenceInCalendarDays(dueDate, bugun);

    calendarEvents.push({
      id: `c-${ceza.id}`,
      aracId: ceza.aracId || "",
      plaka,
      aracMarka: marka,
      sirketAd,
      type: "CEZA",
      status: getEventStatus(daysLeft),
      title: "Ceza Son Ödeme (Ödenmedi)",
      date: formatDateKey(dueDate),
      daysLeft,
      href: "/dashboard/ceza-masraflari",
    });
  }

  calendarEvents.sort((a, b) => a.date.localeCompare(b.date));
  const comparisonLabel = comparisonGranularity === "AY" ? "geçen aya göre" : "geçen yıla göre";
  const giderDegisimYuzdesi = getDegisimYuzdesi(aylikToplamGider, oncekiDonemToplamGider);
  const aracMaliyetDegisimYuzdesi = getDegisimYuzdesi(ortalamaAracMaliyeti, oncekiOrtalamaAracMaliyeti);
  const soforMaliyetDegisimYuzdesi = getDegisimYuzdesi(ortalamaSoforMaliyeti, oncekiOrtalamaSoforMaliyeti);
  const yakitDegisimYuzdesi = getDegisimYuzdesi(ortalamaYakit, oncekiOrtalamaYakit);

  return {
    metrics: {
      aylikToplamGider,
      ortalamaAracMaliyeti,
      ortalamaSoforMaliyeti,
      kritikUyariSayisi,
      verimlilikOrani,
      ortalamaYakit,
      aracMaliyetOrtalamaAdet,
      soforMaliyetOrtalamaAdet,
      aktifArac,
      toplamArac,
      servisteArac,
      comparisonLabel,
      giderDegisimYuzdesi,
      aracMaliyetDegisimYuzdesi,
      soforMaliyetDegisimYuzdesi,
      yakitDegisimYuzdesi,
    },
    durumData,
    alerts,
    sixMonthsTrend,
    top5Expenses,
    calendarEvents,
    monthlyExpenseTrend,
    vehicleCostReport,
    driverCostReport,
  };
}

export async function getDashboardData(
  sirketFilter: GenericWhere | null,
  selectedYil = new Date().getFullYear(),
  selectedAy = new Date().getMonth() + 1,
  comparisonGranularity: DashboardComparisonGranularity = "AY"
): Promise<DashboardData> {
  try {
    return await getDashboardDataUnsafe(sirketFilter, selectedYil, selectedAy, comparisonGranularity);
  } catch (error) {
    console.warn("Dashboard verileri alinamadi. Bos veri ile devam ediliyor.", error);
    return getEmptyDashboardData();
  }
}
