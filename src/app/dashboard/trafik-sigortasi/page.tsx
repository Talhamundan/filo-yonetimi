import { prisma } from "../../../lib/prisma";
import SigortaClient from "./client";
import { SigortaRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function TrafikSigortasiPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const filter = await getModelFilter('trafikSigortasi', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);

    const [sigortalar, araclar] = await Promise.all([
        (prisma as any).trafikSigortasi.findMany({
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
    return <SigortaClient initialSigortalar={sigortalar as unknown as SigortaRow[]} araclar={araclar} />;
}
