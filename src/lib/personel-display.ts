type PersonelLike = {
    id?: string | null;
    ad?: string | null;
    soyad?: string | null;
    deletedAt?: Date | string | null;
};

type PersonelOptionLike = {
    ad?: string | null;
    soyad?: string | null;
    adSoyad?: string | null;
    sirketAd?: string | null;
    calistigiKurum?: string | null;
};

export const ESKI_PERSONEL_ETIKETI = "Eski Personel";

export function isDeletedPersonel(personel?: PersonelLike | null) {
    return Boolean(personel?.deletedAt);
}

export function getPersonelDisplayName(
    personel?: PersonelLike | null,
    options?: { fallback?: string; deletedLabel?: string }
) {
    const fallback = options?.fallback ?? "-";
    const deletedLabel = options?.deletedLabel ?? ESKI_PERSONEL_ETIKETI;

    if (!personel) return fallback;
    if (isDeletedPersonel(personel)) return deletedLabel;

    const ad = typeof personel.ad === "string" ? personel.ad.trim() : "";
    const soyad = typeof personel.soyad === "string" ? personel.soyad.trim() : "";
    const fullName = `${ad} ${soyad}`.trim();

    return fullName || fallback;
}

export function getActivePersonelId(personel?: PersonelLike | null) {
    if (!personel || isDeletedPersonel(personel)) return null;
    return personel.id || null;
}

function normalizeText(value: string | null | undefined) {
    return typeof value === "string" ? value.trim() : "";
}

export function getPersonelCompanyName(personel?: PersonelOptionLike | null) {
    const sirketAd = normalizeText(personel?.sirketAd);
    if (sirketAd) return sirketAd;

    const calistigiKurum = normalizeText(personel?.calistigiKurum);
    if (calistigiKurum) return calistigiKurum;

    return "";
}

export function getPersonelOptionLabel(
    personel?: PersonelOptionLike | null,
    options?: { fallback?: string; includeCompany?: boolean }
) {
    const fallback = options?.fallback ?? "-";
    const includeCompany = options?.includeCompany ?? true;
    const adSoyad = normalizeText(personel?.adSoyad);
    const ad = normalizeText(personel?.ad);
    const soyad = normalizeText(personel?.soyad);
    const baseLabel = adSoyad || `${ad} ${soyad}`.trim() || fallback;

    if (!includeCompany) return baseLabel;

    const kurum = getPersonelCompanyName(personel);
    if (!kurum) return baseLabel;

    const normalizedBase = baseLabel.toLocaleLowerCase("tr-TR");
    const normalizedKurum = kurum.toLocaleLowerCase("tr-TR");
    if (normalizedBase.endsWith(` - ${normalizedKurum}`)) {
        return baseLabel;
    }

    return `${baseLabel} - ${kurum}`;
}

export function getPersonelOptionSearchText(
    personel?: PersonelOptionLike | null,
    options?: { fallback?: string }
) {
    const baseLabel = getPersonelOptionLabel(personel, {
        fallback: options?.fallback,
        includeCompany: false,
    });
    const kurum = getPersonelCompanyName(personel);
    return [baseLabel, kurum].filter(Boolean).join(" ");
}
