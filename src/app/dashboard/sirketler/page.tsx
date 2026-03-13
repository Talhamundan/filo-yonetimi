import React from "react";
import { prisma } from "../../../lib/prisma";
import SirketlerClient from "./Client";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function SirketlerPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const filter = await getModelFilter('sirket', selectedSirketId);

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
