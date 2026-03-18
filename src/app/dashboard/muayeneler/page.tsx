import { prisma } from "../../../lib/prisma";
import MuayenelerClient from "./client";
import { MuayeneRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, getYilDateRange, type DashboardSearchParams } from "@/lib/company-scope";
import { ensureMuayeneColumns } from "@/lib/muayene-schema-compat";

export default async function MuayenelerPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
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
    await ensureMuayeneColumns();

    const [muayenelerRaw, araclar] = await Promise.all([
        (prisma as any).muayene.findMany({
            where: muayeneWhere as any,
            orderBy: [{ gecerlilikTarihi: 'desc' }, { muayeneTarihi: 'desc' }],
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }).catch(async (error: any) => {
            console.warn("Muayene yeni alanlari okunamadi. Geriye donuk sorgu ile devam ediliyor.", error);
            const legacyRows = await (prisma as any).muayene.findMany({
                where: muayeneWhere as any,
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
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        })
    ]);
    return <MuayenelerClient initialMuayeneler={muayenelerRaw as unknown as MuayeneRow[]} araclar={araclar} />;
}
