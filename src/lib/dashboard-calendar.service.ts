import { Prisma } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatDateKey } from "@/lib/dashboard-helpers";
import type {
    DashboardCalendarEvent,
    DashboardDateContext,
    DashboardData,
    DashboardEventStatus,
    GenericWhere,
} from "@/lib/dashboard-types";

type EvrakLatestRecord = {
    id: string;
    aracId: string;
    gecerlilikTarihi: Date;
};

function isWithinSelectedRange(date: Date | null | undefined, rangeStart: Date, rangeEnd: Date) {
    if (!date) return false;
    const time = date.getTime();
    return time >= rangeStart.getTime() && time <= rangeEnd.getTime();
}

function buildLatestMap<T extends EvrakLatestRecord>(records: T[]) {
    const map = new Map<string, T>();
    for (const item of records) {
        if (!item?.aracId) continue;
        if (!map.has(item.aracId)) {
            map.set(item.aracId, item);
        }
    }
    return map;
}

function getEventStatus(daysLeft: number): DashboardEventStatus {
    if (daysLeft < 0) return "GECIKTI";
    if (daysLeft <= 15) return "KRITIK";
    if (daysLeft <= 30) return "YAKLASTI";
    return "PLANLI";
}

export async function getDashboardCalendarData(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    dateContext: DashboardDateContext;
}) {
    const { scope, cezaScope, dateContext } = params;
    const { bugun, seciliAyBasi, seciliAySonu } = dateContext;

    const araclar = await prisma.arac.findMany({
        where: scope as Prisma.AracWhereInput,
        select: {
            id: true,
            plaka: true,
            marka: true,
            sirket: { select: { ad: true } },
        },
    });

    const aracIds = araclar.map((row) => row.id);
    if (!aracIds.length) {
        return {
            alerts: [] as DashboardData["alerts"],
            kritikUyariSayisi: 0,
            calendarEvents: [] as DashboardCalendarEvent[],
        };
    }

    const [muayeneRows, kaskoRows, trafikRows, unpaidCezalar] = await Promise.all([
        prisma.muayene.findMany({
            where: { ...(scope as Prisma.MuayeneWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { muayeneTarihi: "desc" }, { gecerlilikTarihi: "desc" }],
            select: { id: true, aracId: true, gecerlilikTarihi: true },
        }),
        prisma.kasko.findMany({
            where: { ...(scope as Prisma.KaskoWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { baslangicTarihi: "desc" }, { bitisTarihi: "desc" }],
            select: { id: true, aracId: true, bitisTarihi: true },
        }),
        prisma.trafikSigortasi.findMany({
            where: { ...(scope as Prisma.TrafikSigortasiWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { baslangicTarihi: "desc" }, { bitisTarihi: "desc" }],
            select: { id: true, aracId: true, bitisTarihi: true },
        }),
        prisma.ceza.findMany({
            where: {
                AND: [
                    cezaScope as Prisma.CezaWhereInput,
                    { odendiMi: { not: true } },
                    {
                        OR: [
                            { sonOdemeTarihi: { gte: seciliAyBasi, lte: seciliAySonu } },
                            { tarih: { gte: seciliAyBasi, lte: seciliAySonu } },
                        ],
                    },
                ],
            },
            select: {
                id: true,
                aracId: true,
                plaka: true,
                tarih: true,
                sonOdemeTarihi: true,
                arac: {
                    select: { plaka: true, marka: true, sirket: { select: { ad: true } } },
                },
            },
        }),
    ]);

    const latestMuayene = buildLatestMap(
        muayeneRows
            .filter((row) => Boolean(row.gecerlilikTarihi))
            .map((row) => ({ id: row.id, aracId: row.aracId, gecerlilikTarihi: row.gecerlilikTarihi }))
    );
    const latestKasko = buildLatestMap(
        kaskoRows
            .filter((row) => Boolean(row.bitisTarihi))
            .map((row) => ({ id: row.id, aracId: row.aracId, gecerlilikTarihi: row.bitisTarihi }))
    );
    const latestTrafik = buildLatestMap(
        trafikRows
            .filter((row) => Boolean(row.bitisTarihi))
            .map((row) => ({ id: row.id, aracId: row.aracId, gecerlilikTarihi: row.bitisTarihi }))
    );

    const alerts: DashboardData["alerts"] = [];
    const calendarEvents: DashboardCalendarEvent[] = [];

    for (const arac of araclar) {
        const base = {
            aracId: arac.id,
            plaka: arac.plaka || "-",
            aracMarka: arac.marka || "",
            sirketAd: arac.sirket?.ad || null,
        };

        const sonMuayene = latestMuayene.get(arac.id);
        if (sonMuayene && isWithinSelectedRange(sonMuayene.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
            const daysLeft = differenceInCalendarDays(sonMuayene.gecerlilikTarihi, bugun);
            if (daysLeft <= 15) {
                alerts.push({
                    id: `m-${sonMuayene.id}`,
                    aracId: arac.id,
                    plaka: arac.plaka,
                    message: daysLeft < 0 ? "Muayene Gecikti" : "Muayene Yaklaştı",
                    tarih: sonMuayene.gecerlilikTarihi.toISOString(),
                });
            }
            calendarEvents.push({
                ...base,
                id: `m-${sonMuayene.id}`,
                type: "MUAYENE",
                status: getEventStatus(daysLeft),
                title: "Muayene Son Geçerlilik",
                date: formatDateKey(sonMuayene.gecerlilikTarihi),
                daysLeft,
                href: "/dashboard/muayeneler",
            });
        }

        const sonKasko = latestKasko.get(arac.id);
        if (sonKasko && isWithinSelectedRange(sonKasko.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
            const daysLeft = differenceInCalendarDays(sonKasko.gecerlilikTarihi, bugun);
            if (daysLeft <= 15) {
                alerts.push({
                    id: `k-${sonKasko.id}`,
                    aracId: arac.id,
                    plaka: arac.plaka,
                    message: daysLeft < 0 ? "Kasko Gecikti" : "Kasko Bitiyor",
                    tarih: sonKasko.gecerlilikTarihi.toISOString(),
                });
            }
            calendarEvents.push({
                ...base,
                id: `k-${sonKasko.id}`,
                type: "KASKO",
                status: getEventStatus(daysLeft),
                title: "Kasko Bitiş",
                date: formatDateKey(sonKasko.gecerlilikTarihi),
                daysLeft,
                href: `/dashboard/kasko?yenileAracId=${arac.id}`,
            });
        }

        const sonTrafik = latestTrafik.get(arac.id);
        if (sonTrafik && isWithinSelectedRange(sonTrafik.gecerlilikTarihi, seciliAyBasi, seciliAySonu)) {
            const daysLeft = differenceInCalendarDays(sonTrafik.gecerlilikTarihi, bugun);
            if (daysLeft <= 15) {
                alerts.push({
                    id: `ts-${sonTrafik.id}`,
                    aracId: arac.id,
                    plaka: arac.plaka,
                    message: daysLeft < 0 ? "Trafik Poliçesi Gecikti" : "Trafik Poliçesi Bitiyor",
                    tarih: sonTrafik.gecerlilikTarihi.toISOString(),
                });
            }
            calendarEvents.push({
                ...base,
                id: `ts-${sonTrafik.id}`,
                type: "TRAFIK",
                status: getEventStatus(daysLeft),
                title: "Trafik Sigortası Bitiş",
                date: formatDateKey(sonTrafik.gecerlilikTarihi),
                daysLeft,
                href: `/dashboard/trafik-sigortasi?yenileAracId=${arac.id}`,
            });
        }
    }

    for (const ceza of unpaidCezalar) {
        const dueDateRaw = ceza.sonOdemeTarihi ?? ceza.tarih ?? null;
        if (!dueDateRaw) continue;
        const dueDate = new Date(dueDateRaw);
        if (Number.isNaN(dueDate.getTime())) continue;

        const daysLeft = differenceInCalendarDays(dueDate, bugun);
        calendarEvents.push({
            id: `c-${ceza.id}`,
            aracId: ceza.aracId || "",
            plaka: ceza.arac?.plaka || ceza.plaka || "-",
            aracMarka: ceza.arac?.marka || "",
            sirketAd: ceza.arac?.sirket?.ad || null,
            type: "CEZA",
            status: getEventStatus(daysLeft),
            title: "Ceza Son Ödeme (Ödenmedi)",
            date: formatDateKey(dueDate),
            daysLeft,
            href: "/dashboard/ceza-masraflari",
        });
    }

    alerts.sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime());
    calendarEvents.sort((a, b) => a.date.localeCompare(b.date));

    return {
        alerts: alerts.slice(0, 4),
        kritikUyariSayisi: alerts.length,
        calendarEvents,
    };
}
