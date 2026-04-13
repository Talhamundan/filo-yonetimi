import { Prisma } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatDateKey, getVehicleUsageScopeWhere } from "@/lib/dashboard-helpers";
import type {
    DashboardArizaOncelik,
    DashboardCalendarEvent,
    DashboardDateContext,
    DashboardData,
    DashboardEventStatus,
    DashboardOperationArizaItem,
    GenericWhere,
} from "@/lib/dashboard-types";

type EvrakLatestRecord = {
    id: string;
    aracId: string;
    gecerlilikTarihi: Date;
};

type ArizaKaydiRow = {
    id: string;
    aracId: string;
    oncelik: DashboardArizaOncelik | null;
    durum: "ACIK" | "SERVISTE" | null;
    aciklama: string | null;
    bildirimTarihi: Date | null;
    arac: { plaka: string | null } | null;
};

type ArizaKaydiDelegate = {
    findMany?: (args: {
        where: Prisma.ArizaKaydiWhereInput;
        select: {
            id: true;
            aracId: true;
            oncelik: true;
            durum: true;
            aciklama: true;
            bildirimTarihi: true;
            arac: { select: { plaka: true } };
        };
    }) => Promise<ArizaKaydiRow[]>;
};

const ARIZA_PRIORITY_ORDER: Record<DashboardArizaOncelik, number> = {
    KRITIK: 0,
    YUKSEK: 0,
    ORTA: 2,
    DUSUK: 3,
};

function normalizeArizaOncelik(oncelik: DashboardArizaOncelik | null | undefined): DashboardArizaOncelik {
    if (oncelik === "KRITIK") return "YUKSEK";
    return oncelik || "ORTA";
}

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
    if (daysLeft <= 15) return "YUKSEK";
    if (daysLeft <= 30) return "YAKLASTI";
    return "PLANLI";
}

function getUsageScopedExpenseWhere(scope: GenericWhere): GenericWhere {
    const rawScope = (scope || {}) as Record<string, unknown>;
    const normalizedSirketId = typeof rawScope.sirketId === "string" ? rawScope.sirketId.trim() : "";
    if (!normalizedSirketId) {
        return scope;
    }

    const restScope = { ...rawScope };
    delete restScope.sirketId;

    const vehicleUsageWhere = getVehicleUsageScopeWhere({ sirketId: normalizedSirketId });
    const scopeParts: GenericWhere[] = [];
    if (Object.keys(restScope).length > 0) {
        scopeParts.push(restScope);
    }
    scopeParts.push({ arac: vehicleUsageWhere });

    return scopeParts.length === 1 ? scopeParts[0] : { AND: scopeParts };
}

function getExpenseScopedWhere(scope: GenericWhere, vehicleScope?: GenericWhere): GenericWhere {
    if (!vehicleScope || Object.keys((vehicleScope || {}) as Record<string, unknown>).length === 0) {
        return getUsageScopedExpenseWhere(scope);
    }

    const restScope = { ...((scope || {}) as Record<string, unknown>) };
    delete restScope.sirketId;

    const scopeParts: GenericWhere[] = [];
    if (Object.keys(restScope).length > 0) {
        scopeParts.push(restScope);
    }
    scopeParts.push({ arac: vehicleScope });

    return scopeParts.length === 1 ? scopeParts[0] : { AND: scopeParts };
}

export async function getDashboardCalendarData(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    dateContext: DashboardDateContext;
    vehicleScope?: GenericWhere;
}) {
    const { scope, cezaScope, dateContext, vehicleScope } = params;
    void cezaScope;
    const { bugun, normalizedYear } = dateContext;
    const seciliYilBasi = new Date(normalizedYear, 0, 1, 0, 0, 0, 0);
    const seciliYilSonu = new Date(normalizedYear, 11, 31, 23, 59, 59, 999);
    const usageScopedVehicleWhere = {
        ...((vehicleScope || getVehicleUsageScopeWhere(scope)) as Prisma.AracWhereInput),
        deletedAt: null,
    } as Prisma.AracWhereInput;
    const expenseScope = getExpenseScopedWhere(scope, usageScopedVehicleWhere);

    const araclar = await prisma.arac.findMany({
        where: usageScopedVehicleWhere,
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
            operationSummary: {
                kritik: 0,
                yuksek: 0,
                orta: 0,
                dusuk: 0,
                toplam: 0,
                serviste: 0,
            },
            operationArizalar: [] as DashboardOperationArizaItem[],
        };
    }

    const arizaModel = (prisma as unknown as { arizaKaydi?: ArizaKaydiDelegate }).arizaKaydi;
    const [muayeneRows, kaskoRows, trafikRows, unpaidCezalar, arizaRows] = await Promise.all([
        prisma.muayene.findMany({
            where: { ...(expenseScope as Prisma.MuayeneWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { muayeneTarihi: "desc" }, { gecerlilikTarihi: "desc" }],
            select: { id: true, aracId: true, gecerlilikTarihi: true },
        }),
        prisma.kasko.findMany({
            where: { ...(expenseScope as Prisma.KaskoWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { baslangicTarihi: "desc" }, { bitisTarihi: "desc" }],
            select: { id: true, aracId: true, bitisTarihi: true },
        }),
        prisma.trafikSigortasi.findMany({
            where: { ...(expenseScope as Prisma.TrafikSigortasiWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { baslangicTarihi: "desc" }, { bitisTarihi: "desc" }],
            select: { id: true, aracId: true, bitisTarihi: true },
        }),
        prisma.ceza.findMany({
            where: {
                AND: [
                    expenseScope as Prisma.CezaWhereInput,
                    { odendiMi: { not: true } },
                    {
                        OR: [
                            { sonOdemeTarihi: { gte: seciliYilBasi, lte: seciliYilSonu } },
                            { tarih: { gte: seciliYilBasi, lte: seciliYilSonu } },
                        ],
                    },
                    { deletedAt: null },
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
        arizaModel?.findMany
            ? arizaModel.findMany({
                  where: {
                      arac: usageScopedVehicleWhere,
                      durum: { in: ["ACIK", "SERVISTE"] },
                  },
                  select: {
                      id: true,
                      aracId: true,
                      oncelik: true,
                      durum: true,
                      aciklama: true,
                      bildirimTarihi: true,
                      arac: { select: { plaka: true } },
                  },
              })
            : Promise.resolve([]),
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
        if (sonMuayene && isWithinSelectedRange(sonMuayene.gecerlilikTarihi, seciliYilBasi, seciliYilSonu)) {
            const daysLeft = differenceInCalendarDays(sonMuayene.gecerlilikTarihi, bugun);
            if (daysLeft <= 15) {
                alerts.push({
                    id: `m-${sonMuayene.id}`,
                    aracId: arac.id,
                    plaka: arac.plaka || '-',
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
        if (sonKasko && isWithinSelectedRange(sonKasko.gecerlilikTarihi, seciliYilBasi, seciliYilSonu)) {
            const daysLeft = differenceInCalendarDays(sonKasko.gecerlilikTarihi, bugun);
            if (daysLeft <= 15) {
                alerts.push({
                    id: `k-${sonKasko.id}`,
                    aracId: arac.id,
                    plaka: arac.plaka || '-',
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
        if (sonTrafik && isWithinSelectedRange(sonTrafik.gecerlilikTarihi, seciliYilBasi, seciliYilSonu)) {
            const daysLeft = differenceInCalendarDays(sonTrafik.gecerlilikTarihi, bugun);
            if (daysLeft <= 15) {
                alerts.push({
                    id: `ts-${sonTrafik.id}`,
                    aracId: arac.id,
                    plaka: arac.plaka || '-',
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
        if (!isWithinSelectedRange(dueDate, seciliYilBasi, seciliYilSonu)) continue;

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

    const operationArizalar: DashboardOperationArizaItem[] = (arizaRows as ArizaKaydiRow[])
        .map((row) => ({
            id: row.id,
            aracId: row.aracId,
            plaka: row.arac?.plaka || "-",
            oncelik: normalizeArizaOncelik((row.oncelik || "ORTA") as DashboardArizaOncelik),
            durum: (row.durum === "SERVISTE" ? "SERVISTE" : "ACIK") as "SERVISTE" | "ACIK",
            aciklama: row.aciklama || "Arıza kaydı",
            bildirimTarihi: new Date(row.bildirimTarihi || new Date()).toISOString(),
        }))
        .sort((a, b) => {
            const priorityDiff = ARIZA_PRIORITY_ORDER[a.oncelik] - ARIZA_PRIORITY_ORDER[b.oncelik];
            if (priorityDiff !== 0) return priorityDiff;
            return new Date(b.bildirimTarihi).getTime() - new Date(a.bildirimTarihi).getTime();
        });

    const operationSummary = {
        kritik: 0,
        yuksek: operationArizalar.filter((row) => row.oncelik === "YUKSEK").length,
        orta: operationArizalar.filter((row) => row.oncelik === "ORTA").length,
        dusuk: operationArizalar.filter((row) => row.oncelik === "DUSUK").length,
        toplam: operationArizalar.length,
        serviste: operationArizalar.filter((row) => row.durum === "SERVISTE").length,
    };

    return {
        alerts: alerts.slice(0, 4),
        kritikUyariSayisi: alerts.length,
        calendarEvents,
        operationSummary,
        operationArizalar,
    };
}
