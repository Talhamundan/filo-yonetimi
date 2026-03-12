import { prisma } from "../../lib/prisma";
import DashboardClient from "../../components/dashboard/DashboardClient";
import { addDays, startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { tr } from "date-fns/locale";
import { getSirketFilter } from "@/lib/auth-utils";

export default async function DashboardOverview() {
    const sirketFilter = await getSirketFilter(); // cache() sayesinde 1 JWT doğrulaması
    const bugun = new Date();
    const buAyBasi = startOfMonth(bugun);
    const buAySonu = endOfMonth(bugun);
    const onBesGunSonrasi = addDays(bugun, 15);

    // ─── Temel sorguları PARALEL çalıştır ───
    const [
        toplamArac, aktifArac, servisteArac,
        yakitAggr, bakimAggr, masrafAggr,
        durumDagitimi,
        yaklasanMuayeneler, yaklasanKaskolar,
        tumYakit, tumBakim, tumMasraf
    ] = await Promise.all([
        prisma.arac.count({ where: sirketFilter || {} }),
        prisma.arac.count({ where: { ...(sirketFilter || {}), durum: { in: ['AKTIF', 'BOSTA'] } } }),
        prisma.arac.count({ where: { ...(sirketFilter || {}), durum: 'SERVISTE' } }),

        prisma.yakit.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter || {}), tarih: { gte: buAyBasi, lte: buAySonu } } }),
        prisma.bakim.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter || {}), bakimTarihi: { gte: buAyBasi, lte: buAySonu } } }),
        prisma.masraf.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter || {}), tarih: { gte: buAyBasi, lte: buAySonu } } }),

        prisma.arac.groupBy({ where: sirketFilter || {}, by: ['durum'], _count: { durum: true } }),

        prisma.muayene.findMany({ where: { ...(sirketFilter || {}), gecerlilikTarihi: { lte: onBesGunSonrasi, gte: bugun }, aktifMi: true }, include: { arac: true } }),
        prisma.kasko.findMany({ where: { ...(sirketFilter || {}), bitisTarihi: { lte: onBesGunSonrasi, gte: bugun }, aktifMi: true }, include: { arac: true } }),

        prisma.yakit.groupBy({ where: sirketFilter || {}, by: ['aracId'], _sum: { tutar: true } }),
        prisma.bakim.groupBy({ where: sirketFilter || {}, by: ['aracId'], _sum: { tutar: true } }),
        prisma.masraf.groupBy({ where: sirketFilter || {}, by: ['aracId'], _sum: { tutar: true } })
    ]);

    const aylikYakit = yakitAggr._sum.tutar || 0;
    const aylikBakim = bakimAggr._sum.tutar || 0;
    const aylikMasrafCount = masrafAggr._sum.tutar || 0;
    const aylikToplamGider = aylikYakit + aylikBakim + aylikMasrafCount;

    const durumData = durumDagitimi.map((d: any) => ({ name: d.durum, value: d._count.durum }));

    const alerts = [
        ...yaklasanMuayeneler.map((m: any) => ({ id: `m-${m.id}`, plaka: m.arac.plaka, message: "Muayene Yaklaştı", tarih: m.gecerlilikTarihi })),
        ...yaklasanKaskolar.map((k: any) => ({ id: `k-${k.id}`, plaka: k.arac.plaka, message: "Kasko Bitiyor", tarih: k.bitisTarihi }))
    ].sort((a, b) => a.tarih.getTime() - b.tarih.getTime()).slice(0, 4);

    const kritikUyariSayisi = yaklasanMuayeneler.length + yaklasanKaskolar.length;
    const verimlilikOrani = toplamArac > 0 ? Math.round((aktifArac / toplamArac) * 100) : 0;
    const ortalamaYakit = aktifArac > 0 ? Math.round(aylikYakit / aktifArac) : 0;

    // ─── Son 6 Ay Trendi - TÜM AYLAR PARALEL ───
    const son6AyQueries = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(bugun, 5 - i);
        const start = startOfMonth(d);
        const end = endOfMonth(d);
        return { d, start, end };
    });

    const trendResults = await Promise.all(
        son6AyQueries.map(({ start, end }) => Promise.all([
            prisma.yakit.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter || {}), tarih: { gte: start, lte: end } } }),
            prisma.bakim.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter || {}), bakimTarihi: { gte: start, lte: end } } }),
            prisma.masraf.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter || {}), tarih: { gte: start, lte: end } } })
        ]))
    );

    const son6AyTrend = son6AyQueries.map(({ start }, i) => {
        const [y, b, m] = trendResults[i];
        const total = (y._sum.tutar || 0) + (b._sum.tutar || 0) + (m._sum.tutar || 0);
        const ayIsmi = format(start, 'MMM', { locale: tr });
        return { name: ayIsmi.charAt(0).toUpperCase() + ayIsmi.slice(1), gider: total };
    });

    // ─── Top 5 masraflı araç ───
    const aracMasrafMap: Record<string, number> = {};
    tumYakit.forEach((y: any) => { if (y.aracId) aracMasrafMap[y.aracId] = (aracMasrafMap[y.aracId] || 0) + (y._sum.tutar || 0); });
    tumBakim.forEach((b: any) => { if (b.aracId) aracMasrafMap[b.aracId] = (aracMasrafMap[b.aracId] || 0) + (b._sum.tutar || 0); });
    tumMasraf.forEach((m: any) => { if (m.aracId) aracMasrafMap[m.aracId] = (aracMasrafMap[m.aracId] || 0) + (m._sum.tutar || 0); });

    const sortedMasrafAracIdList = Object.entries(aracMasrafMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topAraclar = await prisma.arac.findMany({
        where: { id: { in: sortedMasrafAracIdList.map(a => a[0]) } },
        select: { id: true, plaka: true }
    });

    const top5Masraf = sortedMasrafAracIdList.map(([id, tutar]) => ({
        plaka: topAraclar.find((a: any) => a.id === id)?.plaka || 'Bilinmiyor',
        tutar
    }));

    return (
        <DashboardClient
            metrics={{ aylikToplamGider, kritikUyariSayisi, verimlilikOrani, ortalamaYakit, aktifArac, toplamArac, servisteArac }}
            durumData={durumData}
            alerts={alerts.map(a => ({ ...a, tarih: a.tarih.toISOString() }))}
            sixMonthsTrend={son6AyTrend}
            top5Expenses={top5Masraf}
        />
    );
}
