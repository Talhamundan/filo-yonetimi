import { prisma } from "../../../lib/prisma";
import SigortaClient from "./client";
import { SigortaRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, getYilDateRange, type DashboardSearchParams } from "@/lib/company-scope";

export default async function TrafikSigortasiPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const { start: yilBasi, end: yilSonu } = getYilDateRange(selectedYil);
    const filter = await getModelFilter('trafikSigortasi', selectedSirketId);
    const aracFilter = await getModelFilter('arac', selectedSirketId);
    const sigortaWhere = {
        AND: [
            (filter || {}) as Record<string, unknown>,
            { baslangicTarihi: { lte: yilSonu } },
            { bitisTarihi: { gte: yilBasi } },
            { aktifMi: true },
        ],
    };

    const [sigortalarRaw, araclar] = await Promise.all([
        (prisma as any).trafikSigortasi.findMany({
            where: sigortaWhere as any,
            orderBy: [
                { aracId: "asc" },
                { bitisTarihi: "desc" },
            ],
            include: { arac: { include: { sirket: { select: { ad: true } } } } }
        }),
        (prisma as any).arac.findMany({
            where: aracFilter as any,
            select: { id: true, plaka: true, marka: true, model: true, bulunduguIl: true, guncelKm: true },
            orderBy: { plaka: 'asc' }
        })
    ]);
    const seenAracIds = new Set<string>();
    const sigortalar = (sigortalarRaw as any[]).filter((item) => {
        if (!item?.aracId || seenAracIds.has(item.aracId)) return false;
        seenAracIds.add(item.aracId);
        return true;
    }).sort((a, b) => new Date(b.bitisTarihi).getTime() - new Date(a.bitisTarihi).getTime());

    return <SigortaClient initialSigortalar={sigortalar as unknown as SigortaRow[]} araclar={araclar} />;
}
