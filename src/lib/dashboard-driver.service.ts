import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DashboardDateContext, DashboardDriverCostItem, GenericWhere } from "@/lib/dashboard-types";
import { getVehicleUsageScopeWhere, toNumber } from "@/lib/dashboard-helpers";

type DriverAccumulator = {
    soforId: string;
    adSoyad: string;
    ceza: number;
    yakit: number;
    yakitLitre: number;
    ariza: number;
    toplam: number;
};

type DriverYakitRow = {
    aracId: string;
    tarih: Date;
    tutar: number;
    litre: number;
    soforId: string | null;
    arac?: { kullaniciId: string | null } | null;
};

type DriverArizaRow = {
    aracId: string;
    bakimTarihi: Date;
    tutar: number;
    soforId: string | null;
    arac?: { kullaniciId: string | null } | null;
};

type DriverCezaRow = {
    soforId: string | null;
    tutar: number;
};

function getAverage(values: number[]) {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
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
            yakitLitre: 0,
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
    activeDriverIds: Set<string>;
    zimmetByAracId: Record<string, Array<{ kullaniciId: string; baslangic: number; bitis: number | null }>>;
}) {
    const { cezaRows, yakitRows, arizaRows, adSoyadMap, activeDriverIds, zimmetByAracId } = params;
    const map: Record<string, DriverAccumulator> = {};

    for (const ceza of cezaRows) {
        if (!ceza.soforId) continue;
        if (!activeDriverIds.has(ceza.soforId)) continue;
        const row = getOrCreateDriverCost(map, ceza.soforId, adSoyadMap);
        row.ceza += toNumber(ceza.tutar);
        row.toplam += toNumber(ceza.tutar);
    }

    for (const yakit of yakitRows) {
        const soforId =
            yakit.soforId ||
            findDriverAtDate(zimmetByAracId, yakit.aracId, yakit.tarih);
        if (!soforId) continue;
        if (!activeDriverIds.has(soforId)) continue;
        const row = getOrCreateDriverCost(map, soforId, adSoyadMap);
        row.yakit += toNumber(yakit.tutar);
        row.yakitLitre += toNumber(yakit.litre);
        row.toplam += toNumber(yakit.tutar);
    }

    for (const ariza of arizaRows) {
        const soforId =
            ariza.soforId ||
            findDriverAtDate(zimmetByAracId, ariza.aracId, ariza.bakimTarihi);
        if (!soforId) continue;
        if (!activeDriverIds.has(soforId)) continue;
        const row = getOrCreateDriverCost(map, soforId, adSoyadMap);
        row.ariza += toNumber(ariza.tutar);
        row.toplam += toNumber(ariza.tutar);
    }

    return Object.values(map)
        .filter((row) => row.toplam > 0 || row.yakitLitre > 0)
        .sort((a, b) => (b.toplam - a.toplam) || (b.yakitLitre - a.yakitLitre));
}

export async function getDashboardDriverData(params: {
    scope: GenericWhere;
    cezaScope: GenericWhere;
    dateContext: DashboardDateContext;
    vehicleScope?: GenericWhere;
}) {
    const { scope, dateContext, vehicleScope } = params;
    const { seciliAyBasi, seciliAySonu, oncekiDonemBasi, oncekiDonemSonu } = dateContext;
    const usageScopedVehicleWhere = {
        ...((vehicleScope || getVehicleUsageScopeWhere(scope)) as Prisma.AracWhereInput),
        deletedAt: null,
    } as Prisma.AracWhereInput;
    const expenseScope = getExpenseScopedWhere(scope, usageScopedVehicleWhere);

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
            where: {
                AND: [scope as Prisma.KullaniciWhereInput, { deletedAt: null }],
            },
            select: { id: true, ad: true, soyad: true },
        }),
        prisma.kullaniciZimmet.findMany({
            where: { arac: usageScopedVehicleWhere },
            select: { aracId: true, kullaniciId: true, baslangic: true, bitis: true },
        }),
        prisma.yakit.findMany({
            where: { ...(expenseScope as Prisma.YakitWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } },
            select: { aracId: true, tarih: true, tutar: true, litre: true, soforId: true, arac: { select: { kullaniciId: true } } },
        }),
        prisma.bakim.findMany({
            where: {
                ...(expenseScope as Prisma.BakimWhereInput),
                bakimTarihi: { gte: seciliAyBasi, lte: seciliAySonu },
            },
            select: { aracId: true, bakimTarihi: true, tutar: true, soforId: true, arac: { select: { kullaniciId: true } } },
        }),
        prisma.ceza.findMany({
            where: { ...(expenseScope as Prisma.CezaWhereInput), tarih: { gte: seciliAyBasi, lte: seciliAySonu } },
            select: { soforId: true, tutar: true },
        }),
        prisma.yakit.findMany({
            where: { ...(expenseScope as Prisma.YakitWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } },
            select: { aracId: true, tarih: true, tutar: true, litre: true, soforId: true, arac: { select: { kullaniciId: true } } },
        }),
        prisma.bakim.findMany({
            where: {
                ...(expenseScope as Prisma.BakimWhereInput),
                bakimTarihi: { gte: oncekiDonemBasi, lte: oncekiDonemSonu },
            },
            select: { aracId: true, bakimTarihi: true, tutar: true, soforId: true, arac: { select: { kullaniciId: true } } },
        }),
        prisma.ceza.findMany({
            where: { ...(expenseScope as Prisma.CezaWhereInput), tarih: { gte: oncekiDonemBasi, lte: oncekiDonemSonu } },
            select: { soforId: true, tutar: true },
        }),
    ]);

    const adSoyadMap: Record<string, string> = {};
    const activeDriverIds = new Set<string>();
    for (const kullanici of kullanicilar) {
        adSoyadMap[kullanici.id] = `${kullanici.ad} ${kullanici.soyad}`.trim();
        activeDriverIds.add(kullanici.id);
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
        activeDriverIds,
        zimmetByAracId,
    });
    const previousRows = buildDriverCosts({
        cezaRows: cezaRowsPrevious,
        yakitRows: yakitRowsPrevious,
        arizaRows: arizaRowsPrevious,
        adSoyadMap,
        activeDriverIds,
        zimmetByAracId,
    });

    const currentCostRows = currentRows.filter((row) => row.toplam > 0);
    const previousCostRows = previousRows.filter((row) => row.toplam > 0);
    const driverCostReport: DashboardDriverCostItem[] = currentRows;

    return {
        driverCostReport,
        ortalamaSoforMaliyeti: getAverage(currentCostRows.map((row) => row.toplam)),
        oncekiOrtalamaSoforMaliyeti: getAverage(previousCostRows.map((row) => row.toplam)),
        soforMaliyetOrtalamaAdet: currentCostRows.length,
    };
}
