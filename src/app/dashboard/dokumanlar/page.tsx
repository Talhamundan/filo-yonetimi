import prisma from "../../../lib/prisma";
import DokumanlarClient from "./client";
import { DokumanRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";

export default async function DokumanlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const [filter, aracFilter] = await Promise.all([
        getModelFilter("dokuman", selectedSirketId),
        getModelFilter("arac", selectedSirketId),
    ]);
    const dokumanWhere = withYilDateFilter((filter || {}) as Record<string, unknown>, "yuklemeTarihi", selectedYil);

    const [dokumanlar, araclar] = await Promise.all([
        prisma.dokuman.findMany({
            where: dokumanWhere as any,
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
