import { prisma } from "../../../lib/prisma";
import BakimlarClient from "./client";
import { BakimRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";

export default async function BakimlarPage() {
    const filter = await getModelFilter('bakim');
    const aracFilter = await getModelFilter('arac');

    const [bakimlar, araclar] = await Promise.all([
        (prisma as any).bakim.findMany({
            where: filter as any,
            orderBy: { bakimTarihi: 'desc' },
            include: {
                arac: true
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
