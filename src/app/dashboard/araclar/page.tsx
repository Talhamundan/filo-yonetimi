import { prisma } from "@/lib/prisma";
import AraclarClient from "./AraclarClient";
import { getModelFilter, getCurrentUserRole, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function AraclarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);

    const [filter, kullaniciFilter, sirketListFilter, rol] = await Promise.all([
        getModelFilter('arac', selectedSirketId),
        getModelFilter('kullanici', selectedSirketId),
        getSirketListFilter(),
        getCurrentUserRole()
    ]);

    const isSfr = rol === 'SOFOR';

    const [araclar, sirketler, kullanicilar] = await Promise.all([
        (prisma as any).arac.findMany({
            where: filter as any,
            orderBy: { olusturmaTarihi: 'desc' },
            include: {
                kullanici: true,
                sirket: true,
                muayene: { orderBy: { muayeneTarihi: 'desc' }, take: 1 },
                kasko: { orderBy: { bitisTarihi: 'desc' }, take: 1 },
                trafikSigortasi: { orderBy: { bitisTarihi: 'desc' }, take: 1 }
            }
        }),
        (prisma as any).sirket.findMany({ 
            where: sirketListFilter as any,
            select: { id: true, ad: true }, 
            orderBy: { ad: 'asc' } 
        }),
        isSfr ? [] : (prisma as any).kullanici.findMany({ 
            where: kullaniciFilter as any,
            select: { id: true, ad: true, soyad: true }, 
            orderBy: { ad: 'asc' } 
        })
    ]);

    return (
        <AraclarClient 
            initialAraclar={araclar as any} 
            sirketler={sirketler}
            kullanicilar={kullanicilar.map((u: any) => ({ id: u.id, adSoyad: `${u.ad} ${u.soyad}` }))}
        />
    );
}
