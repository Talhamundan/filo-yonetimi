import { prisma } from "../../../lib/prisma";
import KaskoClient from "./client";
import { KaskoRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { buildTokenizedOrWhere } from "@/lib/search-query";

export default async function KaskoPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, selectedAy, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const { start: yilBasi, end: yilSonu } = getAyDateRange(selectedYil, selectedAy);
    const filter = await getModelFilter('kasko', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);

    const [sirketList, aktifZimmetler] = await Promise.all([
        prisma.sirket.findMany({ select: { id: true, ad: true } }),
        prisma.kullaniciZimmet.findMany({
            where: { bitis: null },
            include: { kullanici: { include: { sirket: { select: { id: true, ad: true } } } } }
        })
    ]);

    const sirketById = new Map(sirketList.map(s => [s.id, s]));
    const aktifZimmetByAracId = new Map(aktifZimmetler.map(z => [z.aracId, z]));

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const criticalDate = new Date(now);
    criticalDate.setDate(criticalDate.getDate() + 15);
    const upcomingDate = new Date(now);
    upcomingDate.setDate(upcomingDate.getDate() + 30);
    const whereParts: Record<string, unknown>[] = [
        (filter || {}) as Record<string, unknown>,
        { baslangicTarihi: { lte: yilSonu } },
        { bitisTarihi: { gte: yilBasi } },
    ];

    const qFilter = buildTokenizedOrWhere(commonFilters.q, (token) => [
        { sigortaSirketi: { contains: token, mode: "insensitive" } },
        { acente: { contains: token, mode: "insensitive" } },
        { policeNo: { contains: token, mode: "insensitive" } },
        { arac: { plaka: { contains: token, mode: "insensitive" } } },
        { arac: { ruhsatSahibi: { contains: token, mode: "insensitive" } } },
        { arac: { calistigiKurum: { contains: token, mode: "insensitive" } } },
    ]);
    if (qFilter) {
        whereParts.push(qFilter);
    }
    if (commonFilters.status) {
        switch (commonFilters.status) {
            case "PASIF":
                whereParts.push({ aktifMi: false });
                break;
            case "GECIKTI":
                whereParts.push({ aktifMi: true, bitisTarihi: { lt: now } });
                break;
            case "YUKSEK":
            case "KRITIK":
                whereParts.push({ aktifMi: true, bitisTarihi: { gte: now, lte: criticalDate } });
                break;
            case "YAKLASIYOR":
                whereParts.push({ aktifMi: true, bitisTarihi: { gte: criticalDate, lte: upcomingDate } });
                break;
            case "GECERLI":
                whereParts.push({ aktifMi: true, bitisTarihi: { gt: upcomingDate } });
                break;
            default:
                whereParts.push({ aktifMi: true });
                break;
        }
    } else {
        whereParts.push({ aktifMi: true });
    }
    if (dateRange) {
        whereParts.push({ bitisTarihi: dateRange });
    }
    const kaskoWhere = { AND: whereParts };

    const [kaskolarRaw, araclar] = await Promise.all([
        (prisma as any).kasko.findMany({
            where: kaskoWhere as any,
            orderBy: [
                { aracId: "asc" },
                { bitisTarihi: "desc" },
            ],
            include: { 
                arac: { 
                    include: { 
                        sirket: { select: { ad: true } },
                        kullanici: { include: { sirket: { select: { ad: true } } } }
                    } 
                } 
            }
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true, durum: true },
            orderBy: { plaka: 'asc' }
        })
    ]);
    const seenAracIds = new Set<string>();
    const kaskolar = (kaskolarRaw as any[]).filter((item) => {
        if (!item?.aracId || seenAracIds.has(item.aracId)) return false;
        seenAracIds.add(item.aracId);
        return true;
    }).map((item) => {
        const aktifZimmet = aktifZimmetByAracId.get(item.aracId);
        const inferredKullanici = (item.arac as any).kullanici || aktifZimmet?.kullanici || null;
        const inferredSirket = (item.arac as any).sirket || (item.arac.sirketId ? sirketById.get(item.arac.sirketId) || null : null);

        return {
            ...item,
            arac: {
                ...item.arac,
                kullanici: inferredKullanici,
                sirket: inferredSirket,
            }
        };
    }).sort((a, b) => new Date(b.bitisTarihi).getTime() - new Date(a.bitisTarihi).getTime());

    return <KaskoClient initialKaskolar={kaskolar as unknown as KaskoRow[]} araclar={araclar} />;
}
