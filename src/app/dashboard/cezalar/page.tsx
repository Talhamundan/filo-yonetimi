import React from "react";
import { prisma } from "@/lib/prisma";
import CezalarClient from "./Client";
import { getSirketFilter } from "@/lib/auth-utils";

export default async function CezalarPage() {
    const sirketFilter = await getSirketFilter();

    const [cezalar, topSoforler, araclar, soforler] = await Promise.all([
        (prisma as any).ceza.findMany({
            where: sirketFilter as any,
            orderBy: { cezaTarihi: 'desc' },
            include: {
                arac: { select: { plaka: true, marka: true } },
                kullanici: { select: { ad: true, soyad: true } }
            }
        }),
        (prisma as any).ceza.groupBy({
            by: ['kullaniciId'],
            _sum: { tutar: true },
            _count: { id: true },
            where: { ...(sirketFilter as any), kullaniciId: { not: null } },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        }),
        (prisma as any).arac.findMany({ 
            where: sirketFilter as any,
            select: { id: true, plaka: true } 
        }),
        (prisma as any).kullanici.findMany({
            where: { ...(sirketFilter as any), rol: 'SOFOR' },
            select: { id: true, ad: true, soyad: true }
        })
    ]);

    const formattedCezalar = cezalar.map((c: any) => ({
        id: c.id,
        tarih: c.cezaTarihi.toISOString(),
        arac: c.arac?.plaka || "-",
        sofor: c.kullanici ? `${c.kullanici.ad} ${c.kullanici.soyad}` : "-",
        tutar: c.tutar,
        km: c.km,
        aciklama: c.aciklama || "-",
        odendiMi: c.odendiMi
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
