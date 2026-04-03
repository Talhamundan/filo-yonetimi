import { prisma } from "@/lib/prisma";
import AraclarClient from "./AraclarClient";
import { getAracUsageFilter, getCurrentUserRole, getPersonnelSelectFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters } from "@/lib/list-filters";
import { buildTokenizedOrWhere } from "@/lib/search-query";
import { sortByTextValue } from "@/lib/sort-utils";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";

const EXCLUDED_MASRAF_TURLERI = ["YAKIT"] as const;
const ARAC_FALLBACK_SELECT = {
    id: true,
    plaka: true,
    marka: true,
    model: true,
    yil: true,
    bulunduguIl: true,
    guncelKm: true,
    bedel: true,
    ruhsatSeriNo: true,
    durum: true,
    kullaniciId: true,
    sirketId: true,
    calistigiKurum: true,
    kategori: true,
    saseNo: true,
    olusturmaTarihi: true,
    guncellemeTarihi: true,
    deletedAt: true,
    deletedBy: true,
} as const;

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeCompanyName(value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    return text.toLocaleLowerCase("tr-TR");
}

function toSumMap(rows: Array<{ aracId: string; _sum?: { tutar?: number | null } }>) {
    const map = new Map<string, number>();
    for (const row of rows) {
        if (!row?.aracId) continue;
        map.set(row.aracId, toNumber(row?._sum?.tutar));
    }
    return map;
}

function toLitreMap(rows: Array<{ aracId: string; _sum?: { litre?: number | null } }>) {
    const map = new Map<string, number>();
    for (const row of rows) {
        if (!row?.aracId) continue;
        map.set(row.aracId, toNumber(row?._sum?.litre));
    }
    return map;
}

async function getAraclarWithTakipBilgileri(
    filter: Record<string, unknown>,
    rangeStart: Date,
    rangeEnd: Date,
    safeScopeFilter?: Record<string, unknown>
) {
    const araclar = await (prisma as any).arac.findMany({
        where: filter as any,
        orderBy: { plaka: "asc" },
        include: {
            kullanici: {
                include: {
                    sirket: {
                        select: { id: true, ad: true },
                    },
                },
            },
            sirket: true,
        },
    }).catch(async (error: any) => {
        console.warn("Arac listesi sorgusu basarisiz, minimal sorgu ile devam ediliyor.", error);
        const safeWhere = safeScopeFilter || filter;
        return (prisma as any).arac.findMany({
            where: safeWhere as any,
            orderBy: { plaka: "asc" },
            select: ARAC_FALLBACK_SELECT,
        }).then((rows: any[]) => rows.map((row) => ({
            ...row,
            bedel: row.bedel ?? null,
            aciklama: null,
            calistigiKurum: row.calistigiKurum ?? null,
            kullanici: null,
            sirket: null,
        }))).catch(async (fallbackError: any) => {
            console.warn("Arac listesi fallback sorgusu da basarisiz, daha dar sorgu deneniyor.", fallbackError);
            return (prisma as any).arac.findMany({
                where: safeWhere as any,
                orderBy: { plaka: "asc" },
                select: {
                    id: true,
                    plaka: true,
                    marka: true,
                    model: true,
                    yil: true,
                    bulunduguIl: true,
                    guncelKm: true,
                    ruhsatSeriNo: true,
                    durum: true,
                    kullaniciId: true,
                    sirketId: true,
                    calistigiKurum: true,
                    kategori: true,
                    olusturmaTarihi: true,
                    guncellemeTarihi: true,
                    deletedAt: true,
                    deletedBy: true,
                },
            }).then((rows: any[]) => rows.map((row) => ({
                ...row,
                bedel: null,
                aciklama: null,
                saseNo: null,
                calistigiKurum: row.calistigiKurum ?? null,
                kullanici: null,
                sirket: null,
            }))).catch((lastError: any) => {
                console.error("Arac listesi en dar fallback sorgusu da basarisiz, bos liste donduruluyor.", lastError);
                return [];
            });
        });
    });

    const aracIds = (araclar || []).map((a: any) => a.id).filter(Boolean);
    if (aracIds.length === 0) {
        return araclar || [];
    }
    const sirketIds = Array.from(
        new Set(
            (araclar || [])
                .map((a: any) => a?.sirketId)
                .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        )
    );
    const sirketById = new Map<string, { id: string; ad: string }>();
    if (sirketIds.length > 0) {
        const sirketRows = await (prisma as any).sirket.findMany({
            where: { id: { in: sirketIds } },
            select: { id: true, ad: true },
        }).catch((error: any) => {
            console.warn("Arac listesi sirket verisi okunamadi.", error);
            return [];
        });
        for (const row of sirketRows as any[]) {
            if (!row?.id) continue;
            sirketById.set(row.id, { id: row.id, ad: row.ad || "-" });
        }
    }

    const aktifZimmetler = await (prisma as any).kullaniciZimmet.findMany({
        where: {
            aracId: { in: aracIds },
            bitis: null,
        },
        select: {
            aracId: true,
            baslangic: true,
            kullanici: {
                select: {
                    id: true,
                    ad: true,
                    soyad: true,
                    sirket: { select: { id: true, ad: true } },
                },
            },
        },
        orderBy: [{ aracId: "asc" }, { baslangic: "desc" }],
    }).catch((error: any) => {
        console.warn("Arac listesi aktif zimmet verisi okunamadi.", error);
        return [];
    });
    const aktifZimmetByAracId = new Map<string, any>();
    for (const row of aktifZimmetler as any[]) {
        if (!row?.aracId || aktifZimmetByAracId.has(row.aracId)) continue;
        aktifZimmetByAracId.set(row.aracId, row);
    }

    const muayeneler = await (prisma as any).muayene.findMany({
        where: { aracId: { in: aracIds }, muayeneTarihi: { gte: rangeStart, lte: rangeEnd } },
        select: { aracId: true, gecerlilikTarihi: true, muayeneTarihi: true },
        orderBy: [{ muayeneTarihi: "desc" }],
    }).catch(async (error: any) => {
        console.warn("Arac listesi muayene verisi yeni siralama ile okunamadi, fallback deneniyor.", error);
        return (prisma as any).muayene.findMany({
            where: { aracId: { in: aracIds }, gecerlilikTarihi: { gte: rangeStart, lte: rangeEnd } },
            select: { aracId: true, gecerlilikTarihi: true, muayeneTarihi: true },
            orderBy: [{ gecerlilikTarihi: "desc" }],
        }).catch((fallbackError: any) => {
            console.warn("Arac listesi muayene fallback sorgusu da basarisiz.", fallbackError);
            return [];
        });
    });

    const [kaskolar, trafikler] = await Promise.all([
        (prisma as any).kasko.findMany({
            where: {
                aracId: { in: aracIds },
                baslangicTarihi: { lte: rangeEnd },
                bitisTarihi: { gte: rangeStart },
            },
            select: { aracId: true, bitisTarihi: true, aktifMi: true },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { bitisTarihi: "desc" }],
        }).catch((error: any) => {
            console.warn("Arac listesi kasko verisi okunamadi.", error);
            return [];
        }),
        (prisma as any).trafikSigortasi.findMany({
            where: {
                aracId: { in: aracIds },
                baslangicTarihi: { lte: rangeEnd },
                bitisTarihi: { gte: rangeStart },
            },
            select: { aracId: true, bitisTarihi: true, aktifMi: true },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { bitisTarihi: "desc" }],
        }).catch((error: any) => {
            console.warn("Arac listesi trafik sigortasi verisi okunamadi.", error);
            return [];
        }),
    ]);

    const [
        yakitByArac,
        bakimByArac,
        muayeneByArac,
        cezaByArac,
        kaskoByArac,
        trafikByArac,
        masrafByArac,
        yakitKayitlari,
        yakitSonKayitKmByArac,
    ] =
        await Promise.all([
            (prisma as any).yakit.groupBy({
                where: { aracId: { in: aracIds }, tarih: { gte: rangeStart, lte: rangeEnd } },
                by: ["aracId"],
                _sum: { tutar: true, litre: true },
            }).catch(() => []),
            (prisma as any).bakim.groupBy({
                where: { aracId: { in: aracIds }, bakimTarihi: { gte: rangeStart, lte: rangeEnd } },
                by: ["aracId"],
                _sum: { tutar: true },
            }).catch(() => []),
            (prisma as any).muayene.groupBy({
                where: { aracId: { in: aracIds }, muayeneTarihi: { gte: rangeStart, lte: rangeEnd } },
                by: ["aracId"],
                _sum: { tutar: true },
            }).catch(() => []),
            (prisma as any).ceza.groupBy({
                where: { aracId: { in: aracIds }, tarih: { gte: rangeStart, lte: rangeEnd } },
                by: ["aracId"],
                _sum: { tutar: true },
            }).catch(() => []),
            (prisma as any).kasko.groupBy({
                where: { aracId: { in: aracIds }, baslangicTarihi: { gte: rangeStart, lte: rangeEnd } },
                by: ["aracId"],
                _sum: { tutar: true },
            }).catch(() => []),
            (prisma as any).trafikSigortasi.groupBy({
                where: { aracId: { in: aracIds }, baslangicTarihi: { gte: rangeStart, lte: rangeEnd } },
                by: ["aracId"],
                _sum: { tutar: true },
            }).catch(() => []),
            (prisma as any).masraf.groupBy({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                    tur: { notIn: [...EXCLUDED_MASRAF_TURLERI] },
                },
                by: ["aracId"],
                _sum: { tutar: true },
            }).catch(() => []),
            (prisma as any).yakit.findMany({
                where: { aracId: { in: aracIds }, tarih: { gte: rangeStart, lte: rangeEnd } },
                select: { id: true, aracId: true, tarih: true, km: true, litre: true, tutar: true },
                orderBy: [{ aracId: "asc" }, { tarih: "asc" }, { km: "asc" }],
            }).catch(() => []),
            (prisma as any).yakit.findMany({
                where: { aracId: { in: aracIds } },
                select: { aracId: true, km: true },
                orderBy: [{ aracId: "asc" }, { tarih: "desc" }, { id: "desc" }],
                distinct: ["aracId"],
            }).catch(() => []),
        ]);

    const yakitMap = toSumMap(yakitByArac as any[]);
    const yakitLitreMap = toLitreMap(yakitByArac as any[]);
    const bakimMap = toSumMap(bakimByArac as any[]);
    const muayeneTutarMap = toSumMap(muayeneByArac as any[]);
    const cezaMap = toSumMap(cezaByArac as any[]);
    const kaskoTutarMap = toSumMap(kaskoByArac as any[]);
    const trafikTutarMap = toSumMap(trafikByArac as any[]);
    const digerMap = toSumMap(masrafByArac as any[]);
    const yakitSonKayitKmMap = new Map<string, number>();
    for (const row of yakitSonKayitKmByArac as any[]) {
        if (!row?.aracId) continue;
        yakitSonKayitKmMap.set(row.aracId, toNumber(row?.km));
    }
    const fuelMetricsByVehicleId = buildFuelIntervalMetrics(
        (yakitKayitlari as any[]).map((row) => ({
            id: row.id,
            aracId: row.aracId,
            tarih: row.tarih,
            km: row.km,
            litre: row.litre,
            tutar: row.tutar,
            soforId: null,
        }))
    ).byVehicleId;

    const muayeneMap = new Map<string, any>();
    for (const item of muayeneler as any[]) {
        if (item?.aracId && !muayeneMap.has(item.aracId)) {
            muayeneMap.set(item.aracId, item);
        }
    }

    const kaskoMap = new Map<string, any>();
    for (const item of kaskolar as any[]) {
        if (item?.aracId && !kaskoMap.has(item.aracId)) {
            kaskoMap.set(item.aracId, item);
        }
    }

    const trafikMap = new Map<string, any>();
    for (const item of trafikler as any[]) {
        if (item?.aracId && !trafikMap.has(item.aracId)) {
            trafikMap.set(item.aracId, item);
        }
    }

    const withTakip = (araclar || []).map((arac: any) => {
        const aktifZimmet = aktifZimmetByAracId.get(arac.id);
        const inferredKullanici = arac.kullanici || aktifZimmet?.kullanici || null;
        const inferredKullaniciId = arac.kullaniciId || inferredKullanici?.id || null;
        const inferredSirket = arac.sirket || (arac.sirketId ? sirketById.get(arac.sirketId) || null : null);
        const yakitMetrigi = fuelMetricsByVehicleId.get(arac.id);
        const latestFuelKm = toNumber(yakitSonKayitKmMap.get(arac.id));
        const resolvedGuncelKm = latestFuelKm > 0 ? Math.trunc(latestFuelKm) : toNumber(arac.guncelKm);

        return {
        ...arac,
        guncelKm: resolvedGuncelKm,
        kullanici: inferredKullanici,
        kullaniciId: inferredKullaniciId,
        sirket: inferredSirket,
        muayene: muayeneMap.get(arac.id) ? [muayeneMap.get(arac.id)] : [],
        kasko: kaskoMap.get(arac.id) ? [kaskoMap.get(arac.id)] : [],
        trafikSigortasi: trafikMap.get(arac.id) ? [trafikMap.get(arac.id)] : [],
        maliyetKalemleri: {
            yakit: yakitMap.get(arac.id) || 0,
            bakim: bakimMap.get(arac.id) || 0,
            muayene: muayeneTutarMap.get(arac.id) || 0,
            ceza: cezaMap.get(arac.id) || 0,
            kasko: kaskoTutarMap.get(arac.id) || 0,
            trafik: trafikTutarMap.get(arac.id) || 0,
            diger: digerMap.get(arac.id) || 0,
        },
        yakitToplamLitre: yakitLitreMap.get(arac.id) || 0,
        ortalamaYakit100Km: yakitMetrigi?.averageLitresPer100Km ?? null,
        ortalamaYakitKmBasiMaliyet: yakitMetrigi?.averageCostPerKm ?? null,
        ortalamaYakitIntervalSayisi: yakitMetrigi?.intervalCount ?? 0,
        toplamMaliyet:
            (yakitMap.get(arac.id) || 0) +
            (bakimMap.get(arac.id) || 0) +
            (muayeneTutarMap.get(arac.id) || 0) +
            (cezaMap.get(arac.id) || 0) +
            (kaskoTutarMap.get(arac.id) || 0) +
            (trafikTutarMap.get(arac.id) || 0) +
            (digerMap.get(arac.id) || 0),
    };
    });

    return sortByTextValue(withTakip, (arac: any) => arac.plaka);
}

export default async function AraclarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, selectedAy, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const { start: rangeStart, end: rangeEnd } = getAyDateRange(selectedYil, selectedAy);

    const [rawFilter, kullaniciFilter, sirketListFilter, rol] = await Promise.all([
        getAracUsageFilter(selectedSirketId),
        getPersonnelSelectFilter(),
        getSirketListFilter(),
        getCurrentUserRole()
    ]);
    const filterParts: Record<string, unknown>[] = [];
    const qFilter = buildTokenizedOrWhere(commonFilters.q, (token) => [
        { plaka: { contains: token, mode: "insensitive" } },
        { marka: { contains: token, mode: "insensitive" } },
        { model: { contains: token, mode: "insensitive" } },
        {
            kullanici: {
                OR: [
                    { ad: { contains: token, mode: "insensitive" } },
                    { soyad: { contains: token, mode: "insensitive" } },
                ],
            },
        },
    ]);
    if (qFilter) {
        filterParts.push(qFilter);
    }
    if (commonFilters.status) {
        filterParts.push({ durum: commonFilters.status });
    }
    if (commonFilters.type) {
        filterParts.push({ kategori: commonFilters.type });
    }
    const safeFilterParts = filterParts.filter((part) => {
        if (!part || typeof part !== "object") return false;
        const keys = Object.keys(part);
        return !keys.includes("OR");
    });
    const safeScopeFilter = safeFilterParts.length
        ? { AND: [(rawFilter || {}) as Record<string, unknown>, ...safeFilterParts] }
        : ((rawFilter || {}) as Record<string, unknown>);
    const filter = filterParts.length
        ? { AND: [(rawFilter || {}) as Record<string, unknown>, ...filterParts] }
        : ((rawFilter || {}) as Record<string, unknown>);

    const isSfr = rol === 'SOFOR';

    const araclarPromise = getAraclarWithTakipBilgileri(
        filter as Record<string, unknown>,
        rangeStart,
        rangeEnd,
        safeScopeFilter
    );

    const [araclar, sirketler, kullanicilar] = await Promise.all([
        araclarPromise,
        (prisma as any).sirket.findMany({ 
            where: sirketListFilter as any,
            select: { id: true, ad: true, bulunduguIl: true }, 
            orderBy: { ad: 'asc' } 
        }).catch((error: any) => {
            console.warn("Sirket listesi getirilemedi, bos liste ile devam ediliyor.", error);
            return [];
        }),
        isSfr ? [] : (prisma as any).kullanici.findMany({ 
            where: {
                ...(kullaniciFilter as any),
                arac: { is: null },
                zimmetler: {
                    none: {
                        bitis: null,
                    },
                },
            } as any,
            select: {
                id: true,
                ad: true,
                soyad: true,
                sirketId: true,
                sirket: { select: { ad: true } },
            },
            orderBy: { ad: 'asc' } 
        }).catch((error: any) => {
            console.warn("Kullanici listesi getirilemedi, bos liste ile devam ediliyor.", error);
            return [];
        })
    ]);

    const sirketIdByName = new Map<string, string>();
    for (const sirket of sirketler as Array<{ id?: string; ad?: string }>) {
        if (!sirket?.id || !sirket?.ad) continue;
        const normalized = normalizeCompanyName(sirket.ad);
        if (!normalized) continue;
        if (!sirketIdByName.has(normalized)) {
            sirketIdByName.set(normalized, sirket.id);
        }
    }

    const araclarWithUsageCompany = (araclar as any[]).map((arac) => {
        const manualFirma = typeof arac?.calistigiKurum === "string" ? arac.calistigiKurum.trim() : "";
        const mappedSirketId =
            typeof arac?.kullanici?.sirket?.id === "string" && arac.kullanici.sirket.id.trim().length > 0
                ? arac.kullanici.sirket.id
                : manualFirma
                    ? sirketIdByName.get(normalizeCompanyName(manualFirma)) || null
                    : null;

        return {
            ...arac,
            calistigiKurumSirketId: mappedSirketId,
        };
    });

    return (
        <AraclarClient 
            initialAraclar={araclarWithUsageCompany as any} 
            sirketler={sirketler}
            kullanicilar={kullanicilar.map((u: any) => ({
                id: u.id,
                adSoyad: `${u.ad} ${u.soyad}`.trim(),
                sirketId: u.sirketId || null,
                sirketAd: u.sirket?.ad || null,
            }))}
            role={rol}
        />
    );
}
