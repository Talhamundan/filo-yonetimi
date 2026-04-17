import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessAllCompanies, getCurrentUserRole, getSirketListFilter } from "@/lib/auth-utils";
import { getAyDateRange, getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import type { DisFirmaRow } from "./columns";
import type { DisFirmaTuruValue } from "./schema";

type PageConfig = {
    tur: DisFirmaTuruValue;
    searchParams?: Promise<DashboardSearchParams>;
};

function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    const vendorWhere: Prisma.DisFirmaWhereInput = {
        tur,
        ...(selectedSirketId
            ? {
                OR: [
                    { araclar: { some: { ...relationFilter, deletedAt: null } } },
                    { kullanicilar: { some: { ...relationFilter, deletedAt: null } } },
                ],
            }
            : {}),
    } as any;

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

    const [yakitRows, servisRows] = vehicleIds.length
        ? await Promise.all([
            (prisma as any).yakit.groupBy({
                by: ["aracId"],
                where: { aracId: { in: vehicleIds }, tarih: { gte: start, lte: end } },
                _sum: { tutar: true },
            }).catch(() => []),
            (prisma as any).bakim.groupBy({
                by: ["aracId"],
                where: { aracId: { in: vehicleIds }, bakimTarihi: { gte: start, lte: end }, deletedAt: null },
                _sum: { tutar: true },
            }).catch(() => []),
        ])
        : [[], []];

    const costByVendor = new Map<string, { yakit: number; servis: number }>();
    const addCost = (aracId: string | null | undefined, key: "yakit" | "servis", amount: number) => {
        if (!aracId || amount <= 0) return;
        const vendorId = vehicleToVendorId.get(aracId);
        if (!vendorId) return;
        const current = costByVendor.get(vendorId) || { yakit: 0, servis: 0 };
        current[key] += amount;
        costByVendor.set(vendorId, current);
    };

    for (const row of yakitRows as Array<{ aracId: string; _sum: { tutar: number | null } }>) {
        addCost(row.aracId, "yakit", toNumber(row._sum?.tutar));
    }
    for (const row of servisRows as Array<{ aracId: string; _sum: { tutar: number | null } }>) {
        addCost(row.aracId, "servis", toNumber(row._sum?.tutar));
    }

    const rows: DisFirmaRow[] = (disFirmalar as any[]).map((firma) => {
        const costs = costByVendor.get(firma.id) || { yakit: 0, servis: 0 };
        const maliyetKalemleri = [
            { key: "yakit", label: "Yakıt", tutar: Math.round(costs.yakit) },
            { key: "servis", label: "Servis", tutar: Math.round(costs.servis) },
        ].filter((item) => item.tutar > 0);

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
            toplamMaliyet: Math.round(costs.yakit + costs.servis),
            maliyetKalemleri,
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
