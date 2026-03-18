import { prisma } from "../../../lib/prisma";
import SigortaClient from "./client";
import { SigortaRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, getYilDateRange, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";

export default async function TrafikSigortasiPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const { start: yilBasi, end: yilSonu } = getYilDateRange(selectedYil);
    const filter = await getModelFilter('trafikSigortasi', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
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

    if (commonFilters.q) {
        const q = commonFilters.q;
        whereParts.push({
            OR: [
                { sirket: { contains: q, mode: "insensitive" } },
                { acente: { contains: q, mode: "insensitive" } },
                { policeNo: { contains: q, mode: "insensitive" } },
                { arac: { plaka: { contains: q, mode: "insensitive" } } },
            ],
        });
    }
    if (commonFilters.status) {
        switch (commonFilters.status) {
            case "PASIF":
                whereParts.push({ aktifMi: false });
                break;
            case "GECIKTI":
                whereParts.push({ aktifMi: true, bitisTarihi: { lt: now } });
                break;
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
    const sigortaWhere = { AND: whereParts };

    const [sigortalarRaw, araclar] = await Promise.all([
        (prisma as any).trafikSigortasi.findMany({
            where: sigortaWhere as any,
            orderBy: [
                { aracId: "asc" },
                { bitisTarihi: "desc" },
            ],
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        })
    ]);
    const seenAracIds = new Set<string>();
    const sigortalar = (sigortalarRaw as any[]).filter((item) => {
        if (!item?.aracId || seenAracIds.has(item.aracId)) return false;
        seenAracIds.add(item.aracId);
        return true;
    }).sort((a, b) => new Date(b.bitisTarihi).getTime() - new Date(a.bitisTarihi).getTime());

    return <SigortaClient initialSigortalar={sigortalar as unknown as SigortaRow[]} araclar={araclar} />;
}
