import { prisma } from "../../../../lib/prisma";
import PersonelDetailClient from "./PersonelDetailClient";
import { notFound } from "next/navigation";
import { getModelFilter, getSirketListFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function PersonelDetailPage(props: { params: Promise<{ id: string }>; searchParams?: Promise<DashboardSearchParams> }) {
    const params = await props.params;
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const [personelFilter, sirketListFilter] = await Promise.all([
        getModelFilter("personel", selectedSirketId),
        getSirketListFilter(),
    ]);

    const personel = await (prisma as any).kullanici.findFirst({
        where: {
            id: params.id,
            ...(personelFilter as any)
        },
        include: {
            sirket: true,
            arac: {
                include: {
                    sirket: true,
                    yakitlar: { orderBy: { tarih: 'desc' }, take: 20 },
                    bakimlar: { orderBy: { bakimTarihi: 'desc' }, take: 10 },
                    masraflar: { orderBy: { tarih: 'desc' }, take: 10 }
                }
            },
            zimmetler: {
                include: { arac: { include: { sirket: true } } },
                orderBy: { baslangic: 'desc' }
            },
            cezalar: {
                include: { arac: { include: { sirket: true } } },
                orderBy: { cezaTarihi: 'desc' }
            }
        }
    });

    if (!personel) {
        notFound();
    }

    const sirketler = await (prisma as any).sirket.findMany({
        where: sirketListFilter as any,
        select: { id: true, ad: true },
        orderBy: { ad: 'asc' }
    });

    return <PersonelDetailClient initialPersonel={personel as any} sirketler={sirketler} />;
}
