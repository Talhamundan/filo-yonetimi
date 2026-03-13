import { prisma } from "../../../lib/prisma";
import KaskoClient from "./client";
import { KaskoRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function KaskoPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const filter = await getModelFilter('kasko', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);

    const [kaskolar, araclar] = await Promise.all([
        (prisma as any).kasko.findMany({
            where: filter as any,
            orderBy: { bitisTarihi: 'desc' },
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true },
            orderBy: { plaka: 'asc' }
        })
    ]);
    return <KaskoClient initialKaskolar={kaskolar as unknown as KaskoRow[]} araclar={araclar} />;
}
