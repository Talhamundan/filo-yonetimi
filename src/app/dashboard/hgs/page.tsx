import { prisma } from "@/lib/prisma";
import HgsClient from "./client";
import { HgsRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";

export default async function HgsPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const [filter, aracFilter] = await Promise.all([
        getModelFilter('hgs', selectedSirketId),
        getModelFilter('arac', selectedSirketId),
    ]);
    const hgsWhere = withYilDateFilter((filter || {}) as Record<string, unknown>, "tarih", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [hgsWhere as Record<string, unknown>];

    if (commonFilters.q) {
        const q = commonFilters.q;
        whereParts.push({
            OR: [
                { etiketNo: { contains: q, mode: "insensitive" } },
                { arac: { plaka: { contains: q, mode: "insensitive" } } },
                { arac: { marka: { contains: q, mode: "insensitive" } } },
                { arac: { model: { contains: q, mode: "insensitive" } } },
            ],
        });
    }
    if (dateRange) {
        whereParts.push({ tarih: dateRange });
    }
    const scopedHgsWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const [hgsKayitlari, araclar] = await Promise.all([
        (prisma as any).hgsYukleme.findMany({
            where: scopedHgsWhere as any,
            orderBy: { tarih: 'desc' },
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        })
    ]);

    return <HgsClient initialHgs={hgsKayitlari as unknown as HgsRow[]} araclar={araclar} />;
}
