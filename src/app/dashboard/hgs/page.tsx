import { prisma } from "@/lib/prisma";
import HgsClient from "./client";
import { HgsRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";

export default async function HgsPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const [filter, aracFilter] = await Promise.all([
        getModelFilter('hgs', selectedSirketId),
        getModelFilter('arac', selectedSirketId),
    ]);
    const hgsWhere = withYilDateFilter((filter || {}) as Record<string, unknown>, "tarih", selectedYil);

    const [hgsKayitlari, araclar] = await Promise.all([
        (prisma as any).hgsYukleme.findMany({
            where: hgsWhere as any,
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
