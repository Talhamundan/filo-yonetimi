import { prisma } from "../../../lib/prisma";
import YakitlarClient from "./client";
import { YakitRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { getActivePersonelId, getPersonelDisplayName } from "@/lib/personel-display";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";

export default async function YakitlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const [queryFilter, aracFilter] = await Promise.all([
        getModelFilter('yakit', selectedSirketId),
        getModelFilter('arac', selectedSirketId),
    ]);
    const yakitWhere = withYilDateFilter((queryFilter || {}) as Record<string, unknown>, "tarih", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [yakitWhere as Record<string, unknown>];

    if (commonFilters.q) {
        const q = commonFilters.q;
        whereParts.push({
            OR: [
                { istasyon: { contains: q, mode: "insensitive" } },
                { arac: { plaka: { contains: q, mode: "insensitive" } } },
                { arac: { marka: { contains: q, mode: "insensitive" } } },
                { arac: { model: { contains: q, mode: "insensitive" } } },
                { sofor: { ad: { contains: q, mode: "insensitive" } } },
                { sofor: { soyad: { contains: q, mode: "insensitive" } } },
            ],
        });
    }
    if (commonFilters.status && (commonFilters.status === "NAKIT" || commonFilters.status === "TASIT_TANIMA")) {
        whereParts.push({ odemeYontemi: commonFilters.status });
    }
    if (dateRange) {
        whereParts.push({ tarih: dateRange });
    }
    const scopedYakitWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const [yakitlar, araclar] = await Promise.all([
        (prisma as any).yakit.findMany({ 
            where: scopedYakitWhere as any,
            orderBy: { tarih: 'desc' }, 
            include: { 
                sofor: { select: { id: true, ad: true, soyad: true, deletedAt: true } },
                arac: {
                    include: {
                        sirket: { select: { ad: true } },
                        kullanici: { select: { id: true, ad: true, soyad: true, deletedAt: true } }
                    }
                } 
            } 
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: {
                id: true,
                plaka: true,
                marka: true,
                model: true,
                bulunduguIl: true,
                guncelKm: true,
                kullanici: { select: { id: true, ad: true, soyad: true, deletedAt: true } },
            },
            orderBy: { plaka: 'asc' } 
        })
    ]);
    
    const rawYakitlar = yakitlar as any[];
    const { byCurrentRecordId } = buildFuelIntervalMetrics(
        rawYakitlar.map((row) => ({
            id: row.id,
            aracId: row.aracId,
            tarih: row.tarih,
            km: row.km,
            litre: row.litre,
            tutar: row.tutar,
            soforId: row.soforId ?? null,
        }))
    );
    const yakitlarWithMetrics: YakitRow[] = rawYakitlar.map((row) => {
        const metric = byCurrentRecordId.get(row.id);
        return {
            ...row,
            ortalamaYakit100Km: metric?.averageLitresPer100Km ?? null,
            ortalamaKmBasiMaliyet: metric?.averageCostPerKm ?? null,
            ortalamaYakitDistanceKm: metric?.distanceKm ?? null,
        };
    });

    return (
        <YakitlarClient
            initialYakitlar={yakitlarWithMetrics}
            araclar={(araclar as any[]).map((a) => ({
                id: a.id,
                plaka: a.plaka,
                marka: a.marka,
                model: a.model,
                bulunduguIl: a.bulunduguIl,
                guncelKm: a.guncelKm,
                aktifSoforId: getActivePersonelId(a.kullanici),
                aktifSoforAdSoyad: a.kullanici ? getPersonelDisplayName(a.kullanici) : null,
            }))}
        />
    );
}
