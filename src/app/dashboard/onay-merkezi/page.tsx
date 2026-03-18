import { prisma } from "@/lib/prisma";
import OnayMerkeziClient from "./OnayMerkeziClient";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getModelFilter, getModelFilterWithOptions } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import type { Prisma } from "@prisma/client";

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

export default async function OnayMerkeziPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const session = await auth();

    if (session?.user?.rol !== 'ADMIN') {
        redirect("/dashboard");
    }

    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [kullaniciFilter, aracFilter, masrafFilter, bakimFilter, dokumanFilter, cezaFilter] = await Promise.all([
        getModelFilter("kullanici", selectedSirketId),
        getModelFilterWithOptions("arac", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("masraf", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("bakim", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("dokuman", selectedSirketId, { includeDeleted: true }),
        getModelFilterWithOptions("ceza", selectedSirketId, { includeDeleted: true }),
    ]);

    const userWhere: Prisma.KullaniciWhereInput = {
        AND: [kullaniciFilter as Prisma.KullaniciWhereInput, { onayDurumu: "BEKLIYOR" }],
    };

    const users = await prisma.kullanici.findMany({
        where: userWhere,
        include: { sirket: true },
        orderBy: { ad: "asc" },
    });

    const deletionThreshold = new Date();
    deletionThreshold.setDate(deletionThreshold.getDate() - 30);

    const deletedAracWhere: Prisma.AracWhereInput = {
        AND: [aracFilter as Prisma.AracWhereInput, { deletedAt: { not: null } }],
    };
    const deletedMasrafWhere: Prisma.MasrafWhereInput = {
        AND: [masrafFilter as Prisma.MasrafWhereInput, { deletedAt: { not: null } }],
    };
    const deletedBakimWhere: Prisma.BakimWhereInput = {
        AND: [bakimFilter as Prisma.BakimWhereInput, { deletedAt: { not: null } }],
    };
    const deletedDokumanWhere: Prisma.DokumanWhereInput = {
        AND: [dokumanFilter as Prisma.DokumanWhereInput, { deletedAt: { not: null } }],
    };
    const deletedCezaWhere: Prisma.CezaWhereInput = {
        AND: [cezaFilter as Prisma.CezaWhereInput, { deletedAt: { not: null } }],
    };
    const deletedKullaniciWhere: Prisma.KullaniciWhereInput = {
        AND: [kullaniciFilter as Prisma.KullaniciWhereInput, { deletedAt: { not: null } }],
    };

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
        prisma.arac.count({ where: deletedAracWhere }),
        prisma.masraf.count({ where: deletedMasrafWhere }),
        prisma.bakim.count({ where: deletedBakimWhere }),
        prisma.dokuman.count({ where: deletedDokumanWhere }),
        prisma.ceza.count({ where: deletedCezaWhere }),
        prisma.kullanici.count({ where: deletedKullaniciWhere }),
        prisma.arac.count({
            where: { AND: [deletedAracWhere, { deletedAt: { lte: deletionThreshold } }] },
        }),
        prisma.masraf.count({
            where: { AND: [deletedMasrafWhere, { deletedAt: { lte: deletionThreshold } }] },
        }),
        prisma.bakim.count({
            where: { AND: [deletedBakimWhere, { deletedAt: { lte: deletionThreshold } }] },
        }),
        prisma.dokuman.count({
            where: { AND: [deletedDokumanWhere, { deletedAt: { lte: deletionThreshold } }] },
        }),
        prisma.ceza.count({
            where: { AND: [deletedCezaWhere, { deletedAt: { lte: deletionThreshold } }] },
        }),
        prisma.kullanici.count({
            where: { AND: [deletedKullaniciWhere, { deletedAt: { lte: deletionThreshold } }] },
        }),
        prisma.arac.findFirst({ where: deletedAracWhere, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.masraf.findFirst({ where: deletedMasrafWhere, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.bakim.findFirst({ where: deletedBakimWhere, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.dokuman.findFirst({ where: deletedDokumanWhere, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.ceza.findFirst({ where: deletedCezaWhere, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
        prisma.kullanici.findFirst({ where: deletedKullaniciWhere, select: { deletedAt: true }, orderBy: { deletedAt: "asc" } }),
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

    return <OnayMerkeziClient initialUsers={users} deletedStats={deletedStats} />;
}
