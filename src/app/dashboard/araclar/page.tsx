import { prisma } from "@/lib/prisma";
import AraclarClient from "./AraclarClient";
import { getModelFilter, getCurrentUserRole, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { sortByTextValue } from "@/lib/sort-utils";

const EXCLUDED_MASRAF_TURLERI = ["YAKIT", "HGS_YUKLEME"] as const;

function getMonthDateRange(yil: number, ay: number) {
    const start = new Date(yil, ay - 1, 1, 0, 0, 0, 0);
    const end = new Date(yil, ay, 0, 23, 59, 59, 999);
    return { start, end };
}

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toSumMap(rows: Array<{ aracId: string; _sum?: { tutar?: number | null } }>) {
    const map = new Map<string, number>();
    for (const row of rows) {
        if (!row?.aracId) continue;
        map.set(row.aracId, toNumber(row?._sum?.tutar));
    }
    return map;
}

async function getAraclarWithTakipBilgileri(filter: Record<string, unknown>, rangeStart: Date, rangeEnd: Date) {
    const araclar = await (prisma as any).arac.findMany({
        where: filter as any,
        orderBy: { plaka: "asc" },
        include: {
            kullanici: true,
            sirket: true,
        },
    }).catch(async (error: any) => {
        console.warn("Arac listesi sorgusu basarisiz, minimal sorgu ile devam ediliyor.", error);
        return (prisma as any).arac.findMany({
            where: filter as any,
            orderBy: { plaka: "asc" },
        });
    });

    const aracIds = (araclar || []).map((a: any) => a.id).filter(Boolean);
    if (aracIds.length === 0) {
        return araclar || [];
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

    const [yakitByArac, bakimByArac, muayeneByArac, hgsByArac, cezaByArac, kaskoByArac, trafikByArac, masrafByArac] =
        await Promise.all([
            (prisma as any).yakit.groupBy({
                where: { aracId: { in: aracIds }, tarih: { gte: rangeStart, lte: rangeEnd } },
                by: ["aracId"],
                _sum: { tutar: true },
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
            (prisma as any).hgsYukleme.groupBy({
                where: { aracId: { in: aracIds }, tarih: { gte: rangeStart, lte: rangeEnd } },
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
        ]);

    const yakitMap = toSumMap(yakitByArac as any[]);
    const bakimMap = toSumMap(bakimByArac as any[]);
    const muayeneTutarMap = toSumMap(muayeneByArac as any[]);
    const hgsMap = toSumMap(hgsByArac as any[]);
    const cezaMap = toSumMap(cezaByArac as any[]);
    const kaskoTutarMap = toSumMap(kaskoByArac as any[]);
    const trafikTutarMap = toSumMap(trafikByArac as any[]);
    const digerMap = toSumMap(masrafByArac as any[]);

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

    const withTakip = (araclar || []).map((arac: any) => ({
        ...arac,
        muayene: muayeneMap.get(arac.id) ? [muayeneMap.get(arac.id)] : [],
        kasko: kaskoMap.get(arac.id) ? [kaskoMap.get(arac.id)] : [],
        trafikSigortasi: trafikMap.get(arac.id) ? [trafikMap.get(arac.id)] : [],
        maliyetKalemleri: {
            yakit: yakitMap.get(arac.id) || 0,
            bakim: bakimMap.get(arac.id) || 0,
            muayene: muayeneTutarMap.get(arac.id) || 0,
            hgs: hgsMap.get(arac.id) || 0,
            ceza: cezaMap.get(arac.id) || 0,
            kasko: kaskoTutarMap.get(arac.id) || 0,
            trafik: trafikTutarMap.get(arac.id) || 0,
            diger: digerMap.get(arac.id) || 0,
        },
        toplamMaliyet:
            (yakitMap.get(arac.id) || 0) +
            (bakimMap.get(arac.id) || 0) +
            (muayeneTutarMap.get(arac.id) || 0) +
            (hgsMap.get(arac.id) || 0) +
            (cezaMap.get(arac.id) || 0) +
            (kaskoTutarMap.get(arac.id) || 0) +
            (trafikTutarMap.get(arac.id) || 0) +
            (digerMap.get(arac.id) || 0),
    }));

    return sortByTextValue(withTakip, (arac: any) => arac.plaka);
}

export default async function AraclarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, selectedAy, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const { start: rangeStart, end: rangeEnd } = getMonthDateRange(selectedYil, selectedAy);

    const [rawFilter, kullaniciFilter, sirketListFilter, rol] = await Promise.all([
        getModelFilter('arac', selectedSirketId),
        getModelFilter('kullanici', selectedSirketId),
        getSirketListFilter(),
        getCurrentUserRole()
    ]);
    const filterParts: Record<string, unknown>[] = [];
    const createdAtRange = getDateRangeFilter(commonFilters.from, commonFilters.to);

    if (commonFilters.q) {
        const q = commonFilters.q;
        filterParts.push({
            OR: [
                { plaka: { contains: q, mode: "insensitive" } },
                { marka: { contains: q, mode: "insensitive" } },
                { model: { contains: q, mode: "insensitive" } },
                { hgsNo: { contains: q, mode: "insensitive" } },
                { saseNo: { contains: q, mode: "insensitive" } },
                {
                    kullanici: {
                        OR: [
                            { ad: { contains: q, mode: "insensitive" } },
                            { soyad: { contains: q, mode: "insensitive" } },
                        ],
                    },
                },
            ],
        });
    }
    if (commonFilters.status) {
        filterParts.push({ durum: commonFilters.status });
    }
    if (commonFilters.type) {
        filterParts.push({ kategori: commonFilters.type });
    }
    if (createdAtRange) {
        filterParts.push({ olusturmaTarihi: createdAtRange });
    }
    const filter = filterParts.length
        ? { AND: [(rawFilter || {}) as Record<string, unknown>, ...filterParts] }
        : ((rawFilter || {}) as Record<string, unknown>);

    const isSfr = rol === 'SOFOR';

    const araclarPromise = getAraclarWithTakipBilgileri(filter as Record<string, unknown>, rangeStart, rangeEnd);

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
            where: kullaniciFilter as any,
            select: { id: true, ad: true, soyad: true }, 
            orderBy: { ad: 'asc' } 
        }).catch((error: any) => {
            console.warn("Kullanici listesi getirilemedi, bos liste ile devam ediliyor.", error);
            return [];
        })
    ]);

    return (
        <AraclarClient 
            initialAraclar={araclar as any} 
            sirketler={sirketler}
            kullanicilar={kullanicilar.map((u: any) => ({ id: u.id, adSoyad: `${u.ad} ${u.soyad}` }))}
        />
    );
}
