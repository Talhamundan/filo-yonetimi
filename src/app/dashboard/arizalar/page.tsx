import { prisma } from "../../../lib/prisma";
import ArizalarClient from "./client";
import { ArizaRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function ArizalarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const filter = await getModelFilter('ariza', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);

    const [arizalar, araclar] = await Promise.all([
        (prisma as any).ariza.findMany({
            where: filter as any,
            orderBy: { arizaTarihi: 'desc' },
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true },
            orderBy: { plaka: 'asc' }
        })
    ]);
    return <ArizalarClient initialArizalar={arizalar as unknown as ArizaRow[]} araclar={araclar} />;
}
