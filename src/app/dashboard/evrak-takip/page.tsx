import { prisma } from "../../../lib/prisma";
import EvrakTakipClient from "./EvrakTakipClient";
import { differenceInDays } from "date-fns";
import { getModelFilter } from "@/lib/auth-utils";

export default async function EvrakTakipPage() {
    const filter = await getModelFilter('arac');

    const araclar = await (prisma as any).arac.findMany({
        where: filter as any,
        orderBy: { plaka: 'asc' },
        include: {
            muayene: { orderBy: { muayeneTarihi: 'desc' }, take: 1 },
            kasko: { orderBy: { bitisTarihi: 'desc' }, take: 1 }
        }
    });

    const bugun = new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evrakListesi: any[] = [];

    araclar.forEach((arac: any) => {
        if (arac.muayene && arac.muayene.length > 0) {
            const m = arac.muayene[0];
            const kalanGun = differenceInDays(new Date(m.gecerlilikTarihi), bugun);
            evrakListesi.push({
                id: `m-${m.id}`,
                aracId: arac.id,
                plaka: arac.plaka,
                marka: arac.marka,
                tur: 'TÜVTÜRK Muayene',
                gecerlilikTarihi: m.gecerlilikTarihi,
                kalanGun: kalanGun,
                durum: kalanGun < 0 ? 'GECIKTI' : kalanGun <= 15 ? 'KRITIK' : kalanGun <= 30 ? 'YAKLASTI' : 'GECERLI'
            });
        }

        if (arac.kasko && arac.kasko.length > 0) {
            const k = arac.kasko[0];
            const kalanGun = differenceInDays(new Date(k.bitisTarihi), bugun);
            evrakListesi.push({
                id: `k-${k.id}`,
                aracId: arac.id,
                plaka: arac.plaka,
                marka: arac.marka,
                tur: 'Kasko & Trafik',
                gecerlilikTarihi: k.bitisTarihi,
                kalanGun: kalanGun,
                durum: kalanGun < 0 ? 'GECIKTI' : kalanGun <= 15 ? 'KRITIK' : kalanGun <= 30 ? 'YAKLASTI' : 'GECERLI'
            });
        }
    });

    evrakListesi.sort((a, b) => a.kalanGun - b.kalanGun);

    return <EvrakTakipClient initialEvraklar={evrakListesi} />;
}
