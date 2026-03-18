import { prisma } from "../../../lib/prisma";
import BakimlarClient from "./client";
import { BakimRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";

export default async function BakimlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const filter = await getModelFilter('bakim', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const rawFilter = filter as any;
    const scopedSirketId = typeof rawFilter?.sirketId === "string" ? rawFilter.sirketId : null;

    // Legacy kayitlarda bakim.sirketId bos olabiliyor.
    // Sirket kapsaminda, arac.sirketId eslesmesiyle de kayitlari yakala.
    const bakimWhere = scopedSirketId
        ? {
            OR: [
                rawFilter,
                { ...rawFilter, sirketId: null, arac: { sirketId: scopedSirketId } },
            ],
        }
        : rawFilter;
    const bakimYearWhere = withYilDateFilter((bakimWhere || {}) as Record<string, unknown>, "bakimTarihi", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [bakimYearWhere as Record<string, unknown>];

    if (commonFilters.q) {
        const q = commonFilters.q;
        whereParts.push({
            OR: [
                { servisAdi: { contains: q, mode: "insensitive" } },
                { yapilanIslemler: { contains: q, mode: "insensitive" } },
                { arac: { plaka: { contains: q, mode: "insensitive" } } },
                { arac: { marka: { contains: q, mode: "insensitive" } } },
                { arac: { model: { contains: q, mode: "insensitive" } } },
            ],
        });
    }
    if (commonFilters.type) {
        whereParts.push({ kategori: commonFilters.type });
    } else if (commonFilters.status) {
        whereParts.push({ kategori: commonFilters.status });
    }
    if (dateRange) {
        whereParts.push({ bakimTarihi: dateRange });
    }
    const scopedBakimWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const [bakimlar, araclar] = await Promise.all([
        (prisma as any).bakim.findMany({
            where: scopedBakimWhere as any,
            orderBy: { bakimTarihi: 'desc' },
            include: {
                arac: {
                    include: {
                        sirket: { select: { ad: true } }
                    }
                }
            }
        }),
        (prisma as any).arac.findMany({
            where: { ...(aracFilter as any), durum: 'AKTIF' },
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        })
    ]);

    return <BakimlarClient 
        initialBakimlar={bakimlar as unknown as BakimRow[]} 
        activeAraclar={araclar}
    />;
}
