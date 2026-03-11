import { prisma } from "../../../lib/prisma";
import MasraflarClient from "./client";
import { MasrafRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";

export default async function MasraflarPage() {
    const filter = await getModelFilter('masraf');
    const aracFilter = await getModelFilter('arac');

    const [masraflar, araclar] = await Promise.all([
        (prisma as any).masraf.findMany({ 
            where: filter as any,
            orderBy: { tarih: 'desc' }, 
            include: { arac: true } 
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: { id: true, plaka: true }, 
            orderBy: { plaka: 'asc' } 
        })
    ]);
    return <MasraflarClient initialMasraflar={masraflar as unknown as MasrafRow[]} araclar={araclar} />;
}
