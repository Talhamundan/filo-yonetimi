import { prisma } from "../../../lib/prisma";
import YakitlarClient from "./client";
import { YakitRow } from "./columns";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, getSelectedYil, withYilDateFilter, type DashboardSearchParams } from "@/lib/company-scope";

export default async function YakitlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const [queryFilter, aracFilter] = await Promise.all([
        getModelFilter('yakit', selectedSirketId),
        getModelFilter('arac', selectedSirketId),
    ]);
    const yakitWhere = withYilDateFilter((queryFilter || {}) as Record<string, unknown>, "tarih", selectedYil);

    const [yakitlar, araclar] = await Promise.all([
        (prisma as any).yakit.findMany({ 
            where: yakitWhere as any,
            orderBy: { tarih: 'desc' }, 
            include: { 
                sofor: { select: { id: true, ad: true, soyad: true } },
                arac: {
                    include: {
                        sirket: { select: { ad: true } },
                        kullanici: { select: { id: true, ad: true, soyad: true } }
                    }
                } 
            } 
        }),
        (prisma as any).arac.findMany({ 
            where: aracFilter as any,
            select: {
                id: true,
                plaka: true,
                marka: true,
                model: true,
                bulunduguIl: true,
                guncelKm: true,
                kullanici: { select: { id: true, ad: true, soyad: true } },
            },
            orderBy: { plaka: 'asc' } 
        })
    ]);
    
    return (
        <YakitlarClient
            initialYakitlar={yakitlar as unknown as YakitRow[]}
            araclar={(araclar as any[]).map((a) => ({
                id: a.id,
                plaka: a.plaka,
                marka: a.marka,
                model: a.model,
                bulunduguIl: a.bulunduguIl,
                guncelKm: a.guncelKm,
                aktifSoforId: a.kullanici?.id || null,
                aktifSoforAdSoyad: a.kullanici ? `${a.kullanici.ad} ${a.kullanici.soyad}` : null,
            }))}
        />
    );
}
