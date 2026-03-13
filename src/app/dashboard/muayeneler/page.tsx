import { prisma } from "../../../lib/prisma";
import MuayenelerClient from "./client";
import { MuayeneRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function MuayenelerPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const filter = await getModelFilter('muayene', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);

    const [muayeneler, araclar] = await Promise.all([
        (prisma as any).muayene.findMany({
            where: filter as any,
            orderBy: { muayeneTarihi: 'desc' },
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true },
            orderBy: { plaka: 'asc' }
        })
    ]);
    return <MuayenelerClient initialMuayeneler={muayeneler as unknown as MuayeneRow[]} araclar={araclar} />;
}
