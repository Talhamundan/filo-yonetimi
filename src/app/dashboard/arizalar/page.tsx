import { prisma } from "../../../lib/prisma";
import ArizalarClient from "./client";
import { ArizaRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";

export default async function ArizalarPage() {
    const filter = await getModelFilter('ariza');
    const aracFilter = await getModelFilter('arac');

    const [arizalar, araclar] = await Promise.all([
        (prisma as any).ariza.findMany({ 
            where: filter as any,
            orderBy: { arizaTarihi: 'desc' }, 
            include: { arac: true } 
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: { id: true, plaka: true }, 
            orderBy: { plaka: 'asc' } 
        })
    ]);
    return <ArizalarClient initialArizalar={arizalar as unknown as ArizaRow[]} araclar={araclar} />;
}
