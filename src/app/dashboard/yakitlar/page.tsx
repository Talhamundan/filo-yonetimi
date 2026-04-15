import { prisma } from "../../../lib/prisma";
import YakitlarClient from "./client";
import { YakitRow } from "./columns";
import { getModelFilter, getPersonnelSelectFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
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
    const [selectedSirketId, selectedYil, selectedAy, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const { start: rangeStart, end: rangeEnd } = getAyDateRange(selectedYil, selectedAy);

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

    const yakitWhere = (queryFilter || {}) as Record<string, unknown>;
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [
        {
            ...yakitWhere,
            tarih: { gte: rangeStart, lte: rangeEnd }
        }
    ];

    const qFilter = buildTokenizedOrWhere(commonFilters.q, (token) => {
        const filters: any[] = [
            { istasyon: { contains: token, mode: "insensitive" } },
            { arac: { plaka: { contains: token, mode: "insensitive" } } },
            { arac: { marka: { contains: token, mode: "insensitive" } } },
            { arac: { model: { contains: token, mode: "insensitive" } } },
            { arac: { calistigiKurum: { contains: token, mode: "insensitive" } } },
            { sofor: { ad: { contains: token, mode: "insensitive" } } },
            { sofor: { soyad: { contains: token, mode: "insensitive" } } },
        ];

        const numToken = Number(token.replace(/[^\d]/g, ""));
        if (!isNaN(numToken) && token.length > 0) {
            filters.push({ endeks: numToken });
        }

        return filters;
    });

    if (qFilter) {
        whereParts.push(qFilter);
    }
    if (commonFilters.status && (commonFilters.status === "NAKIT" || commonFilters.status === "TASIT_TANIMA")) {
        whereParts.push({ odemeYontemi: commonFilters.status as any });
    }
    if (dateRange) {
        whereParts.push({ tarih: dateRange });
    }

    // Always use AND if we have multiple filters, otherwise just return the first one
    const scopedYakitWhere = whereParts.length === 0 
        ? {} 
        : whereParts.length === 1 
            ? whereParts[0] 
            : { AND: whereParts };

    const [yakitlar, araclar, personeller, yakitTanklari, tankHareketleri] = await Promise.all([
        (prisma as any).yakit.findMany({ 
            where: scopedYakitWhere as any,
            orderBy: { tarih: 'desc' }, 
            include: { 
                sofor: {
                    select: {
                        id: true,
                        ad: true,
                        soyad: true,
                        deletedAt: true,
                        calistigiKurum: true,
                        sirket: { select: { ad: true } },
                    },
                },
                arac: {
                    include: {
                        sirket: { select: { ad: true } },
                        kullanici: {
                            select: {
                                id: true,
                                ad: true,
                                soyad: true,
                                deletedAt: true,
                                sirket: { select: { ad: true } },
                            },
                        },
                        kullaniciGecmisi: {
                            where: { bitis: null },
                            orderBy: { baslangic: "desc" },
                            take: 1,
                            select: {
                                kullanici: {
                                    select: {
                                        id: true,
                                        ad: true,
                                        soyad: true,
                                        deletedAt: true,
                                        sirket: { select: { ad: true } },
                                    },
                                },
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
                calistigiKurum: true,
                guncelKm: true,
                durum: true,
                sirket: { select: { ad: true } },
                kullanici: {
                    select: {
                        id: true,
                        ad: true,
                        soyad: true,
                        deletedAt: true,
                        sirket: { select: { ad: true } },
                    },
                },
                kullaniciGecmisi: {
                    where: { bitis: null },
                    orderBy: { baslangic: "desc" },
                    take: 1,
                    select: {
                        kullanici: {
                            select: {
                                id: true,
                                ad: true,
                                soyad: true,
                                deletedAt: true,
                                sirket: { select: { ad: true } },
                            },
                        },
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
                calistigiKurum: true,
                sirket: { select: { ad: true } },
            },
            orderBy: [{ ad: "asc" }, { soyad: "asc" }],
        }).catch(() => []),
        (prisma as any).yakitTank.findMany({
            where: { aktifMi: true },
            orderBy: { olusturmaTarihi: 'asc' }
        }),
        (prisma as any).yakitTankHareket.findMany({
            where: {
                tip: { in: ['ALIM', 'TRANSFER'] }
            },
            orderBy: { tarih: 'desc' },
            include: {
                tank: { select: { ad: true } },
                hedefTank: { select: { ad: true } }
            }
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
        const aracAktifSofor = row.arac?.kullaniciGecmisi?.[0]?.kullanici || row.arac?.kullanici || null;
        const kullanimSirket = aracAktifSofor?.sirket || row.arac?.sirket || null;
        return {
            ...row,
            arac: row.arac
                ? {
                    ...row.arac,
                    kullanici: aracAktifSofor,
                    sirket: kullanimSirket,
                }
                : row.arac,
            ortalamaYakit100Km: metric?.averageLitresPer100Km ?? null,
            ortalamaKmBasiMaliyet: metric?.averageCostPerKm ?? null,
            ortalamaYakitDistanceKm: metric?.distanceKm ?? null,
        };
    });

    const normalizedHareketler: YakitRow[] = (tankHareketleri as any[]).map((h) => {
        const isTransfer = h.tip === 'TRANSFER';
        const plaka = isTransfer ? "BİDON DOLUMU" : "STOK ALIMI";
        const istasyon = isTransfer 
            ? `${h.tank?.ad} ➔ ${h.hedefTank?.ad}`
            : `${h.tank?.ad}`;
            
        return {
            id: h.id,
            tarih: h.tarih,
            litre: h.litre,
            tutar: h.toplamTutar,
            km: 0,
            istasyon: istasyon,
            odemeYontemi: 'NAKIT' as any,
            arac: {
                id: h.tankId,
                plaka: plaka,
                marka: "Tanker",
                model: "Sistem",
                sirket: { ad: "BERA" }
            } as any,
            isStokHareketi: true // Custom flag for UI
        } as any;
    });

    const allRecords = [...yakitlarWithMetrics, ...normalizedHareketler].sort(
        (a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime()
    );

    return (
        <YakitlarClient
            initialYakitlar={allRecords}
            araclar={(araclar as any[]).map((a) => {
                const aktifSofor = a.kullaniciGecmisi?.[0]?.kullanici || a.kullanici || null;
                const kullanimSirketAd = aktifSofor?.sirket?.ad || a.sirket?.ad || null;
                return {
                id: a.id,
                plaka: a.plaka,
                marka: a.marka,
                model: a.model,
                durum: a.durum,
                bulunduguIl: a.bulunduguIl,
                calistigiKurum: a.calistigiKurum || null,
                sirketAd: kullanimSirketAd,
                guncelKm: a.guncelKm,
                aktifSoforId: getActivePersonelId(aktifSofor),
                aktifSofor: aktifSofor || null,
                aktifSoforAdSoyad: aktifSofor ? getPersonelDisplayName(aktifSofor) : null,
                kullaniciId: a.kullanici?.id || null,
                kullanici: a.kullanici || null,
            };
            })}
            personeller={(personeller as any[]).map((p) => ({
                ...p,
                sirketAd: p.sirket?.ad || null,
                calistigiKurum: p.calistigiKurum || null,
            }))}
            yakitTanklari={yakitTanklari as any[]}
        />
    );
}
