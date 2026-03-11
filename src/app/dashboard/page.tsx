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
        (prisma as any).arac.count({ where: sirketFilter as any }),
        (prisma as any).arac.count({ where: { ...(sirketFilter as any), durum: { in: ['AKTIF', 'BOSTA'] } } }),
        (prisma as any).arac.count({ where: { ...(sirketFilter as any), durum: 'SERVISTE' } }),

        (prisma as any).yakit.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter as any), tarih: { gte: buAyBasi, lte: buAySonu } } }),
        (prisma as any).bakim.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter as any), bakimTarihi: { gte: buAyBasi, lte: buAySonu } } }),
        (prisma as any).masraf.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter as any), tarih: { gte: buAyBasi, lte: buAySonu } } }),

        (prisma as any).arac.groupBy({ where: sirketFilter as any, by: ['durum'], _count: { durum: true } }),

        (prisma as any).muayene.findMany({ where: { ...(sirketFilter as any), gecerlilikTarihi: { lte: onBesGunSonrasi, gte: bugun }, aktifMi: true }, include: { arac: true } }),
        (prisma as any).kasko.findMany({ where: { ...(sirketFilter as any), bitisTarihi: { lte: onBesGunSonrasi, gte: bugun }, aktifMi: true }, include: { arac: true } }),

        (prisma as any).yakit.groupBy({ where: sirketFilter as any, by: ['aracId'], _sum: { tutar: true } }),
        (prisma as any).bakim.groupBy({ where: sirketFilter as any, by: ['aracId'], _sum: { tutar: true } }),
        (prisma as any).masraf.groupBy({ where: sirketFilter as any, by: ['aracId'], _sum: { tutar: true } })
    ]);

    const aylikYakit = (yakitAggr as any)._sum.tutar || 0;
    const aylikBakim = (bakimAggr as any)._sum.tutar || 0;
    const aylikMasrafCount = (masrafAggr as any)._sum.tutar || 0;
    const aylikToplamGider = aylikYakit + aylikBakim + aylikMasrafCount;

    const durumData = (durumDagitimi as any[]).map((d: any) => ({ name: d.durum, value: d._count.durum }));

    const alerts = [
        ...(yaklasanMuayeneler as any[]).map((m: any) => ({ id: `m-${m.id}`, plaka: m.arac.plaka, message: "Muayene Yaklaştı", tarih: m.gecerlilikTarihi })),
        ...(yaklasanKaskolar as any[]).map((k: any) => ({ id: `k-${k.id}`, plaka: k.arac.plaka, message: "Kasko Bitiyor", tarih: k.bitisTarihi }))
    ].sort((a, b) => a.tarih.getTime() - b.tarih.getTime()).slice(0, 4);

    const kritikUyariSayisi = (yaklasanMuayeneler as any[]).length + (yaklasanKaskolar as any[]).length;
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
            (prisma as any).yakit.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter as any), tarih: { gte: start, lte: end } } }),
            (prisma as any).bakim.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter as any), bakimTarihi: { gte: start, lte: end } } }),
            (prisma as any).masraf.aggregate({ _sum: { tutar: true }, where: { ...(sirketFilter as any), tarih: { gte: start, lte: end } } })
        ]))
    );

    const son6AyTrend = son6AyQueries.map(({ start }, i) => {
        const [y, b, m] = trendResults[i];
        const total = ((y as any)._sum.tutar || 0) + ((b as any)._sum.tutar || 0) + ((m as any)._sum.tutar || 0);
        const ayIsmi = format(start, 'MMM', { locale: tr });
        return { name: ayIsmi.charAt(0).toUpperCase() + ayIsmi.slice(1), gider: total };
    });

    // ─── Top 5 masraflı araç ───
    const aracMasrafMap: Record<string, number> = {};
    (tumYakit as any[]).forEach((y: any) => { if (y.aracId) aracMasrafMap[y.aracId] = (aracMasrafMap[y.aracId] || 0) + (y._sum.tutar || 0); });
    (tumBakim as any[]).forEach((b: any) => { if (b.aracId) aracMasrafMap[b.aracId] = (aracMasrafMap[b.aracId] || 0) + (b._sum.tutar || 0); });
    (tumMasraf as any[]).forEach((m: any) => { if (m.aracId) aracMasrafMap[m.aracId] = (aracMasrafMap[m.aracId] || 0) + (m._sum.tutar || 0); });

    const sortedMasrafAracIdList = Object.entries(aracMasrafMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topAraclar = await (prisma as any).arac.findMany({
        where: { id: { in: sortedMasrafAracIdList.map(a => a[0]) } },
        select: { id: true, plaka: true }
    });

    const top5Masraf = sortedMasrafAracIdList.map(([id, tutar]) => ({
        plaka: (topAraclar as any[]).find((a: any) => a.id === id)?.plaka || 'Bilinmiyor',
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
