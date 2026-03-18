import { prisma } from "../../../lib/prisma";
import ZimmetlerClient from "./client";
import { SoforZimmetRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

type ZimmetCost = {
    ceza: number;
    yakit: number;
    ariza: number;
    toplam: number;
};

type ZimmetInterval = {
    id: string;
    baslangic: number;
    bitis: number | null;
};

function findZimmetIdForEvent(
    zimmetByAracId: Record<string, ZimmetInterval[]>,
    aracId: string,
    eventTime: number
) {
    const rows = zimmetByAracId[aracId];
    if (!rows?.length) return null;

    for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i];
        if (row.baslangic <= eventTime && (row.bitis === null || row.bitis >= eventTime)) {
            return row.id;
        }
    }

    return null;
}

export default async function ZimmetlerPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const filter = await getModelFilter('kullaniciZimmet', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const personelFilter = await getModelFilter('kullanici', selectedSirketId);
    const zimmetWhere = withYilDateFilter((filter || {}) as Record<string, unknown>, "baslangic", selectedYil);

    const [zimmetlerRaw, araclar, kullanicilar] = await Promise.all([
        (prisma as any).kullaniciZimmet.findMany({
            where: zimmetWhere as any,
            orderBy: { baslangic: 'desc' },
            include: {
                arac: { include: { sirket: { select: { ad: true } } } },
                kullanici: true
            }
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        }),
        (prisma as any).kullanici.findMany({
            where: personelFilter as any,
            select: { id: true, ad: true, soyad: true },
            orderBy: { ad: 'asc' }
        })
    ]);
    const zimmetler = zimmetlerRaw as Array<{
        id: string;
        aracId: string;
        baslangic: Date;
        bitis: Date | null;
    }>;

    const costsByZimmetId = new Map<string, ZimmetCost>();
    const upsertCost = (zimmetId: string | null, patch: Partial<ZimmetCost>) => {
        if (!zimmetId) return;
        const current = costsByZimmetId.get(zimmetId) || { ceza: 0, yakit: 0, ariza: 0, toplam: 0 };
        const next = {
            ceza: current.ceza + toNumber(patch.ceza),
            yakit: current.yakit + toNumber(patch.yakit),
            ariza: current.ariza + toNumber(patch.ariza),
            toplam: current.toplam + toNumber(patch.toplam),
        };
        costsByZimmetId.set(zimmetId, next);
    };

    if (zimmetler.length > 0) {
        const now = new Date();
        const aracIds = Array.from(new Set(zimmetler.map((z) => z.aracId).filter(Boolean)));
        const minBaslangic = zimmetler.reduce((min, z) => {
            const time = new Date(z.baslangic).getTime();
            return time < min ? time : min;
        }, Number.MAX_SAFE_INTEGER);
        const maxBitisOrNow = zimmetler.reduce((max, z) => {
            const time = z.bitis ? new Date(z.bitis).getTime() : now.getTime();
            return time > max ? time : max;
        }, 0);

        const rangeStart = new Date(minBaslangic);
        const rangeEnd = new Date(maxBitisOrNow);

        const [cezalar, yakitlar, arizalar] = await Promise.all([
            (prisma as any).ceza.findMany({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                },
                select: { aracId: true, tarih: true, tutar: true },
            }).catch(() => []),
            (prisma as any).yakit.findMany({
                where: {
                    aracId: { in: aracIds },
                    tarih: { gte: rangeStart, lte: rangeEnd },
                },
                select: { aracId: true, tarih: true, tutar: true },
            }).catch(() => []),
            (prisma as any).bakim.findMany({
                where: {
                    aracId: { in: aracIds },
                    bakimTarihi: { gte: rangeStart, lte: rangeEnd },
                    OR: [
                        { tur: "ARIZA" },
                        { kategori: "ARIZA" },
                    ],
                },
                select: { aracId: true, bakimTarihi: true, tutar: true },
            }).catch(() => []),
        ]);

        const zimmetByAracId: Record<string, ZimmetInterval[]> = {};
        for (const z of zimmetler) {
            if (!zimmetByAracId[z.aracId]) {
                zimmetByAracId[z.aracId] = [];
            }
            zimmetByAracId[z.aracId].push({
                id: z.id,
                baslangic: new Date(z.baslangic).getTime(),
                bitis: z.bitis ? new Date(z.bitis).getTime() : null,
            });
        }
        Object.values(zimmetByAracId).forEach((rows) => rows.sort((a, b) => a.baslangic - b.baslangic));

        for (const ceza of cezalar as Array<{ aracId: string; tarih: Date; tutar: number }>) {
            const zimmetId = findZimmetIdForEvent(
                zimmetByAracId,
                ceza.aracId,
                new Date(ceza.tarih).getTime()
            );
            const tutar = toNumber(ceza.tutar);
            upsertCost(zimmetId, { ceza: tutar, toplam: tutar });
        }

        for (const yakit of yakitlar as Array<{ aracId: string; tarih: Date; tutar: number }>) {
            const zimmetId = findZimmetIdForEvent(
                zimmetByAracId,
                yakit.aracId,
                new Date(yakit.tarih).getTime()
            );
            const tutar = toNumber(yakit.tutar);
            upsertCost(zimmetId, { yakit: tutar, toplam: tutar });
        }

        for (const ariza of arizalar as Array<{ aracId: string; bakimTarihi: Date; tutar: number }>) {
            const zimmetId = findZimmetIdForEvent(
                zimmetByAracId,
                ariza.aracId,
                new Date(ariza.bakimTarihi).getTime()
            );
            const tutar = toNumber(ariza.tutar);
            upsertCost(zimmetId, { ariza: tutar, toplam: tutar });
        }
    }

    const zimmetlerWithCost = (zimmetlerRaw as any[]).map((z) => {
        const maliyet = costsByZimmetId.get(z.id) || { ceza: 0, yakit: 0, ariza: 0, toplam: 0 };
        return {
            ...z,
            maliyetKalemleri: {
                ceza: maliyet.ceza,
                yakit: maliyet.yakit,
                ariza: maliyet.ariza,
            },
            toplamMaliyet: maliyet.toplam,
        };
    });

    return (
        <ZimmetlerClient 
            initialZimmetler={zimmetlerWithCost as unknown as SoforZimmetRow[]} 
            araclar={araclar}
            kullanicilar={kullanicilar.map((k: any) => ({ id: k.id, adSoyad: `${k.ad} ${k.soyad}` }))}
        />
    );
}
