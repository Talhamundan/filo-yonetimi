import { prisma } from "../../../lib/prisma";
import YakitlarClient from "./client";
import { YakitRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function YakitlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [queryFilter, aracFilter] = await Promise.all([
        getModelFilter('yakit', selectedSirketId),
        getModelFilter('arac', selectedSirketId),
    ]);

    const [yakitlar, araclar] = await Promise.all([
        (prisma as any).yakit.findMany({ 
            where: queryFilter as any,
            orderBy: { tarih: 'desc' }, 
            include: { 
                arac: {
                    include: {
                        sirket: { select: { ad: true } },
                        kullanici: { select: { id: true, ad: true, soyad: true } }
                    }
                } 
            } 
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: { id: true, plaka: true }, 
            orderBy: { plaka: 'asc' } 
        })
    ]);
    
    return <YakitlarClient initialYakitlar={yakitlar as unknown as YakitRow[]} araclar={araclar} />;
}
