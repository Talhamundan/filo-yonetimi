import { prisma } from "../../../lib/prisma";
import YakitlarClient from "./client";
import { YakitRow } from "./columns";
import { getAracUsageFilter, getModelFilter, getPersonnelSelectFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { getActivePersonelId, getPersonelDisplayName } from "@/lib/personel-display";
import { buildFuelIntervalMetrics, getFuelConsumptionUnitByAltKategori } from "@/lib/fuel-metrics";
import { buildTokenizedOrWhere } from "@/lib/search-query";

const YAKIT_TANK_HAS_SIRKET_FIELD = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.YakitTank?.fields?.some((field: any) => field?.name === "sirketId")
);

export default async function YakitlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, selectedAy, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const { start: rangeStart, end: rangeEnd } = getAyDateRange(selectedYil, selectedAy);

    const [queryFilter, aracFilter, personelFilter, yakitTankFilter, sirketListFilter] = await Promise.all([
        getModelFilter("yakit", selectedSirketId),
        getAracUsageFilter(selectedSirketId),
        getPersonnelSelectFilter(selectedSirketId),
        YAKIT_TANK_HAS_SIRKET_FIELD ? getModelFilter("yakitTank", selectedSirketId) : Promise.resolve({}),
        getSirketListFilter(),
    ]);

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
    const yakitTankWhere = (yakitTankFilter || {}) as Record<string, unknown>;
    const tankHareketScope =
        YAKIT_TANK_HAS_SIRKET_FIELD && Object.keys(yakitTankWhere).length > 0
            ? ({
                OR: [
                    { tank: yakitTankWhere as any },
                    { hedefTank: yakitTankWhere as any },
                ],
            } as Record<string, unknown>)
            : null;

    const [yakitlar, araclar, personeller, yakitTanklari, tankHareketleri, sirketler] = await Promise.all([
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
                        sirket: { select: { id: true, ad: true } },
                        kullanici: {
                            select: {
                                id: true,
                                ad: true,
                                soyad: true,
                                deletedAt: true,
                                sirket: { select: { id: true, ad: true } },
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
                                        sirket: { select: { id: true, ad: true } },
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
                disFirma: { select: { tur: true, ad: true } },
                sirket: { select: { id: true, ad: true } },
                kullanici: {
                    select: {
                        id: true,
                        ad: true,
                        soyad: true,
                        deletedAt: true,
                        sirket: { select: { id: true, ad: true } },
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
                                sirket: { select: { id: true, ad: true } },
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
            where: {
                AND: [
                    yakitTankWhere as any,
                    { aktifMi: true },
                ],
            },
            ...(YAKIT_TANK_HAS_SIRKET_FIELD
                ? { include: { sirket: { select: { id: true, ad: true } } } }
                : {}),
            orderBy: { olusturmaTarihi: 'asc' }
        }),
        (prisma as any).yakitTankHareket.findMany({
            where: {
                tip: { in: ['ALIM', 'TRANSFER'] },
                ...(tankHareketScope ? (tankHareketScope as any) : {}),
            },
            orderBy: { tarih: 'desc' },
            include: YAKIT_TANK_HAS_SIRKET_FIELD
                ? {
                    tank: { select: { ad: true, sirket: { select: { id: true, ad: true } } } },
                    hedefTank: { select: { ad: true, sirket: { select: { id: true, ad: true } } } },
                }
                : {
                    tank: { select: { ad: true } },
                    hedefTank: { select: { ad: true } },
                }
        }),
        (prisma as any).sirket.findMany({
            where: sirketListFilter as any,
            select: { id: true, ad: true },
            orderBy: { ad: "asc" },
        }),
    ]);

    const sirketlerList = sirketler as Array<{ id: string; ad: string }>;
    const sirketAdById = new Map(sirketlerList.map((sirket) => [sirket.id, sirket.ad]));
    const sirketIdByName = new Map(
        sirketlerList.map((sirket) => [String(sirket.ad || "").trim().toLocaleLowerCase("tr-TR"), sirket.id])
    );
    
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
            consumptionUnit: getFuelConsumptionUnitByAltKategori(row.arac?.altKategori),
        }))
    );
    const yakitlarWithMetrics: YakitRow[] = rawYakitlar.map((row) => {
        const metric = byCurrentRecordId.get(row.id);
        const aracAktifSofor = row.arac?.kullaniciGecmisi?.[0]?.kullanici || row.arac?.kullanici || null;
        const kullanimSirket = aracAktifSofor?.sirket || row.arac?.sirket || null;
        const rowSirketAd = row.sirketId ? (sirketAdById.get(row.sirketId) || null) : null;
        return {
            ...row,
            sirketAd: rowSirketAd || kullanimSirket?.ad || row.arac?.calistigiKurum || null,
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
            ortalamaYakitDistanceBirimi: metric?.distanceUnit ?? null,
            yakitTuketimBirimi: metric?.consumptionUnit ?? getFuelConsumptionUnitByAltKategori(row.arac?.altKategori),
        };
    });

    const normalizedHareketler: YakitRow[] = (tankHareketleri as any[]).map((h) => {
        const isTransfer = h.tip === 'TRANSFER';
        const plaka = isTransfer ? "BİDON DOLUMU" : "STOK ALIMI";
        const istasyon = isTransfer 
            ? `${h.tank?.ad} ➔ ${h.hedefTank?.ad}`
            : `${h.tank?.ad}`;
        const hareketSirketId = YAKIT_TANK_HAS_SIRKET_FIELD
            ? (h.tank?.sirket?.id || h.hedefTank?.sirket?.id || null)
            : null;
        const hareketSirketAd = YAKIT_TANK_HAS_SIRKET_FIELD
            ? (h.tank?.sirket?.ad || h.hedefTank?.sirket?.ad || "-")
            : "-";
            
        return {
            id: h.id,
            tarih: h.tarih,
            litre: h.litre,
            tutar: h.toplamTutar,
            km: 0,
            istasyon: istasyon,
            odemeYontemi: 'NAKIT' as any,
            sirketId: hareketSirketId,
            sirketAd: hareketSirketAd,
            arac: {
                id: h.tankId,
                plaka: plaka,
                marka: "Tanker",
                model: "Sistem",
                sirket: {
                    ad: hareketSirketAd
                }
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
                const calistigiKurumSirketId = a.calistigiKurum
                    ? (sirketIdByName.get(String(a.calistigiKurum).trim().toLocaleLowerCase("tr-TR")) || null)
                    : null;
                const kullanimSirketId = calistigiKurumSirketId || aktifSofor?.sirket?.id || a.sirket?.id || null;
                return {
                id: a.id,
                plaka: a.plaka,
                marka: a.marka,
                model: a.model,
                durum: a.durum,
                bulunduguIl: a.bulunduguIl,
                calistigiKurum: a.calistigiKurum || null,
                sirketAd: kullanimSirketAd,
                sirketId: kullanimSirketId,
                guncelKm: a.guncelKm,
                aktifSoforId: getActivePersonelId(aktifSofor),
                aktifSofor: aktifSofor || null,
                aktifSoforAdSoyad: aktifSofor ? getPersonelDisplayName(aktifSofor) : null,
                kullaniciId: a.kullanici?.id || null,
                kullanici: a.kullanici || null,
                disFirmaTur: a.disFirma?.tur || null,
                disFirmaAd: a.disFirma?.ad || null,
            };
            })}
            personeller={(personeller as any[]).map((p) => ({
                ...p,
                sirketAd: p.sirket?.ad || null,
                calistigiKurum: p.calistigiKurum || null,
            }))}
            yakitTanklari={yakitTanklari as any[]}
            sirketler={sirketlerList}
            />
    );
}
