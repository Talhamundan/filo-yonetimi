import { prisma } from "../../../lib/prisma";
import BakimlarClient from "./client";
import { BakimRow } from "./columns";
import { getModelFilter, getPersonnelSelectFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { buildTokenizedOrWhere } from "@/lib/search-query";
import { getActivePersonelId, getPersonelDisplayName } from "@/lib/personel-display";

const BAKIM_HAS_SOFOR_ID = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.Bakim?.fields?.some((field: any) => field?.name === "soforId")
);
const BAKIM_KATEGORI_FILTER_MAP = {
    PERIYODIK_BAKIM: "PERIYODIK_BAKIM",
    PERIYODIK: "PERIYODIK_BAKIM",
    ARIZA: "ARIZA",
} as const;

function resolveBakimKategoriFilter(typeFilter: string | null, statusFilter: string | null) {
    const rawValue = (typeFilter || statusFilter || "").trim();
    if (!rawValue) return null;
    const normalized = rawValue.toLocaleUpperCase("tr-TR");
    return BAKIM_KATEGORI_FILTER_MAP[normalized as keyof typeof BAKIM_KATEGORI_FILTER_MAP] || null;
}

export default async function BakimlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, selectedAy, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const { start: rangeStart, end: rangeEnd } = getAyDateRange(selectedYil, selectedAy);
    const [filter, aracFilter, personelFilter] = await Promise.all([
        getModelFilter('bakim', selectedSirketId).catch((error) => {
            console.warn("Servis kaydı filtreleri yüklenemedi, boş filtre ile devam ediliyor.", error);
            return {};
        }),
        getModelFilter('arac', selectedSirketId).catch((error) => {
            console.warn("Araç filtreleri yüklenemedi, boş filtre ile devam ediliyor.", error);
            return {};
        }),
        getPersonnelSelectFilter().catch((error) => {
            console.warn("Personel filtreleri yüklenemedi, boş filtre ile devam ediliyor.", error);
            return {};
        }),
    ]);
    const bakimWhere = filter as any;
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [
        { 
            ...bakimWhere,
            bakimTarihi: { gte: rangeStart, lte: rangeEnd }
        }
    ];

    const qFilter = buildTokenizedOrWhere(commonFilters.q, (token) => [
        { arizaSikayet: { contains: token, mode: "insensitive" } },
        { degisenParca: { contains: token, mode: "insensitive" } },
        { islemYapanFirma: { contains: token, mode: "insensitive" } },
        { servisAdi: { contains: token, mode: "insensitive" } },
        { yapilanIslemler: { contains: token, mode: "insensitive" } },
        { plaka: { contains: token, mode: "insensitive" } },
        { arac: { plaka: { contains: token, mode: "insensitive" } } },
        { arac: { marka: { contains: token, mode: "insensitive" } } },
        { arac: { model: { contains: token, mode: "insensitive" } } },
        ...(BAKIM_HAS_SOFOR_ID
            ? [
                { sofor: { ad: { contains: token, mode: "insensitive" } } },
                { sofor: { soyad: { contains: token, mode: "insensitive" } } },
            ]
            : []),
    ]);
    if (qFilter) {
        whereParts.push(qFilter);
    }
    const kategoriFilter = resolveBakimKategoriFilter(commonFilters.type, commonFilters.status);
    if (kategoriFilter) {
        whereParts.push({ kategori: kategoriFilter });
    }
    if (dateRange) {
        whereParts.push({ bakimTarihi: dateRange });
    }
    const scopedBakimWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];

    const [bakimlar, araclar, personeller] = await Promise.all([
        (prisma as any).bakim.findMany({
            where: scopedBakimWhere as any,
            orderBy: { bakimTarihi: 'desc' },
            include: {
                ...(BAKIM_HAS_SOFOR_ID
                    ? {
                        sofor: {
                            select: {
                                id: true,
                                ad: true,
                                soyad: true,
                                deletedAt: true,
                            },
                        },
                    }
                    : {}),
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
        }).catch((error: unknown) => {
            console.error("Servis kayıtları yüklenemedi, boş liste gösterilecek.", error);
            return [];
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
                kullaniciId: true,
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
        }).catch((error: unknown) => {
            console.error("Araç listesi yüklenemedi, servis formunda boş liste gösterilecek.", error);
            return [];
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
        }).catch((error: unknown) => {
            console.error("Personel listesi yüklenemedi, servis formunda boş liste gösterilecek.", error);
            return [];
        })
    ]);

    return (
        <BakimlarClient
            initialBakimlar={(bakimlar as any[]).map((row) => {
                const aracAktifSofor = row.arac?.kullaniciGecmisi?.[0]?.kullanici || row.arac?.kullanici || null;
                return {
                    ...row,
                    plaka: row.arac?.plaka || row.plaka || null,
                    arac: row.arac
                        ? {
                            ...row.arac,
                            kullanici: aracAktifSofor,
                        }
                        : row.arac,
                };
            }) as unknown as BakimRow[]}
            activeAraclar={(araclar as any[]).map((a) => {
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
            personeller={(personeller as any[]).map((p) => ({
                ...p,
                sirketAd: p.sirket?.ad || null,
                calistigiKurum: p.calistigiKurum || null,
            }))}
        />
    );
}
