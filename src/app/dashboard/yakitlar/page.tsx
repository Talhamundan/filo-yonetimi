import { prisma } from "../../../lib/prisma";
import YakitlarClient from "./client";
import { YakitRow } from "./columns";
import { getSirketFilter, isSofor, getCurrentUserId } from "@/lib/auth-utils";

export default async function YakitlarPage() {
    const sirketFilter = await getSirketFilter();
    const isSfr = await isSofor();
    const userId = await getCurrentUserId();

    const queryFilter = isSfr 
        ? { arac: { kullaniciId: userId } }
        : sirketFilter;

    const [yakitlar, araclar] = await Promise.all([
        (prisma as any).yakit.findMany({ 
            where: queryFilter as any,
            orderBy: { tarih: 'desc' }, 
            include: { 
                arac: {
                    include: {
                        kullanici: { select: { id: true, ad: true, soyad: true } }
                    }
                } 
            } 
        }),
        (prisma as any).arac.findMany({ 
            where: sirketFilter as any,
            select: { id: true, plaka: true }, 
            orderBy: { plaka: 'asc' } 
        })
    ]);
    
    return <YakitlarClient initialYakitlar={yakitlar as unknown as YakitRow[]} araclar={araclar} />;
}
