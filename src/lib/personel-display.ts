type PersonelLike = {
    id?: string | null;
    ad?: string | null;
    soyad?: string | null;
    deletedAt?: Date | string | null;
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
