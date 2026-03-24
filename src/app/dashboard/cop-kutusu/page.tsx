import prisma from "@/lib/prisma";
import { getModelFilterWithOptions, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import TrashClient, { type TrashRow } from "./trash-client";

type DeletedDataStats = {
    total: number;
    pendingPermanentDelete: number;
    oldestDeletedAt: string | null;
    byEntity: {
        arac: number;
        masraf: number;
        bakim: number;
        dokuman: number;
        ceza: number;
        kullanici: number;
    };
};

function parseString(value: string | string[] | undefined) {
    if (!value) return null;
    return Array.isArray(value) ? value[0] || null : value;
}

function toDateOrNull(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function inDateRange(date: Date | null | undefined, from: Date | null, to: Date | null) {
    if (!date) return false;
    if (from && date.getTime() < from.getTime()) return false;
    if (to && date.getTime() > to.getTime()) return false;
    return true;
}

export default async function CopKutusuPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, resolvedSearchParams, sirketListFilter] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        props.searchParams ? props.searchParams : Promise.resolve({} as DashboardSearchParams),
        getSirketListFilter(),
    ]);

    const entityFilter = parseString(resolvedSearchParams.entity);
    const q = parseString(resolvedSearchParams.q)?.toLocaleLowerCase("tr-TR") || "";
    const from = toDateOrNull(parseString(resolvedSearchParams.from));
    const to = toDateOrNull(parseString(resolvedSearchParams.to));

    const [aracFilter, masrafFilter, bakimFilter, dokumanFilter, cezaFilter, kullaniciFilter, sirketler] = await Promise.all([
        getModelFilterWithOptions("arac", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("masraf", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("bakim", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("dokuman", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("ceza", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("personel", selectedSirketId, { includeDeleted: true }),
        prisma.sirket.findMany({ where: sirketListFilter as never, select: { id: true, ad: true }, orderBy: { ad: "asc" } }),
    ]);

    const sirketMap = new Map(sirketler.map((s) => [s.id, s.ad]));
    const deletionThreshold = new Date();
    deletionThreshold.setDate(deletionThreshold.getDate() - 30);

    const deletedAracWhere: Record<string, unknown> = { ...(aracFilter as Record<string, unknown>), deletedAt: { not: null } };
    const deletedMasrafWhere: Record<string, unknown> = { ...(masrafFilter as Record<string, unknown>), deletedAt: { not: null } };
    const deletedBakimWhere: Record<string, unknown> = { ...(bakimFilter as Record<string, unknown>), deletedAt: { not: null } };
    const deletedDokumanWhere: Record<string, unknown> = { ...(dokumanFilter as Record<string, unknown>), deletedAt: { not: null } };
    const deletedCezaWhere: Record<string, unknown> = { ...(cezaFilter as Record<string, unknown>), deletedAt: { not: null } };
    const deletedKullaniciWhere: Record<string, unknown> = { ...(kullaniciFilter as Record<string, unknown>), deletedAt: { not: null } };

    const [
        aracDeletedCount,
        masrafDeletedCount,
        bakimDeletedCount,
        dokumanDeletedCount,
        cezaDeletedCount,
        kullaniciDeletedCount,
        aracPurgeCount,
        masrafPurgeCount,
        bakimPurgeCount,
        dokumanPurgeCount,
        cezaPurgeCount,
        kullaniciPurgeCount,
        oldestArac,
        oldestMasraf,
        oldestBakim,
        oldestDokuman,
        oldestCeza,
        oldestKullanici,
    ] = await Promise.all([
        prisma.arac.count({ where: deletedAracWhere as never }),
        prisma.masraf.count({ where: deletedMasrafWhere as never }),
        prisma.bakim.count({ where: deletedBakimWhere as never }),
        prisma.dokuman.count({ where: deletedDokumanWhere as never }),
        prisma.ceza.count({ where: deletedCezaWhere as never }),
        prisma.kullanici.count({ where: deletedKullaniciWhere as never }),
        prisma.arac.count({ where: { AND: [deletedAracWhere, { deletedAt: { lte: deletionThreshold } }] } as never }),
        prisma.masraf.count({ where: { AND: [deletedMasrafWhere, { deletedAt: { lte: deletionThreshold } }] } as never }),
        prisma.bakim.count({ where: { AND: [deletedBakimWhere, { deletedAt: { lte: deletionThreshold } }] } as never }),
        prisma.dokuman.count({ where: { AND: [deletedDokumanWhere, { deletedAt: { lte: deletionThreshold } }] } as never }),
        prisma.ceza.count({ where: { AND: [deletedCezaWhere, { deletedAt: { lte: deletionThreshold } }] } as never }),
        prisma.kullanici.count({ where: { AND: [deletedKullaniciWhere, { deletedAt: { lte: deletionThreshold } }] } as never }),
        prisma.arac.findFirst({ where: deletedAracWhere as never, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.masraf.findFirst({ where: deletedMasrafWhere as never, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.bakim.findFirst({ where: deletedBakimWhere as never, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.dokuman.findFirst({ where: deletedDokumanWhere as never, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.ceza.findFirst({ where: deletedCezaWhere as never, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.kullanici.findFirst({ where: deletedKullaniciWhere as never, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
    ]);

    const oldestDeletedAt =
        [oldestArac, oldestMasraf, oldestBakim, oldestDokuman, oldestCeza, oldestKullanici]
            .map((item) => item?.deletedAt)
            .filter((value): value is Date => Boolean(value))
            .sort((a, b) => a.getTime() - b.getTime())[0] || null;

    const deletedStats: DeletedDataStats = {
        total:
            aracDeletedCount +
            masrafDeletedCount +
            bakimDeletedCount +
            dokumanDeletedCount +
            cezaDeletedCount +
            kullaniciDeletedCount,
        pendingPermanentDelete:
            aracPurgeCount + masrafPurgeCount + bakimPurgeCount + dokumanPurgeCount + cezaPurgeCount + kullaniciPurgeCount,
        oldestDeletedAt: oldestDeletedAt ? oldestDeletedAt.toISOString() : null,
        byEntity: {
            arac: aracDeletedCount,
            masraf: masrafDeletedCount,
            bakim: bakimDeletedCount,
            dokuman: dokumanDeletedCount,
            ceza: cezaDeletedCount,
            kullanici: kullaniciDeletedCount,
        },
    };

    const [araclar, masraflar, bakimlar, dokumanlar, cezalar, kullanicilar] = await Promise.all([
        entityFilter && entityFilter !== "arac"
            ? Promise.resolve([])
            : prisma.arac.findMany({
                  where: { ...(aracFilter as Record<string, unknown>), deletedAt: { not: null } } as never,
                  select: { id: true, plaka: true, marka: true, model: true, sirketId: true, deletedAt: true, deletedBy: true },
                  orderBy: { deletedAt: "desc" },
              }),
        entityFilter && entityFilter !== "masraf"
            ? Promise.resolve([])
            : prisma.masraf.findMany({
                  where: { ...(masrafFilter as Record<string, unknown>), deletedAt: { not: null } } as never,
                  select: { id: true, tur: true, tutar: true, sirketId: true, deletedAt: true, deletedBy: true, arac: { select: { plaka: true } } },
                  orderBy: { deletedAt: "desc" },
              }),
        entityFilter && entityFilter !== "bakim"
            ? Promise.resolve([])
            : prisma.bakim.findMany({
                  where: { ...(bakimFilter as Record<string, unknown>), deletedAt: { not: null } } as never,
                  select: { id: true, kategori: true, servisAdi: true, sirketId: true, deletedAt: true, deletedBy: true, arac: { select: { plaka: true } } },
                  orderBy: { deletedAt: "desc" },
              }),
        entityFilter && entityFilter !== "dokuman"
            ? Promise.resolve([])
            : prisma.dokuman.findMany({
                  where: { ...(dokumanFilter as Record<string, unknown>), deletedAt: { not: null } } as never,
                  select: { id: true, ad: true, tur: true, sirketId: true, deletedAt: true, deletedBy: true, arac: { select: { plaka: true } } },
                  orderBy: { deletedAt: "desc" },
              }),
        entityFilter && entityFilter !== "ceza"
            ? Promise.resolve([])
            : prisma.ceza.findMany({
                  where: { ...(cezaFilter as Record<string, unknown>), deletedAt: { not: null } } as never,
                  select: { id: true, cezaMaddesi: true, tutar: true, sirketId: true, deletedAt: true, deletedBy: true, arac: { select: { plaka: true } } },
                  orderBy: { deletedAt: "desc" },
              }),
        entityFilter && entityFilter !== "kullanici"
            ? Promise.resolve([])
            : prisma.kullanici.findMany({
                  where: { ...(kullaniciFilter as Record<string, unknown>), deletedAt: { not: null } } as never,
                  select: { id: true, ad: true, soyad: true, rol: true, sirketId: true, deletedAt: true, deletedBy: true },
                  orderBy: { deletedAt: "desc" },
              }),
    ]);

    const rows: TrashRow[] = [
        ...araclar.map((row) => ({
            id: row.id,
            entity: "arac" as const,
            summary: `${row.plaka} - ${row.marka} ${row.model}`.trim(),
            companyId: row.sirketId,
            companyName: row.sirketId ? sirketMap.get(row.sirketId) || null : null,
            deletedAt: row.deletedAt,
            deletedBy: row.deletedBy,
        })),
        ...masraflar.map((row) => ({
            id: row.id,
            entity: "masraf" as const,
            summary: `${row.arac?.plaka || "-"} - ${row.tur} (${row.tutar.toLocaleString("tr-TR")} TL)`,
            companyId: row.sirketId,
            companyName: row.sirketId ? sirketMap.get(row.sirketId) || null : null,
            deletedAt: row.deletedAt,
            deletedBy: row.deletedBy,
        })),
        ...bakimlar.map((row) => ({
            id: row.id,
            entity: "bakim" as const,
            summary: `${row.arac?.plaka || "-"} - ${row.kategori}${row.servisAdi ? ` (${row.servisAdi})` : ""}`,
            companyId: row.sirketId,
            companyName: row.sirketId ? sirketMap.get(row.sirketId) || null : null,
            deletedAt: row.deletedAt,
            deletedBy: row.deletedBy,
        })),
        ...dokumanlar.map((row) => ({
            id: row.id,
            entity: "dokuman" as const,
            summary: `${row.arac?.plaka || "-"} - ${row.ad} (${row.tur})`,
            companyId: row.sirketId,
            companyName: row.sirketId ? sirketMap.get(row.sirketId) || null : null,
            deletedAt: row.deletedAt,
            deletedBy: row.deletedBy,
        })),
        ...cezalar.map((row) => ({
            id: row.id,
            entity: "ceza" as const,
            summary: `${row.arac?.plaka || "-"} - ${row.cezaMaddesi} (${row.tutar.toLocaleString("tr-TR")} TL)`,
            companyId: row.sirketId,
            companyName: row.sirketId ? sirketMap.get(row.sirketId) || null : null,
            deletedAt: row.deletedAt,
            deletedBy: row.deletedBy,
        })),
        ...kullanicilar.map((row) => ({
            id: row.id,
            entity: "kullanici" as const,
            summary: `${row.ad} ${row.soyad} (${row.rol})`,
            companyId: row.sirketId,
            companyName: row.sirketId ? sirketMap.get(row.sirketId) || null : null,
            deletedAt: row.deletedAt,
            deletedBy: row.deletedBy,
        })),
    ]
        .filter((row): row is TrashRow => Boolean(row.deletedAt))
        .filter((row) => inDateRange(row.deletedAt, from, to))
        .filter((row) => (q ? row.summary.toLocaleLowerCase("tr-TR").includes(q) : true))
        .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

    return <TrashClient rows={rows} sirketler={sirketler} deletedStats={deletedStats} />;
}
