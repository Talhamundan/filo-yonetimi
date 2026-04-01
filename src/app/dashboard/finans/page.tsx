import { prisma } from "../../../lib/prisma";
import FinansClient from "./FinansClient";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";

export default async function FinansPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const yakitFilter = await getModelFilter('yakit', selectedSirketId);
    const masrafFilter = await getModelFilter('masraf', selectedSirketId);
    const muayeneFilter = await getModelFilter('muayene', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const yakitWhere = withYilDateFilter((yakitFilter || {}) as Record<string, unknown>, "tarih", selectedYil);
    const masrafWhere = withYilDateFilter((masrafFilter || {}) as Record<string, unknown>, "tarih", selectedYil);
    const muayeneWhere = withYilDateFilter((muayeneFilter || {}) as Record<string, unknown>, "muayeneTarihi", selectedYil);

    const [yakitlar, masraflar, muayenelerResult] = await Promise.all([
        (prisma as any).yakit.findMany({
            where: yakitWhere as any,
            include: { arac: { select: { plaka: true, sirket: { select: { ad: true } } } } },
            orderBy: { tarih: 'desc' }
        }),
        (prisma as any).masraf.findMany({
            where: masrafWhere as any,
            include: { arac: { select: { plaka: true, sirket: { select: { ad: true } } } } },
            orderBy: { tarih: 'desc' }
        }),
        (prisma as any).muayene.findMany({
            where: { ...(muayeneWhere as any), tutar: { not: null } },
            include: { arac: { select: { plaka: true, sirket: { select: { ad: true } } } } },
            orderBy: { muayeneTarihi: 'desc' }
        }).catch((error: any) => {
            console.warn("Muayene tutar verisi okunamadi. Finans ekraninda muayene kalemi atlandi.", error);
            return [];
        })
    ]);
    const muayeneler = muayenelerResult as any[];

    // Grouping and aggregating Yakit data for metrics
    const baseYakitGroup = await (prisma as any).yakit.groupBy({
        where: yakitWhere as any,
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
        select: { id: true, plaka: true, sirket: { select: { ad: true } } }
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
            sirketAd: arac?.sirket?.ad || null,
            toplamTutar,
            toplamLitre,
            tuketim100Km,
            litreMaliyet
        };
    });

    const unifiedLedger = [
        ...yakitlar.map((y: any) => ({
            id: `yakit-${y.id}`,
            aracId: y.aracId,
            tarih: y.tarih,
            tur: 'Yakıt Alımı',
            aracPlaka: y.arac?.plaka || "-",
            aracSirket: y.arac?.sirket?.ad || null,
            detay: `${y.litre} L (${y.km.toLocaleString('tr-TR')} km) ${y.istasyon ? `- ${y.istasyon}` : ''}`,
            tutar: y.tutar
        })),
        ...masraflar.map((m: any) => ({
            id: `masraf-${m.id}`,
            aracId: m.aracId,
            tarih: m.tarih,
            tur: m.tur,
            aracPlaka: m.arac?.plaka || "-",
            aracSirket: m.arac?.sirket?.ad || null,
            detay: 'Muhtelif Gider',
            tutar: m.tutar
        })),
        ...muayeneler.map((m: any) => ({
            id: `muayene-${m.id}`,
            aracId: m.aracId,
            tarih: m.muayeneTarihi,
            tur: 'Muayene Ücreti',
            aracPlaka: m.arac?.plaka || "-",
            aracSirket: m.arac?.sirket?.ad || null,
            detay: `Geçerlilik: ${new Date(m.gecerlilikTarihi).toLocaleString("tr-TR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            })}`,
            tutar: m.tutar || 0
        }))
    ].sort((a: any, b: any) => b.tarih.getTime() - a.tarih.getTime());

    return <FinansClient initialRecords={unifiedLedger as any} yakitMetrics={metricsData} />;
}
