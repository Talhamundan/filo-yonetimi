import { prisma } from "../../../lib/prisma";
import FinansClient from "./FinansClient";
import { getModelFilter } from "@/lib/auth-utils";

export default async function FinansPage() {
    const yakitFilter = await getModelFilter('yakit');
    const masrafFilter = await getModelFilter('masraf');
    const aracFilter = await getModelFilter('arac');

    const [yakitlar, masraflar] = await Promise.all([
        (prisma as any).yakit.findMany({
            where: yakitFilter as any,
            include: { arac: true },
            orderBy: { tarih: 'desc' }
        }),
        (prisma as any).masraf.findMany({
            where: masrafFilter as any,
            include: { arac: true },
            orderBy: { tarih: 'desc' }
        })
    ]);

    // Grouping and aggregating Yakit data for metrics
    const baseYakitGroup = await (prisma as any).yakit.groupBy({
        where: yakitFilter as any,
        by: ['aracId'],
        _sum: {
            litre: true,
            tutar: true
        },
        _max: {
            km: true
        },
        _min: {
            km: true
        }
    });

    // Enriching yakitGroup with Arac data and calculations
    const araclar = await (prisma as any).arac.findMany({
        where: { id: { in: baseYakitGroup.map((g: any) => g.aracId) }, ...(aracFilter as any) },
        select: { id: true, plaka: true }
    });

    const metricsData = baseYakitGroup.map((group: any) => {
        const arac = araclar.find((a: any) => a.id === group.aracId);
        const yapilanKm = (group._max.km || 0) - (group._min.km || 0);
        const toplamLitre = group._sum.litre || 0;
        const toplamTutar = group._sum.tutar || 0;
        
        let tuketim100Km = 0;
        if (yapilanKm > 0 && toplamLitre > 0) {
            tuketim100Km = (toplamLitre / yapilanKm) * 100;
        }

        let litreMaliyet = 0;
        if (toplamLitre > 0) {
            litreMaliyet = toplamTutar / toplamLitre;
        }

        return {
            aracId: group.aracId,
            plaka: arac?.plaka || 'Bilinmiyor',
            toplamTutar,
            toplamLitre,
            tuketim100Km,
            litreMaliyet
        };
    });

    const unifiedLedger = [
        ...yakitlar.map((y: any) => ({
            id: `yakit-${y.id}`,
            tarih: y.tarih,
            tur: 'Yakıt Alımı',
            aracPlaka: y.arac?.plaka || "-",
            detay: `${y.litre} L (${y.km.toLocaleString('tr-TR')} km) ${y.istasyon ? `- ${y.istasyon}` : ''}`,
            tutar: y.tutar
        })),
        ...masraflar.map((m: any) => ({
            id: `masraf-${m.id}`,
            tarih: m.tarih,
            tur: m.tur,
            aracPlaka: m.arac?.plaka || "-",
            detay: 'Muhtelif Gider',
            tutar: m.tutar
        }))
    ].sort((a: any, b: any) => b.tarih.getTime() - a.tarih.getTime());

    return <FinansClient initialRecords={unifiedLedger as any} yakitMetrics={metricsData} />;
}
