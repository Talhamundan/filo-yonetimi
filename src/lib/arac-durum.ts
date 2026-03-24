import prisma from "@/lib/prisma";

type TxClient = typeof prisma | any;

export type ComputedAracDurumu = "AKTIF" | "BOSTA" | "ARIZALI" | "SERVISTE";

type ArizaDurumuRow = { durum: "ACIK" | "SERVISTE" | "TAMAMLANDI" | "IPTAL" };

export function computeAracDurumu(params: {
    hasDriver: boolean;
    hasOpenAriza: boolean;
    hasServisteAriza: boolean;
}): ComputedAracDurumu {
    if (params.hasServisteAriza) return "SERVISTE";
    if (params.hasOpenAriza) return "ARIZALI";
    return params.hasDriver ? "AKTIF" : "BOSTA";
}

async function getOpenArizaRows(aracId: string, tx: TxClient): Promise<ArizaDurumuRow[]> {
    const arizaModel = tx?.arizaKaydi;
    if (!arizaModel?.findMany) {
        return [];
    }

    try {
        return (await arizaModel.findMany({
            where: {
                aracId,
                durum: { in: ["ACIK", "SERVISTE"] },
            },
            select: { durum: true },
        })) as ArizaDurumuRow[];
    } catch {
        return [];
    }
}

export async function syncAracDurumu(aracId: string, tx: TxClient = prisma): Promise<ComputedAracDurumu | null> {
    const arac = await tx.arac.findUnique({
        where: { id: aracId },
        select: { id: true, durum: true, kullaniciId: true },
    });
    if (!arac) return null;

    const openArizalar = await getOpenArizaRows(arac.id, tx);
    const hasServisteAriza = openArizalar.some((row) => row.durum === "SERVISTE");
    const hasOpenAriza = openArizalar.length > 0;
    const nextDurum = computeAracDurumu({
        hasDriver: Boolean(arac.kullaniciId),
        hasOpenAriza,
        hasServisteAriza,
    });

    if (arac.durum !== nextDurum) {
        await tx.arac.update({
            where: { id: arac.id },
            data: { durum: nextDurum },
        });
    }

    return nextDurum;
}

export async function syncAllAracDurumlari(tx: TxClient = prisma) {
    const araclar = await tx.arac.findMany({ select: { id: true } });
    let updatedCount = 0;

    for (const arac of araclar) {
        const prev = await tx.arac.findUnique({
            where: { id: arac.id },
            select: { durum: true },
        });
        const next = await syncAracDurumu(arac.id, tx);
        if (prev?.durum && next && prev.durum !== next) {
            updatedCount += 1;
        }
    }

    return { total: araclar.length, updated: updatedCount };
}
