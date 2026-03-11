import { prisma } from "@/lib/prisma";
import HgsClient from "./client";
import { HgsRow } from "./columns";
import { getModelFilter, getCurrentSirketId } from "@/lib/auth-utils";

export default async function HgsPage() {
    const [filter, sirketId] = await Promise.all([
        getModelFilter('hgs'),
        getCurrentSirketId()
    ]);

    const queryFilter = filter && Object.keys(filter).length > 0
        ? { ...(filter as any) }
        : sirketId ? { sirketId } : {};

    const [hgsKayitlari, araclar] = await Promise.all([
        (prisma as any).hgsYukleme.findMany({
            where: queryFilter,
            orderBy: { tarih: 'desc' },
            include: { arac: true }
        }),
        (prisma as any).arac.findMany({
            where: sirketId ? { sirketId } : {},
            select: { id: true, plaka: true },
            orderBy: { plaka: 'asc' }
        })
    ]);

    return <HgsClient initialHgs={hgsKayitlari as unknown as HgsRow[]} araclar={araclar} />;
}
