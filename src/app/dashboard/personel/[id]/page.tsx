import { prisma } from "../../../../lib/prisma";
import PersonelDetailClient from "./PersonelDetailClient";
import { notFound } from "next/navigation";
import { getSirketFilter } from "@/lib/auth-utils";

export default async function PersonelDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const sirketFilter = await getSirketFilter();

    const personel = await (prisma as any).kullanici.findFirst({
        where: {
            id: params.id,
            ...sirketFilter as any
        },
        include: {
            sirket: true,
            arac: {
                include: {
                    yakitlar: { orderBy: { tarih: 'desc' }, take: 20 },
                    bakimlar: { orderBy: { bakimTarihi: 'desc' }, take: 10 },
                    masraflar: { orderBy: { tarih: 'desc' }, take: 10 }
                }
            },
            zimmetler: {
                include: { arac: true },
                orderBy: { baslangic: 'desc' }
            },
            cezalar: {
                include: { arac: true },
                orderBy: { cezaTarihi: 'desc' }
            }
        }
    });

    if (!personel) {
        notFound();
    }

    const sirketler = await (prisma as any).sirket.findMany({
        where: sirketFilter && (sirketFilter as any).sirketId ? { id: (sirketFilter as any).sirketId } : {},
        select: { id: true, ad: true },
        orderBy: { ad: 'asc' }
    });

    return <PersonelDetailClient initialPersonel={personel as any} sirketler={sirketler} />;
}
