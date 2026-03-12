import { prisma } from "../../../../lib/prisma";
import AracDetailClient from "./AracDetailClient";
import { notFound } from "next/navigation";
import { getSirketFilter, isSofor, getCurrentUserId } from "@/lib/auth-utils";

export default async function AracDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const sirketFilter = await getSirketFilter();
    const isSfr = await isSofor();
    const userId = await getCurrentUserId();

    // Güvenlik: Şoför ise sadece kendi zimmetli aracını, değilse kendi şirketinin aracını görebilir.
    const queryFilter = isSfr 
        ? { id: params.id, kullaniciId: userId } 
        : { id: params.id, ...sirketFilter as any };

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
