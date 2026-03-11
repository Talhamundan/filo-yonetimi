import React from "react";
import { prisma } from "../../../lib/prisma";
import SirketlerClient from "./Client";
import { getModelFilter } from "@/lib/auth-utils";

export default async function SirketlerPage() {
    const filter = await getModelFilter('sirket');

    const sirketler = await (prisma as any).sirket.findMany({
        where: filter as any,
        orderBy: { olusturmaTarihi: 'desc' },
        include: {
            _count: {
                select: { araclar: true, kullanicilar: true }
            }
        }
    });

    const formattedData = sirketler.map((s: any) => ({
        id: s.id,
        ad: s.ad,
        bulunduguIl: s.bulunduguIl,
        vergiNo: s.vergiNo || "Belirtilmedi",
        aracSayisi: s._count.araclar,
        personelSayisi: s._count.kullanicilar,
        olusturmaTarihi: s.olusturmaTarihi.toISOString()
    }));

    return <SirketlerClient initialData={formattedData} />;
}
