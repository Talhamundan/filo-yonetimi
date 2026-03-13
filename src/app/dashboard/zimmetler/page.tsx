import { prisma } from "../../../lib/prisma";
import ZimmetlerClient from "./client";
import { SoforZimmetRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function ZimmetlerPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const filter = await getModelFilter('kullaniciZimmet', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const personelFilter = await getModelFilter('kullanici', selectedSirketId);

    const [zimmetler, araclar, kullanicilar] = await Promise.all([
        (prisma as any).kullaniciZimmet.findMany({
            where: filter as any,
            orderBy: { baslangic: 'desc' },
            include: {
                arac: { include: { sirket: { select: { ad: true } } } },
                kullanici: true
            }
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: { id: true, plaka: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        }),
        (prisma as any).kullanici.findMany({
            where: personelFilter as any,
            select: { id: true, ad: true, soyad: true },
            orderBy: { ad: 'asc' }
        })
    ]);

    return (
        <ZimmetlerClient 
            initialZimmetler={zimmetler as unknown as SoforZimmetRow[]} 
            araclar={araclar}
            kullanicilar={kullanicilar.map((k: any) => ({ id: k.id, adSoyad: `${k.ad} ${k.soyad}` }))}
        />
    );
}
