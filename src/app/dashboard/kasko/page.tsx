import { prisma } from "../../../lib/prisma";
import KaskoClient from "./client";
import { KaskoRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";

export default async function KaskoPage() {
    const filter = await getModelFilter('kasko');
    const aracFilter = await getModelFilter('arac');

    const [kaskolar, araclar] = await Promise.all([
        (prisma as any).kasko.findMany({ 
            where: filter as any,
            orderBy: { bitisTarihi: 'desc' }, 
            include: { arac: true } 
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: { id: true, plaka: true }, 
            orderBy: { plaka: 'asc' } 
        })
    ]);
    return <KaskoClient initialKaskolar={kaskolar as unknown as KaskoRow[]} araclar={araclar} />;
}
