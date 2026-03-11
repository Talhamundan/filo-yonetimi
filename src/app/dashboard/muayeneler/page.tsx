import { prisma } from "../../../lib/prisma";
import MuayenelerClient from "./client";
import { MuayeneRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";

export default async function MuayenelerPage() {
    const filter = await getModelFilter('muayene');
    const aracFilter = await getModelFilter('arac');

    const [muayeneler, araclar] = await Promise.all([
        (prisma as any).muayene.findMany({ 
            where: filter as any,
            orderBy: { muayeneTarihi: 'desc' }, 
            include: { arac: true } 
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: { id: true, plaka: true }, 
            orderBy: { plaka: 'asc' } 
        })
    ]);
    return <MuayenelerClient initialMuayeneler={muayeneler as unknown as MuayeneRow[]} araclar={araclar} />;
}
