import prisma from "../../../lib/prisma";
import DokumanlarClient from "./client";
import { DokumanRow } from "./columns";

export default async function DokumanlarPage() {
    const [dokumanlar, araclar] = await Promise.all([
        prisma.dokuman.findMany({
            orderBy: { yuklemeTarihi: 'desc' },
            include: { arac: true }
        }),
        prisma.arac.findMany({
            select: { id: true, plaka: true },
            orderBy: { plaka: 'asc' }
        })
    ]);

    return <DokumanlarClient initialDokumanlar={dokumanlar as unknown as DokumanRow[]} araclar={araclar} />;
}
