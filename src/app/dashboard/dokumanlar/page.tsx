import prisma from "../../../lib/prisma";
import DokumanlarClient from "./client";
import { DokumanRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";

export default async function DokumanlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const [filter, aracFilter] = await Promise.all([
        getModelFilter("dokuman", selectedSirketId),
        getModelFilter("arac", selectedSirketId),
    ]);
    const dokumanWhere = withYilDateFilter((filter || {}) as Record<string, unknown>, "yuklemeTarihi", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [dokumanWhere as Record<string, unknown>];

    if (commonFilters.q) {
        const q = commonFilters.q;
        whereParts.push({
            OR: [
                { ad: { contains: q, mode: "insensitive" } },
                { dosyaUrl: { contains: q, mode: "insensitive" } },
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
        whereParts.push({ yuklemeTarihi: dateRange });
    }
    const scopedDokumanWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const [dokumanlar, araclar] = await Promise.all([
        prisma.dokuman.findMany({
            where: scopedDokumanWhere as any,
            orderBy: { yuklemeTarihi: 'desc' },
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }),
        prisma.arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        })
    ]);

    return <DokumanlarClient initialDokumanlar={dokumanlar as unknown as DokumanRow[]} araclar={araclar} />;
}
