import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessAllCompanies, getCurrentUserRole, getSirketListFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import type { DisFirmaRow } from "./columns";
import type { DisFirmaScopeValue } from "./schema";

type PageConfig = {
    tur: DisFirmaScopeValue;
    searchParams?: Promise<DashboardSearchParams>;
};

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundOneDecimal(value: number) {
    return Math.round((value || 0) * 10) / 10;
}

function uniqueSirketler(rows: Array<{ sirket?: { id: string; ad: string } | null }>) {
    const map = new Map<string, { id: string; ad: string }>();
    for (const row of rows) {
        const sirket = row.sirket;
        if (!sirket?.id) continue;
        map.set(sirket.id, { id: sirket.id, ad: sirket.ad || "-" });
    }
    return [...map.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr-TR"));
}

export async function getDisFirmaPageData({ tur, searchParams }: PageConfig) {
    const [role, hasGlobalCompanyAccess] = await Promise.all([getCurrentUserRole(), canAccessAllCompanies()]);
    const canManageVendors = role === "ADMIN" || (role === "YETKILI" && hasGlobalCompanyAccess);

    const [selectedSirketId, selectedYil, selectedAy, sirketListFilter] = await Promise.all([
        getSelectedSirketId(searchParams),
        getSelectedYil(searchParams),
        getSelectedAy(searchParams),
        getSirketListFilter(),
    ]);
    const { start, end } = getAyDateRange(selectedYil, selectedAy);

    const relationFilter = selectedSirketId ? { sirketId: selectedSirketId } : {};
    const selectedSirket = selectedSirketId
        ? await (prisma as any).sirket.findFirst({
            where: { id: selectedSirketId },
            select: { ad: true },
        }).catch(() => null)
        : null;
    const selectedSirketName = typeof selectedSirket?.ad === "string" ? selectedSirket.ad.trim() : "";
    const scopedVendorFilters: Prisma.DisFirmaWhereInput[] = selectedSirketId
        ? [
            { araclar: { some: { ...relationFilter, deletedAt: null } } },
            { kullanicilar: { some: { ...relationFilter, deletedAt: null } } },
            ...(selectedSirketName
                ? [
                    {
                        calistigiKurum: {
                            equals: selectedSirketName,
                            mode: "insensitive",
                        },
                    } as Prisma.DisFirmaWhereInput,
                ]
                : []),
        ]
        : [];
    const vendorWhere: Prisma.DisFirmaWhereInput = {
        ...(tur === "ALL" ? {} : { tur }),
        ...(scopedVendorFilters.length > 0 ? { OR: scopedVendorFilters } : {}),
    };

    const [disFirmalar, sirketler] = await Promise.all([
        (prisma as any).disFirma.findMany({
            where: vendorWhere as any,
            orderBy: { ad: "asc" },
            include: {
                araclar: {
                    where: { ...relationFilter, deletedAt: null },
                    select: { id: true, sirket: { select: { id: true, ad: true } } },
                },
                kullanicilar: {
                    where: { ...relationFilter, deletedAt: null },
                    select: { id: true, sirket: { select: { id: true, ad: true } } },
                },
            },
        }),
        (prisma as any).sirket.findMany({
            where: sirketListFilter as any,
            select: { id: true, ad: true },
            orderBy: { ad: "asc" },
        }),
    ]);

    const vendorIds = (disFirmalar as Array<{ id: string }>).map((item) => item.id);
    const costVehicles = vendorIds.length
        ? await (prisma as any).arac.findMany({
            where: { disFirmaId: { in: vendorIds }, deletedAt: null, ...(selectedSirketId ? { sirketId: selectedSirketId } : {}) },
            select: { id: true, disFirmaId: true },
        }).catch(() => [])
        : [];
    const vehicleIds = (costVehicles as Array<{ id: string }>).map((item) => item.id);
    const vehicleToVendorId = new Map<string, string>();
    for (const vehicle of costVehicles as Array<{ id: string; disFirmaId: string | null }>) {
        if (vehicle.id && vehicle.disFirmaId) vehicleToVendorId.set(vehicle.id, vehicle.disFirmaId);
    }

    const yakitRows = vehicleIds.length
        ? await (prisma as any).yakit.groupBy({
            by: ["aracId"],
            where: { aracId: { in: vehicleIds }, tarih: { gte: start, lte: end } },
            _sum: { litre: true },
            _count: { _all: true },
        }).catch(() => [])
        : [];

    const fuelByVendor = new Map<string, { litre: number; kayitSayisi: number }>();
    const addFuel = (aracId: string | null | undefined, litre: number, kayitSayisi: number) => {
        if (!aracId) return;
        const vendorId = vehicleToVendorId.get(aracId);
        if (!vendorId) return;
        const current = fuelByVendor.get(vendorId) || { litre: 0, kayitSayisi: 0 };
        current.litre += Math.max(0, litre);
        current.kayitSayisi += kayitSayisi;
        fuelByVendor.set(vendorId, current);
    };

    for (const row of yakitRows as Array<{ aracId: string; _sum: { litre: number | null }; _count: { _all: number } }>) {
        addFuel(row.aracId, toNumber(row._sum?.litre), toNumber(row._count?._all));
    }

    const rows: DisFirmaRow[] = (disFirmalar as any[]).map((firma) => {
        const fuel = fuelByVendor.get(firma.id) || { litre: 0, kayitSayisi: 0 };

        return {
            id: firma.id,
            ad: firma.ad,
            tur: firma.tur,
            sehir: firma.sehir || "-",
            vergiNo: firma.vergiNo || "Belirtilmedi",
            yetkiliKisi: firma.yetkiliKisi || "-",
            telefon: firma.telefon || "-",
            calistigiKurum: firma.calistigiKurum || "",
            aracSayisi: firma.araclar?.length || 0,
            personelSayisi: firma.kullanicilar?.length || 0,
            toplamYakitLitre: roundOneDecimal(fuel.litre),
            yakitKayitSayisi: fuel.kayitSayisi,
            calistigiSirketler: uniqueSirketler([...(firma.araclar || []), ...(firma.kullanicilar || [])]),
        };
    });

    return {
        canManageVendors,
        selectedSirketId,
        rows,
        sirketler: sirketler as Array<{ id: string; ad: string }>,
    };
}
