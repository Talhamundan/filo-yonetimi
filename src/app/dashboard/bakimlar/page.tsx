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

export default async function BakimlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const [filter, aracFilter, personelFilter] = await Promise.all([
        getModelFilter('bakim', selectedSirketId),
        getModelFilter('arac', selectedSirketId),
        getPersonnelSelectFilter(),
    ]);
    const rawFilter = filter as any;
    const scopedSirketId = typeof rawFilter?.sirketId === "string" ? rawFilter.sirketId : null;

    // Legacy kayitlarda bakim.sirketId bos olabiliyor.
    // Sirket kapsaminda, arac.sirketId eslesmesiyle de kayitlari yakala.
    const bakimWhere = scopedSirketId
        ? {
            OR: [
                rawFilter,
                { ...rawFilter, sirketId: null, arac: { sirketId: scopedSirketId } },
            ],
        }
        : rawFilter;
    const bakimYearWhere = withYilDateFilter((bakimWhere || {}) as Record<string, unknown>, "bakimTarihi", selectedYil);
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [bakimYearWhere as Record<string, unknown>];

    const qFilter = buildTokenizedOrWhere(commonFilters.q, (token) => [
        { servisAdi: { contains: token, mode: "insensitive" } },
        { yapilanIslemler: { contains: token, mode: "insensitive" } },
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
    if (commonFilters.type) {
        whereParts.push({ kategori: commonFilters.type });
    } else if (commonFilters.status) {
        whereParts.push({ kategori: commonFilters.status });
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

    return (
        <BakimlarClient
            initialBakimlar={(bakimlar as any[]).map((row) => {
                const aracAktifSofor = row.arac?.kullaniciGecmisi?.[0]?.kullanici || row.arac?.kullanici || null;
                return {
                    ...row,
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
            personeller={personeller as any[]}
        />
    );
}
