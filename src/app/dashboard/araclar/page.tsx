import { prisma } from "@/lib/prisma";
import AraclarClient from "./AraclarClient";
import { getModelFilter, getCurrentSirketId, getCurrentUserRole } from "@/lib/auth-utils";

export default async function AraclarPage() {
    // auth() artık cache() ile memoized - tüm çağrılar tek JWT doğrulamasıyla çalışır
    const [filter, sirketId, rol] = await Promise.all([
        getModelFilter('arac'),
        getCurrentSirketId(),
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
                kasko: { orderBy: { bitisTarihi: 'desc' }, take: 1 }
            }
        }),
        (prisma as any).sirket.findMany({ 
            where: sirketId ? { id: sirketId } : {},
            select: { id: true, ad: true }, 
            orderBy: { ad: 'asc' } 
        }),
        isSfr ? [] : (prisma as any).kullanici.findMany({ 
            where: sirketId ? { sirketId } : {},
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
