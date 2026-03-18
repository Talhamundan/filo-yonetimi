import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DashboardDateContext, DashboardDriverCostItem, GenericWhere } from "@/lib/dashboard-types";
import { toNumber } from "@/lib/dashboard-helpers";

type DriverAccumulator = {
    soforId: string;
    adSoyad: string;
    ceza: number;
    yakit: number;
    ariza: number;
    toplam: number;
};

type DriverYakitRow = {
    aracId: string;
    tarih: Date;
    tutar: number;
    soforId: string | null;
};

type DriverArizaRow = {
    aracId: string;
    bakimTarihi: Date;
    tutar: number;
};

type DriverCezaRow = {
    soforId: string | null;
    tutar: number;
};

function getAverage(values: number[]) {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function findDriverAtDate(
    zimmetByAracId: Record<string, Array<{ kullaniciId: string; baslangic: number; bitis: number | null }>>,
    aracId: string,
    date: Date
) {
    const rows = zimmetByAracId[aracId];
    if (!rows?.length) return null;
    const target = date.getTime();

    for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (row.baslangic <= target && (row.bitis === null || row.bitis >= target)) {
            return row.kullaniciId;
        }
    }

    return null;
}

function getOrCreateDriverCost(
    map: Record<string, DriverAccumulator>,
    soforId: string,
    adSoyadMap: Record<string, string>
) {
    if (!map[soforId]) {
        map[soforId] = {
            soforId,
            adSoyad: adSoyadMap[soforId] || "Bilinmeyen Şoför",
            ceza: 0,
            yakit: 0,
            ariza: 0,
            toplam: 0,
        };
    }
    return map[soforId];
}

function buildDriverCosts(params: {
    cezaRows: DriverCezaRow[];
    yakitRows: DriverYakitRow[];
    arizaRows: DriverArizaRow[];
    adSoyadMap: Record<string, string>;
    zimmetByAracId: Record<string, Array<{ kullaniciId: string; baslangic: number; bitis: number | null }>>;
}) {
    const { cezaRows, yakitRows, arizaRows, adSoyadMap, zimmetByAracId } = params;
    const map: Record<string, DriverAccumulator> = {};

    for (const ceza of cezaRows) {
        if (!ceza.soforId) continue;
        const row = getOrCreateDriverCost(map, ceza.soforId, adSoyadMap);
        row.ceza += toNumber(ceza.tutar);
        row.toplam += toNumber(ceza.tutar);
    }

    for (const yakit of yakitRows) {
        const soforId = yakit.soforId || findDriverAtDate(zimmetByAracId, yakit.aracId, yakit.tarih);
        if (!soforId) continue;
        const row = getOrCreateDriverCost(map, soforId, adSoyadMap);
        row.yakit += toNumber(yakit.tutar);
        row.toplam += toNumber(yakit.tutar);
    }

    for (const ariza of arizaRows) {
        const soforId = findDriverAtDate(zimmetByAracId, ariza.aracId, ariza.bakimTarihi);
        if (!soforId) continue;
        const row = getOrCreateDriverCost(map, soforId, adSoyadMap);
        row.ariza += toNumber(ariza.tutar);
        row.toplam += toNumber(ariza.tutar);
    }

    return Object.values(map)
        .filter((row) => row.toplam > 0)
        .sort((a, b) => b.toplam - a.toplam);
}

export async function getDashboardDriverData(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    dateContext: DashboardDateContext;
}) {
    const { scope, cezaScope, dateContext } = params;
    const { seciliAyBasi, seciliAySonu, oncekiDonemBasi, oncekiDonemSonu } = dateContext;

    const [
        kullanicilar,
        tumZimmetler,
        yakitRowsCurrent,
        arizaRowsCurrent,
        cezaRowsCurrent,
        yakitRowsPrevious,
        arizaRowsPrevious,
        cezaRowsPrevious,
    ] = await Promise.all([
        prisma.kullanici.findMany({
            where: scope as Prisma.KullaniciWhereInput,
            select: { id: true, ad: true, soyad: true },
        }),
        prisma.kullaniciZimmet.findMany({
            where: { arac: scope as Prisma.AracWhereInput },
            select: { aracId: true, kullaniciId: true, baslangic: true, bitis: true },
        }),
        prisma.yakit.findMany({
            where: { ...(scope as Prisma.YakitWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } },
            select: { aracId: true, tarih: true, tutar: true, soforId: true },
        }),
        prisma.bakim.findMany({
            where: {
                ...(scope as Prisma.BakimWhereInput),
                tur: "ARIZA",
                bakimTarihi: { gte: seciliAyBasi, lte: seciliAySonu },
            },
            select: { aracId: true, bakimTarihi: true, tutar: true },
        }),
        prisma.ceza.findMany({
            where: { ...(cezaScope as Prisma.CezaWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } },
            select: { soforId: true, tutar: true },
        }),
        prisma.yakit.findMany({
            where: { ...(scope as Prisma.YakitWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } },
            select: { aracId: true, tarih: true, tutar: true, soforId: true },
        }),
        prisma.bakim.findMany({
            where: {
                ...(scope as Prisma.BakimWhereInput),
                tur: "ARIZA",
                bakimTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu },
            },
            select: { aracId: true, bakimTarihi: true, tutar: true },
        }),
        prisma.ceza.findMany({
            where: { ...(cezaScope as Prisma.CezaWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } },
            select: { soforId: true, tutar: true },
        }),
    ]);

    const adSoyadMap: Record<string, string> = {};
    for (const kullanici of kullanicilar) {
        adSoyadMap[kullanici.id] = `${kullanici.ad} ${kullanici.soyad}`.trim();
    }

    const zimmetByAracId: Record<string, Array<{ kullaniciId: string; baslangic: number; bitis: number | null }>> = {};
    for (const zimmet of tumZimmetler) {
        if (!zimmetByAracId[zimmet.aracId]) {
            zimmetByAracId[zimmet.aracId] = [];
        }
        zimmetByAracId[zimmet.aracId].push({
            kullaniciId: zimmet.kullaniciId,
            baslangic: zimmet.baslangic.getTime(),
            bitis: zimmet.bitis ? zimmet.bitis.getTime() : null,
        });
    }
    Object.values(zimmetByAracId).forEach((rows) => rows.sort((a, b) => a.baslangic - b.baslangic));

    const currentRows = buildDriverCosts({
        cezaRows: cezaRowsCurrent,
        yakitRows: yakitRowsCurrent,
        arizaRows: arizaRowsCurrent,
        adSoyadMap,
        zimmetByAracId,
    });
    const previousRows = buildDriverCosts({
        cezaRows: cezaRowsPrevious,
        yakitRows: yakitRowsPrevious,
        arizaRows: arizaRowsPrevious,
        adSoyadMap,
        zimmetByAracId,
    });

    const driverCostReport: DashboardDriverCostItem[] = currentRows.slice(0, 10);

    return {
        driverCostReport,
        ortalamaSoforMaliyeti: getAverage(currentRows.map((row) => row.toplam)),
        oncekiOrtalamaSoforMaliyeti: getAverage(previousRows.map((row) => row.toplam)),
        soforMaliyetOrtalamaAdet: currentRows.length,
    };
}
