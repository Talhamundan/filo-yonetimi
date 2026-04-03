import { prisma } from "../../../lib/prisma";
import MuayenelerClient from "./client";
import { MuayeneRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, getYilDateRange, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { ensureMuayeneColumns } from "@/lib/muayene-schema-compat";
import { buildTokenizedOrWhere } from "@/lib/search-query";

type CompanyAwareUser = {
    deletedAt?: Date | string | null;
    calistigiKurum?: string | null;
    sirket?: { ad?: string | null } | null;
} | null | undefined;

type CompanyAwareVehicle = {
    calistigiKurum?: string | null;
    kullanici?: CompanyAwareUser;
    kullaniciGecmisi?: Array<{ kullanici?: CompanyAwareUser } | null> | null;
} | null | undefined;

const ARAC_COMPANY_SELECT = {
    id: true,
    plaka: true,
    marka: true,
    model: true,
    calistigiKurum: true,
    sirket: { select: { ad: true } },
    kullanici: {
        select: {
            deletedAt: true,
            calistigiKurum: true,
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
                    deletedAt: true,
                    calistigiKurum: true,
                    sirket: { select: { ad: true } },
                },
            },
        },
    },
} as const;

function normalizeText(value: string | null | undefined) {
    return typeof value === "string" ? value.trim() : "";
}

function resolveKullaniciFirmaAd(arac: CompanyAwareVehicle) {
    const manualFirma = normalizeText(arac?.calistigiKurum);
    if (manualFirma) return manualFirma;

    const aktifZimmetKullanici = arac?.kullaniciGecmisi?.[0]?.kullanici;
    const aktifKullanici = aktifZimmetKullanici || arac?.kullanici || null;
    const gecerliKullanici = aktifKullanici?.deletedAt ? null : aktifKullanici;
    const kullaniciKurum = normalizeText(gecerliKullanici?.calistigiKurum);
    if (kullaniciKurum) return kullaniciKurum;

    const kullaniciSirket = normalizeText(gecerliKullanici?.sirket?.ad);
    return kullaniciSirket || null;
}

export default async function MuayenelerPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, commonFilters] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getCommonListFilters(props.searchParams),
    ]);
    const filter = await getModelFilter('muayene', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const { start: yilBasi, end: yilSonu } = getYilDateRange(selectedYil);
    const baseMuayeneFilter = { ...((filter || {}) as Record<string, unknown>) } as Record<string, unknown>;
    const scopedSirketId = typeof baseMuayeneFilter.sirketId === "string" ? baseMuayeneFilter.sirketId : null;

    if (scopedSirketId) {
        delete baseMuayeneFilter.sirketId;
    }

    const companyCompatibleWhere = scopedSirketId
        ? {
            ...baseMuayeneFilter,
            OR: [
                { sirketId: scopedSirketId },
                { sirketId: null, arac: { sirketId: scopedSirketId } },
            ],
        }
        : baseMuayeneFilter;

    const muayeneWhere = {
        AND: [
            companyCompatibleWhere,
            {
                gecerlilikTarihi: { gte: yilBasi, lte: yilSonu },
            },
        ],
    };
    const dateRange = getDateRangeFilter(commonFilters.from, commonFilters.to);
    const whereParts: Record<string, unknown>[] = [muayeneWhere as Record<string, unknown>];

    const qFilter = buildTokenizedOrWhere(commonFilters.q, (token) => [
        { arac: { plaka: { contains: token, mode: "insensitive" } } },
        { arac: { marka: { contains: token, mode: "insensitive" } } },
        { arac: { model: { contains: token, mode: "insensitive" } } },
    ]);
    if (qFilter) {
        whereParts.push(qFilter);
    }
    if (dateRange) {
        whereParts.push({ gecerlilikTarihi: dateRange });
    }
    const scopedMuayeneWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];
    await ensureMuayeneColumns();

    const [muayenelerRaw, araclar] = await Promise.all([
        (prisma as any).muayene.findMany({
            where: scopedMuayeneWhere as any,
            orderBy: [{ gecerlilikTarihi: "asc" }],
            include: { arac: { select: ARAC_COMPANY_SELECT } }
        }).catch(async (error: any) => {
            console.warn("Muayene yeni alanlari okunamadi. Geriye donuk sorgu ile devam ediliyor.", error);
            const legacyRows = await (prisma as any).muayene.findMany({
                where: scopedMuayeneWhere as any,
                orderBy: [{ gecerlilikTarihi: "asc" }],
                select: {
                    id: true,
                    muayeneTarihi: true,
                    gecerlilikTarihi: true,
                    km: true,
                    aktifMi: true,
                    arac: { select: ARAC_COMPANY_SELECT }
                }
            });
            return legacyRows.map((row: any) => ({ ...row, tutar: null, gectiMi: true }));
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true, durum: true },
            orderBy: { plaka: 'asc' }
        })
    ]);

    const muayeneler = (muayenelerRaw as any[]).map((row) => {
        const kullaniciFirmaAd = resolveKullaniciFirmaAd(row?.arac);
        return {
            ...row,
            arac: row?.arac
                ? {
                    ...row.arac,
                    kullaniciFirmaAd,
                }
                : row?.arac,
        };
    });

    return <MuayenelerClient initialMuayeneler={muayeneler as unknown as MuayeneRow[]} araclar={araclar} />;
}
