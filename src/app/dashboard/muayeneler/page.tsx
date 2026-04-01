import { prisma } from "../../../lib/prisma";
import MuayenelerClient from "./client";
import { MuayeneRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, getYilDateRange, type DashboardSearchParams } from "@/lib/company-scope";
import { getCommonListFilters, getDateRangeFilter } from "@/lib/list-filters";
import { ensureMuayeneColumns } from "@/lib/muayene-schema-compat";
import { buildTokenizedOrWhere } from "@/lib/search-query";

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
                OR: [
                    { muayeneTarihi: { gte: yilBasi, lte: yilSonu } },
                    { gecerlilikTarihi: { gte: yilBasi, lte: yilSonu } },
                ],
            },
        ],
    };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const criticalDate = new Date(now);
    criticalDate.setDate(criticalDate.getDate() + 15);
    const upcomingDate = new Date(now);
    upcomingDate.setDate(upcomingDate.getDate() + 30);
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
    if (commonFilters.status) {
        switch (commonFilters.status) {
            case "PASIF":
                whereParts.push({ aktifMi: false });
                break;
            case "GECMEDI":
                whereParts.push({ gectiMi: false });
                break;
            case "GECTI":
                whereParts.push({ gectiMi: true });
                break;
            case "GECIKTI":
                whereParts.push({ aktifMi: true, gectiMi: true, gecerlilikTarihi: { lt: now } });
                break;
            case "YUKSEK":
            case "KRITIK":
                whereParts.push({ aktifMi: true, gectiMi: true, gecerlilikTarihi: { gte: now, lte: criticalDate } });
                break;
            case "YAKLASIYOR":
                whereParts.push({ aktifMi: true, gectiMi: true, gecerlilikTarihi: { gte: criticalDate, lte: upcomingDate } });
                break;
            case "GECERLI":
                whereParts.push({ aktifMi: true, gectiMi: true, gecerlilikTarihi: { gt: upcomingDate } });
                break;
            default:
                break;
        }
    }
    if (dateRange) {
        whereParts.push({ gecerlilikTarihi: dateRange });
    }
    const scopedMuayeneWhere = whereParts.length > 1 ? { AND: whereParts } : whereParts[0];
    await ensureMuayeneColumns();

    const [muayenelerRaw, araclar] = await Promise.all([
        (prisma as any).muayene.findMany({
            where: scopedMuayeneWhere as any,
            orderBy: [{ gecerlilikTarihi: 'desc' }, { muayeneTarihi: 'desc' }],
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }).catch(async (error: any) => {
            console.warn("Muayene yeni alanlari okunamadi. Geriye donuk sorgu ile devam ediliyor.", error);
            const legacyRows = await (prisma as any).muayene.findMany({
                where: scopedMuayeneWhere as any,
                orderBy: [{ gecerlilikTarihi: "desc" }, { muayeneTarihi: "desc" }],
                select: {
                    id: true,
                    muayeneTarihi: true,
                    gecerlilikTarihi: true,
                    km: true,
                    aktifMi: true,
                    arac: { include: { sirket: { select: { ad: true } } } }
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
    return <MuayenelerClient initialMuayeneler={muayenelerRaw as unknown as MuayeneRow[]} araclar={araclar} />;
}
