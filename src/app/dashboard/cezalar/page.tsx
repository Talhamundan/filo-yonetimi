import React from "react";
import { prisma } from "@/lib/prisma";
import CezalarClient from "./Client";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function CezalarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [cezaFilter, aracFilter, personelFilter] = await Promise.all([
        getModelFilter('ceza', selectedSirketId),
        getModelFilter('arac', selectedSirketId),
        getModelFilter('kullanici', selectedSirketId),
    ]);

    const [cezalar, topSoforler, araclar, soforler] = await Promise.all([
        (prisma as any).ceza.findMany({
            where: cezaFilter as any,
            orderBy: { cezaTarihi: 'desc' },
            include: {
                arac: { select: { plaka: true, marka: true, sirket: { select: { ad: true } } } },
                kullanici: { select: { ad: true, soyad: true } }
            }
        }),
        (prisma as any).ceza.groupBy({
            by: ['kullaniciId'],
            _sum: { tutar: true },
            _count: { id: true },
            where: { ...(cezaFilter as any), kullaniciId: { not: null } },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: { id: true, plaka: true } 
        }),
        (prisma as any).kullanici.findMany({
            where: { ...(personelFilter as any), rol: 'SOFOR' },
            select: { id: true, ad: true, soyad: true }
        })
    ]);

    const formattedCezalar = cezalar.map((c: any) => ({
        id: c.id,
        tarih: c.cezaTarihi.toISOString(),
        arac: c.arac?.plaka || "-",
        aracMarka: c.arac?.marka || "",
        sirketAd: c.arac?.sirket?.ad || null,
        sofor: c.kullanici ? `${c.kullanici.ad} ${c.kullanici.soyad}` : "-",
        tutar: c.tutar,
        km: c.km,
        aciklama: c.aciklama || "-",
        odendiMi: c.odendiMi,
        sonOdemeTarihi: c.sonOdemeTarihi?.toISOString() || null
    }));

    const top5Stats = [];
    for (const st of topSoforler as any[]) {
        if (st.kullaniciId) {
            const kul = await (prisma as any).kullanici.findUnique({ where: { id: st.kullaniciId }, select: { ad: true, soyad: true } });
            if (kul) {
                top5Stats.push({
                    adSoyad: `${kul.ad} ${kul.soyad}`,
                    cezaAdet: st._count.id,
                    toplamTutar: st._sum.tutar || 0
                });
            }
        }
    }

    return <CezalarClient 
        initialData={formattedCezalar} 
        top5Stats={top5Stats} 
        araclar={araclar} 
        soforler={soforler} 
    />;
}
