import { prisma } from "../../../../lib/prisma";
import AracDetailClient from "./AracDetailClient";
import { notFound } from "next/navigation";
import { getModelFilter } from "@/lib/auth-utils";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function AracDetailPage(props: { params: Promise<{ id: string }>; searchParams?: Promise<DashboardSearchParams> }) {
    const params = await props.params;
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const filter = await getModelFilter("arac", selectedSirketId);
    const queryFilter = { id: params.id, ...(filter as any) };

    // Fetch the vehicle with a complete 360-degree relational view
    const arac = await (prisma as any).arac.findFirst({
        where: queryFilter,
        include: {
            kullanici: true,
            kullaniciGecmisi: { include: { kullanici: true }, orderBy: { baslangic: 'desc' } },
            muayene: { orderBy: { muayeneTarihi: 'desc' } },
            bakimlar: { orderBy: { bakimTarihi: 'desc' } },
            kasko: { orderBy: { bitisTarihi: 'desc' } },
            trafikSigortasi: { orderBy: { bitisTarihi: 'desc' } },
            yakitlar: { orderBy: { tarih: 'desc' } },
            masraflar: { orderBy: { tarih: 'desc' } },
            arizalar: { orderBy: { arizaTarihi: 'desc' } },
            dokumanlar: { orderBy: { yuklemeTarihi: 'desc' } },
            hgsYuklemeler: { orderBy: { tarih: 'desc' } }
        }
    });

    if (!arac) {
        notFound();
    }

    return (
        <AracDetailClient initialArac={arac as any} />
    );
}
