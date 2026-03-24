import { prisma } from "../../../lib/prisma";
import EvrakTakipClient from "./EvrakTakipClient";
import { differenceInDays } from "date-fns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, getYilDateRange, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";

type AracLite = {
    id: string;
    plaka: string;
    marka: string;
    sirket?: { ad: string } | null;
};

type EvrakKaydi = {
    id: string;
    aracId: string;
    gecerlilikTarihi: Date;
};

function getDurum(kalanGun: number) {
    if (kalanGun < 0) return "GECIKTI";
    if (kalanGun <= 15) return "YUKSEK";
    if (kalanGun <= 30) return "YAKLASTI";
    return "GECERLI";
}

function isWithinSelectedYear(date: Date, yilBasi: Date, yilSonu: Date) {
    const time = new Date(date).getTime();
    return time >= yilBasi.getTime() && time <= yilSonu.getTime();
}

function buildLatestMap<T extends EvrakKaydi>(records: T[]) {
    const map = new Map<string, T>();
    for (const item of records) {
        if (!item?.aracId) continue;
        if (!map.has(item.aracId)) {
            map.set(item.aracId, item);
        }
    }
    return map;
}

export default async function EvrakTakipPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const { start: yilBasi, end: yilSonu } = getYilDateRange(selectedYil);
    const [aracFilter, muayeneFilter, kaskoFilter, trafikFilter] = await Promise.all([
        getModelFilter("arac", selectedSirketId),
        getModelFilter("muayene", selectedSirketId),
        getModelFilter("kasko", selectedSirketId),
        getModelFilter("trafikSigortasi", selectedSirketId),
    ]);

    const araclar: AracLite[] = await (prisma as any).arac
        .findMany({
            where: aracFilter as any,
            orderBy: { plaka: "asc" },
            select: {
                id: true,
                plaka: true,
                marka: true,
                sirket: { select: { ad: true } },
            },
        })
        .catch(async (error: unknown) => {
            console.warn("Evrak takip arac sorgusu (sirket include) basarisiz, minimal sorgu ile devam ediliyor.", error);
            try {
                return await (prisma as any).arac.findMany({
                    where: aracFilter as any,
                    orderBy: { plaka: "asc" },
                    select: {
                        id: true,
                        plaka: true,
                        marka: true,
                    },
                });
            } catch (fallbackError) {
                console.warn("Evrak takip minimal arac sorgusu da basarisiz, bos liste ile devam ediliyor.", fallbackError);
                return [];
            }
        });

    const aracIds = (araclar as any[]).map((a: any) => a.id).filter(Boolean);
    if (aracIds.length === 0) {
        return <EvrakTakipClient initialEvraklar={[]} />;
    }

    const [muayeneKayitlari, kaskoKayitlari, trafikKayitlari] = await Promise.all([
        (prisma as any).muayene
            .findMany({
                where: {
                    ...(muayeneFilter as any),
                    aracId: { in: aracIds },
                },
                orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { muayeneTarihi: "desc" }, { gecerlilikTarihi: "desc" }],
                select: {
                    id: true,
                    aracId: true,
                    gecerlilikTarihi: true,
                },
            })
            .catch((error: unknown) => {
                console.warn("Evrak takip muayene sorgusu basarisiz, bu kalem atlandi.", error);
                return [];
            }),
        (prisma as any).kasko
            .findMany({
                where: {
                    ...(kaskoFilter as any),
                    aracId: { in: aracIds },
                },
                orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { baslangicTarihi: "desc" }, { bitisTarihi: "desc" }],
                select: {
                    id: true,
                    aracId: true,
                    bitisTarihi: true,
                },
            })
            .catch((error: unknown) => {
                console.warn("Evrak takip kasko sorgusu basarisiz, bu kalem atlandi.", error);
                return [];
            }),
        (prisma as any).trafikSigortasi
            .findMany({
                where: {
                    ...(trafikFilter as any),
                    aracId: { in: aracIds },
                },
                orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { baslangicTarihi: "desc" }, { bitisTarihi: "desc" }],
                select: {
                    id: true,
                    aracId: true,
                    bitisTarihi: true,
                },
            })
            .catch((error: unknown) => {
                console.warn("Evrak takip trafik sigortasi sorgusu basarisiz, bu kalem atlandi.", error);
                return [];
            }),
    ]);

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

    const bugun = new Date();
    const evrakListesi: any[] = [];

    for (const arac of araclar as any[]) {
        const muayene = latestMuayene.get(arac.id);
        if (muayene && isWithinSelectedYear(muayene.gecerlilikTarihi, yilBasi, yilSonu)) {
            const kalanGun = differenceInDays(muayene.gecerlilikTarihi, bugun);
            evrakListesi.push({
                id: `m-${muayene.id}`,
                aracId: arac.id,
                plaka: arac.plaka,
                marka: arac.marka,
                sirketAd: arac.sirket?.ad || null,
                tur: "Muayene",
                gecerlilikTarihi: muayene.gecerlilikTarihi,
                kalanGun,
                durum: getDurum(kalanGun),
            });
        }

        const kasko = latestKasko.get(arac.id);
        if (kasko && isWithinSelectedYear(kasko.gecerlilikTarihi, yilBasi, yilSonu)) {
            const kalanGun = differenceInDays(kasko.gecerlilikTarihi, bugun);
            evrakListesi.push({
                id: `k-${kasko.id}`,
                aracId: arac.id,
                plaka: arac.plaka,
                marka: arac.marka,
                sirketAd: arac.sirket?.ad || null,
                tur: "Kasko",
                gecerlilikTarihi: kasko.gecerlilikTarihi,
                kalanGun,
                durum: getDurum(kalanGun),
            });
        }

        const trafik = latestTrafik.get(arac.id);
        if (trafik && isWithinSelectedYear(trafik.gecerlilikTarihi, yilBasi, yilSonu)) {
            const kalanGun = differenceInDays(trafik.gecerlilikTarihi, bugun);
            evrakListesi.push({
                id: `ts-${trafik.id}`,
                aracId: arac.id,
                plaka: arac.plaka,
                marka: arac.marka,
                sirketAd: arac.sirket?.ad || null,
                tur: "Trafik Sigortası",
                gecerlilikTarihi: trafik.gecerlilikTarihi,
                kalanGun,
                durum: getDurum(kalanGun),
            });
        }
    }
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const q = commonFilters.q.trim().toLocaleLowerCase("tr-TR");
    const filteredEvrakListesi = evrakListesi
        .filter((row) => {
            if (q) {
                const haystack = [
                    row.plaka,
                    row.marka,
                    row.tur,
                    row.sirketAd || "",
                ]
                    .join(" ")
                    .toLocaleLowerCase("tr-TR");
                if (!haystack.includes(q)) return false;
            }
            if (commonFilters.status) {
                const normalizedStatus = commonFilters.status === "KRITIK" ? "YUKSEK" : commonFilters.status;
                if (row.durum !== normalizedStatus) return false;
            }
            if (commonFilters.type && row.tur !== commonFilters.type) return false;
            if (dateRange?.gte && row.gecerlilikTarihi < dateRange.gte) return false;
            if (dateRange?.lte && row.gecerlilikTarihi > dateRange.lte) return false;
            return true;
        })
        .sort((a, b) => a.kalanGun - b.kalanGun);

    return <EvrakTakipClient initialEvraklar={filteredEvrakListesi} />;
}
