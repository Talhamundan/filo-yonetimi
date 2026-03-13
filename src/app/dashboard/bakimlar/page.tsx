import { prisma } from "../../../lib/prisma";
import BakimlarClient from "./client";
import { BakimRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function BakimlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const filter = await getModelFilter('bakim', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);

    const [bakimlar, araclar] = await Promise.all([
        (prisma as any).bakim.findMany({
            where: filter as any,
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
            select: { id: true, plaka: true },
            orderBy: { plaka: 'asc' }
        })
    ]);

    return <BakimlarClient 
        initialBakimlar={bakimlar as unknown as BakimRow[]} 
        activeAraclar={araclar}
    />;
}
