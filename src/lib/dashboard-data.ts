import { prisma } from "@/lib/prisma"
import { differenceInCalendarDays, endOfMonth, format, startOfDay, startOfMonth, subMonths } from "date-fns"
import { tr } from "date-fns/locale"

export interface DashboardData {
  metrics: {
    aylikToplamGider: number
    kritikUyariSayisi: number
    verimlilikOrani: number
    ortalamaYakit: number
    aktifArac: number
    toplamArac: number
    servisteArac: number
  }
  durumData: { name: string; value: number }[]
  alerts: { id: string; plaka: string; message: string; tarih: string }[]
  sixMonthsTrend: { name: string; gider: number }[]
  top5Expenses: { plaka: string; tutar: number }[]
}

export async function getDashboardData(sirketFilter: Record<string, unknown> | null): Promise<DashboardData> {
  const bugun = startOfDay(new Date())
  const buAyBasi = startOfMonth(bugun)
  const buAySonu = endOfMonth(bugun)

  const [
    toplamArac,
    aktifArac,
    servisteArac,
    yakitAggr,
    bakimAggr,
    masrafAggr,
    durumDagitimi,
    aracEvraklari,
    tumYakit,
    tumBakim,
    tumMasraf,
  ] = await Promise.all([
    prisma.arac.count({ where: sirketFilter || {} }),
    prisma.arac.count({ where: { ...(sirketFilter || {}), durum: { in: ["AKTIF", "BOSTA"] } } }),
    prisma.arac.count({ where: { ...(sirketFilter || {}), durum: "SERVISTE" } }),
    prisma.yakit.aggregate({
      _sum: { tutar: true },
      where: { ...(sirketFilter || {}), tarih: { gte: buAyBasi, lte: buAySonu } },
    }),
    prisma.bakim.aggregate({
      _sum: { tutar: true },
      where: { ...(sirketFilter || {}), bakimTarihi: { gte: buAyBasi, lte: buAySonu } },
    }),
    prisma.masraf.aggregate({
      _sum: { tutar: true },
      where: { ...(sirketFilter || {}), tarih: { gte: buAyBasi, lte: buAySonu } },
    }),
    prisma.arac.groupBy({ where: sirketFilter || {}, by: ["durum"], _count: { durum: true } }),
    prisma.arac.findMany({
      where: {
        ...(sirketFilter || {}),
      },
      select: {
        id: true,
        plaka: true,
        muayene: {
          orderBy: { muayeneTarihi: "desc" },
          take: 1,
          select: { id: true, gecerlilikTarihi: true },
        },
        kasko: {
          orderBy: { bitisTarihi: "desc" },
          take: 1,
          select: { id: true, bitisTarihi: true },
        },
        trafikSigortasi: {
          orderBy: { bitisTarihi: "desc" },
          take: 1,
          select: { id: true, bitisTarihi: true },
        },
      },
    }),
    prisma.yakit.groupBy({ where: sirketFilter || {}, by: ["aracId"], _sum: { tutar: true } }),
    prisma.bakim.groupBy({ where: sirketFilter || {}, by: ["aracId"], _sum: { tutar: true } }),
    prisma.masraf.groupBy({ where: sirketFilter || {}, by: ["aracId"], _sum: { tutar: true } }),
  ])

  const aylikYakit = yakitAggr._sum.tutar || 0
  const aylikBakim = bakimAggr._sum.tutar || 0
  const aylikMasrafCount = masrafAggr._sum.tutar || 0
  const aylikToplamGider = aylikYakit + aylikBakim + aylikMasrafCount

  const durumData = durumDagitimi.map((d: any) => ({ name: d.durum, value: d._count.durum }))

  const tumKritikUyarilar = aracEvraklari.flatMap((arac: any) => {
    const aracUyarilari: DashboardData["alerts"] = []
    const sonMuayene = arac.muayene[0]
    const sonKasko = arac.kasko[0]
    const sonTrafikSigortasi = arac.trafikSigortasi[0]

    if (sonMuayene) {
      const kalanGun = differenceInCalendarDays(sonMuayene.gecerlilikTarihi, bugun)
      if (kalanGun <= 15) {
        aracUyarilari.push({
          id: `m-${sonMuayene.id}`,
          plaka: arac.plaka,
          message: kalanGun < 0 ? "Muayene Gecikti" : "Muayene Yaklaştı",
          tarih: sonMuayene.gecerlilikTarihi.toISOString(),
        })
      }
    }

    if (sonKasko) {
      const kalanGun = differenceInCalendarDays(sonKasko.bitisTarihi, bugun)
      if (kalanGun <= 15) {
        aracUyarilari.push({
          id: `k-${sonKasko.id}`,
          plaka: arac.plaka,
          message: kalanGun < 0 ? "Kasko Gecikti" : "Kasko Bitiyor",
          tarih: sonKasko.bitisTarihi.toISOString(),
        })
      }
    }

    if (sonTrafikSigortasi) {
      const kalanGun = differenceInCalendarDays(sonTrafikSigortasi.bitisTarihi, bugun)
      if (kalanGun <= 15) {
        aracUyarilari.push({
          id: `ts-${sonTrafikSigortasi.id}`,
          plaka: arac.plaka,
          message: kalanGun < 0 ? "Trafik Poliçesi Gecikti" : "Trafik Poliçesi Bitiyor",
          tarih: sonTrafikSigortasi.bitisTarihi.toISOString(),
        })
      }
    }

    return aracUyarilari
  })

  const alerts = tumKritikUyarilar
    .sort((a: any, b: any) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime())
    .slice(0, 4)

  const kritikUyariSayisi = tumKritikUyarilar.length
  const verimlilikOrani = toplamArac > 0 ? Math.round((aktifArac / toplamArac) * 100) : 0
  const ortalamaYakit = aktifArac > 0 ? Math.round(aylikYakit / aktifArac) : 0

  const son6AyQueries = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(bugun, 5 - i)
    const start = startOfMonth(d)
    const end = endOfMonth(d)
    return { d, start, end }
  })

  const trendResults = await Promise.all(
    son6AyQueries.map(({ start, end }) =>
      Promise.all([
        prisma.yakit.aggregate({
          _sum: { tutar: true },
          where: { ...(sirketFilter || {}), tarih: { gte: start, lte: end } },
        }),
        prisma.bakim.aggregate({
          _sum: { tutar: true },
          where: { ...(sirketFilter || {}), bakimTarihi: { gte: start, lte: end } },
        }),
        prisma.masraf.aggregate({
          _sum: { tutar: true },
          where: { ...(sirketFilter || {}), tarih: { gte: start, lte: end } },
        }),
      ]),
    ),
  )

  const sixMonthsTrend = son6AyQueries.map(({ start }, i) => {
    const [y, b, m] = trendResults[i]
    const total = (y._sum.tutar || 0) + (b._sum.tutar || 0) + (m._sum.tutar || 0)
    const ayIsmi = format(start, "MMM", { locale: tr })
    return { name: ayIsmi.charAt(0).toUpperCase() + ayIsmi.slice(1), gider: total }
  })

  const aracMasrafMap: Record<string, number> = {}
  tumYakit.forEach((y: any) => {
    if (y.aracId) aracMasrafMap[y.aracId] = (aracMasrafMap[y.aracId] || 0) + (y._sum.tutar || 0)
  })
  tumBakim.forEach((b: any) => {
    if (b.aracId) aracMasrafMap[b.aracId] = (aracMasrafMap[b.aracId] || 0) + (b._sum.tutar || 0)
  })
  tumMasraf.forEach((m: any) => {
    if (m.aracId) aracMasrafMap[m.aracId] = (aracMasrafMap[m.aracId] || 0) + (m._sum.tutar || 0)
  })

  const sortedMasrafAracIdList = Object.entries(aracMasrafMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const topAraclar = await prisma.arac.findMany({
    where: { id: { in: sortedMasrafAracIdList.map((a) => a[0]) } },
    select: { id: true, plaka: true },
  })

  const top5Expenses = sortedMasrafAracIdList.map(([id, tutar]) => ({
    plaka: topAraclar.find((a: any) => a.id === id)?.plaka || "Bilinmiyor",
    tutar,
  }))

  return {
    metrics: {
      aylikToplamGider,
      kritikUyariSayisi,
      verimlilikOrani,
      ortalamaYakit,
      aktifArac,
      toplamArac,
      servisteArac,
    },
    durumData,
    alerts,
    sixMonthsTrend,
    top5Expenses,
  }
}
