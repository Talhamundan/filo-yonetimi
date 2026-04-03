import prisma from "@/lib/prisma";

function normalizeSirketId(value: unknown) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
}

export async function resolveVehicleUsageCompanyId(params: {
    aracId: string;
    fallbackSirketId?: string | null;
}) {
    const fallbackSirketId = normalizeSirketId(params.fallbackSirketId);

    const aktifZimmet = await (prisma as any).kullaniciZimmet
        .findFirst({
            where: { aracId: params.aracId, bitis: null },
            orderBy: { baslangic: "desc" },
            select: {
                kullanici: { select: { sirketId: true } },
            },
        })
        .catch(() => null);
    const aktifZimmetSirketId = normalizeSirketId(aktifZimmet?.kullanici?.sirketId);
    if (aktifZimmetSirketId) {
        return aktifZimmetSirketId;
    }

    const arac = await (prisma as any).arac
        .findUnique({
            where: { id: params.aracId },
            select: {
                sirketId: true,
                kullanici: { select: { sirketId: true, deletedAt: true } },
            },
        })
        .catch(() => null);

    const aktifKullaniciSirketId =
        arac?.kullanici && !arac.kullanici.deletedAt ? normalizeSirketId(arac.kullanici.sirketId) : null;

    return aktifKullaniciSirketId || fallbackSirketId || normalizeSirketId(arac?.sirketId);
}
