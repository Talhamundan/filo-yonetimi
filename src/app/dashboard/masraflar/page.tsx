import { prisma } from "../../../lib/prisma";
import MasraflarClient from "./client";
import { MasrafRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";

export default async function MasraflarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const filter = await getModelFilter('masraf', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const masrafWhere = withYilDateFilter((filter || {}) as Record<string, unknown>, "tarih", selectedYil);

    const [masraflar, araclar] = await Promise.all([
        (prisma as any).masraf.findMany({
            where: masrafWhere as any,
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
