import prisma from "@/lib/prisma";
import { getModelFilterWithOptions, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import TrashClient, { type TrashRow } from "./trash-client";

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

    return <TrashClient rows={rows} sirketler={sirketler} />;
}
