import prisma from "@/lib/prisma";

type AktifZimmetRow = {
    kullanici: { sirketId: string | null; calistigiKurum: string | null } | null;
};

type AracWithKullaniciRow = {
    calistigiKurum: string | null;
    kullanici: { sirketId: string | null; calistigiKurum: string | null; deletedAt: Date | null } | null;
};

function normalizeSirketId(value: unknown) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
}

function normalizeCompanyName(value: unknown) {
    const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
    return normalized || null;
}

async function findSirketIdByName(value: unknown) {
    const name = normalizeCompanyName(value);
    if (!name) return null;

    const sirket = await prisma.sirket
        .findFirst({
            where: { ad: { equals: name, mode: "insensitive" } },
            select: { id: true },
        })
        .catch(() => null);

    return normalizeSirketId(sirket?.id);
}

export async function resolveVehicleUsageCompanyId(params: {
    aracId: string;
}) {
    const aktifZimmet = await prisma.kullaniciZimmet
        .findFirst({
            where: { aracId: params.aracId, bitis: null },
            orderBy: { baslangic: "desc" },
            select: {
                kullanici: { select: { sirketId: true, calistigiKurum: true } },
            },
        })
        .catch(() => null) as AktifZimmetRow | null;
    const arac = await prisma.arac
        .findUnique({
            where: { id: params.aracId },
            select: {
                calistigiKurum: true,
                kullanici: { select: { sirketId: true, calistigiKurum: true, deletedAt: true } },
            },
        })
        .catch(() => null) as AracWithKullaniciRow | null;

    const aracKullaniciFirmaSirketId = await findSirketIdByName(arac?.calistigiKurum);
    if (aracKullaniciFirmaSirketId) {
        return aracKullaniciFirmaSirketId;
    }

    const aktifZimmetSirketId = normalizeSirketId(aktifZimmet?.kullanici?.sirketId);
    if (aktifZimmetSirketId) {
        return aktifZimmetSirketId;
    }

    const aktifZimmetKurumSirketId = await findSirketIdByName(aktifZimmet?.kullanici?.calistigiKurum);
    if (aktifZimmetKurumSirketId) {
        return aktifZimmetKurumSirketId;
    }

    const aktifKullaniciSirketId =
        arac?.kullanici && !arac.kullanici.deletedAt ? normalizeSirketId(arac.kullanici.sirketId) : null;
    if (aktifKullaniciSirketId) {
        return aktifKullaniciSirketId;
    }

    if (arac?.kullanici && !arac.kullanici.deletedAt) {
        const aktifKullaniciKurumSirketId = await findSirketIdByName(arac.kullanici.calistigiKurum);
        if (aktifKullaniciKurumSirketId) {
            return aktifKullaniciKurumSirketId;
        }
    }

    return null;
}
