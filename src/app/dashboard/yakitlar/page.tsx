import { prisma } from "../../../lib/prisma";
import YakitlarClient from "./client";
import { YakitRow } from "./columns";
import { getModelFilter, getPersonnelSelectFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { getActivePersonelId, getPersonelDisplayName } from "@/lib/personel-display";
import { buildFuelIntervalMetrics } from "@/lib/fuel-metrics";
import { buildTokenizedOrWhere } from "@/lib/search-query";
import { auth } from "@/auth";
import { canRoleAccessAllCompanies, isDriverRole } from "@/lib/policy";

function getVehicleUsageCompanyFilter(sirketId: string) {
    return {
        OR: [
            { kullanici: { sirketId, deletedAt: null } },
            {
                kullaniciGecmisi: {
                    some: {
                        bitis: null,
                        kullanici: { sirketId, deletedAt: null },
                    },
                },
            },
        ],
    };
}

export default async function YakitlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);

    const session = await auth();
    const role = session?.user?.rol || null;
    const rawCurrentSirketId = session?.user?.sirketId;
    const currentSirketId = typeof rawCurrentSirketId === "string" ? rawCurrentSirketId.trim() || null : null;
    const isSofor = isDriverRole(role);
    const hasGlobalCompanyAccess = canRoleAccessAllCompanies(role, currentSirketId);
    const selectedScopeSirketId = selectedSirketId?.trim() || null;
    const usageScopeSirketId = hasGlobalCompanyAccess ? selectedScopeSirketId : currentSirketId;

    const [defaultYakitFilter, defaultAracFilter, personelFilter] = await Promise.all([
        getModelFilter('yakit', selectedSirketId),
        getModelFilter('arac', selectedSirketId),
        getPersonnelSelectFilter(),
    ]);

    const queryFilter = isSofor
        ? (defaultYakitFilter as Record<string, unknown>)
        : usageScopeSirketId
            ? ({ arac: { deletedAt: null, ...(getVehicleUsageCompanyFilter(usageScopeSirketId) as any) } } as Record<string, unknown>)
            : ({ arac: { deletedAt: null } } as Record<string, unknown>);
    const aracFilter = isSofor
        ? (defaultAracFilter as Record<string, unknown>)
        : usageScopeSirketId
            ? ({ deletedAt: null, ...(getVehicleUsageCompanyFilter(usageScopeSirketId) as any) } as Record<string, unknown>)
            : ({ deletedAt: null } as Record<string, unknown>);

    const yakitWhere = withYilDateFilter((queryFilter || {}) as Record<string, unknown>, "tarih", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [yakitWhere as Record<string, unknown>];

    const qFilter = buildTokenizedOrWhere(commonFilters.q, (token) => [
        { istasyon: { contains: token, mode: "insensitive" } },
        { arac: { plaka: { contains: token, mode: "insensitive" } } },
        { arac: { marka: { contains: token, mode: "insensitive" } } },
        { arac: { model: { contains: token, mode: "insensitive" } } },
        { sofor: { ad: { contains: token, mode: "insensitive" } } },
        { sofor: { soyad: { contains: token, mode: "insensitive" } } },
    ]);
    if (qFilter) {
        whereParts.push(qFilter);
    }
    if (commonFilters.status && (commonFilters.status === "NAKIT" || commonFilters.status === "TASIT_TANIMA")) {
        whereParts.push({ odemeYontemi: commonFilters.status });
    }
    if (dateRange) {
        whereParts.push({ tarih: dateRange });
    }
    const scopedYakitWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const [yakitlar, araclar, personeller] = await Promise.all([
        (prisma as any).yakit.findMany({ 
            where: scopedYakitWhere as any,
            orderBy: { tarih: 'desc' }, 
            include: { 
                sofor: { select: { id: true, ad: true, soyad: true, deletedAt: true } },
                arac: {
                    include: {
                        sirket: { select: { ad: true } },
                        kullanici: { select: { id: true, ad: true, soyad: true, deletedAt: true } },
                        kullaniciGecmisi: {
                            where: { bitis: null },
                            orderBy: { baslangic: "desc" },
                            take: 1,
                            select: {
                                kullanici: { select: { id: true, ad: true, soyad: true, deletedAt: true } },
                            },
                        },
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
                durum: true,
                kullanici: { select: { id: true, ad: true, soyad: true, deletedAt: true } },
                kullaniciGecmisi: {
                    where: { bitis: null },
                    orderBy: { baslangic: "desc" },
                    take: 1,
                    select: {
                        kullanici: { select: { id: true, ad: true, soyad: true, deletedAt: true } },
                    },
                },
            },
            orderBy: { plaka: 'asc' } 
        }),
        (prisma as any).kullanici.findMany({
            where: {
                ...(personelFilter as any),
                rol: { not: "ADMIN" },
            },
            select: {
                id: true,
                ad: true,
                soyad: true,
                rol: true,
            },
            orderBy: [{ ad: "asc" }, { soyad: "asc" }],
        }).catch(() => [])
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
        const aracAktifSofor = row.arac?.kullaniciGecmisi?.[0]?.kullanici || row.arac?.kullanici || null;
        return {
            ...row,
            arac: row.arac
                ? {
                    ...row.arac,
                    kullanici: aracAktifSofor,
                }
                : row.arac,
            ortalamaYakit100Km: metric?.averageLitresPer100Km ?? null,
            ortalamaKmBasiMaliyet: metric?.averageCostPerKm ?? null,
            ortalamaYakitDistanceKm: metric?.distanceKm ?? null,
        };
    });

    return (
        <YakitlarClient
            initialYakitlar={yakitlarWithMetrics}
            araclar={(araclar as any[]).map((a) => {
                const aktifSofor = a.kullaniciGecmisi?.[0]?.kullanici || a.kullanici || null;
                return {
                id: a.id,
                plaka: a.plaka,
                marka: a.marka,
                model: a.model,
                durum: a.durum,
                bulunduguIl: a.bulunduguIl,
                guncelKm: a.guncelKm,
                aktifSoforId: getActivePersonelId(aktifSofor),
                aktifSofor: aktifSofor || null,
                aktifSoforAdSoyad: aktifSofor ? getPersonelDisplayName(aktifSofor) : null,
                kullaniciId: a.kullanici?.id || null,
                kullanici: a.kullanici || null,
            };
            })}
            personeller={personeller as any[]}
        />
    );
}
