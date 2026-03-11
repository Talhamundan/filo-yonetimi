import { prisma } from "../../../lib/prisma";
import SigortaClient from "./client";
import { SigortaRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";

export default async function TrafikSigortasiPage() {
    const filter = await getModelFilter('trafikSigortasi');
    const aracFilter = await getModelFilter('arac');

    const [sigortalar, araclar] = await Promise.all([
        (prisma as any).trafikSigortasi.findMany({ 
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
    return <SigortaClient initialSigortalar={sigortalar as unknown as SigortaRow[]} araclar={araclar} />;
}
