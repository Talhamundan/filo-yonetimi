import { prisma } from "../../../lib/prisma";
import MasraflarClient from "./client";
import { MasrafRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";

export default async function MasraflarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const filter = await getModelFilter('masraf', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const masrafWhere = withYilDateFilter((filter || {}) as Record<string, unknown>, "tarih", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [masrafWhere as Record<string, unknown>];

    if (commonFilters.q) {
        const q = commonFilters.q;
        whereParts.push({
            OR: [
                { aciklama: { contains: q, mode: "insensitive" } },
                { arac: { plaka: { contains: q, mode: "insensitive" } } },
                { arac: { marka: { contains: q, mode: "insensitive" } } },
                { arac: { model: { contains: q, mode: "insensitive" } } },
            ],
        });
    }
    if (commonFilters.type) {
        whereParts.push({ tur: commonFilters.type });
    }
    if (dateRange) {
        whereParts.push({ tarih: dateRange });
    }
    const scopedMasrafWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const [masraflar, araclar] = await Promise.all([
        (prisma as any).masraf.findMany({
            where: scopedMasrafWhere as any,
            orderBy: { tarih: 'desc' },
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        })
    ]);
    return <MasraflarClient initialMasraflar={masraflar as unknown as MasrafRow[]} araclar={araclar} />;
}
