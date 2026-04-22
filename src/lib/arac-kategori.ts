export type AracUstKategori = "BINEK" | "SANTIYE";
export type AracAltKategori = "OTOMOBIL" | "MINIBUS" | "KAMYONET" | "KAMYON" | "CEKICI" | "ROMORK" | "TRAKTOR" | "IS_MAKINESI";

export const ARAC_UST_KATEGORI_LABELS: Record<AracUstKategori, string> = {
    BINEK: "Binek",
    SANTIYE: "İş Makinesi",
};

export const ARAC_ALT_KATEGORI_LABELS: Record<AracAltKategori, string> = {
    OTOMOBIL: "Otomobil",
    MINIBUS: "Minibüs",
    KAMYONET: "Kamyonet",
    KAMYON: "Kamyon",
    CEKICI: "Çekici",
    ROMORK: "Römork",
    TRAKTOR: "Traktör",
    IS_MAKINESI: "İş Makinesi",
};

export const ARAC_UST_KATEGORI_OPTIONS: Array<{ value: AracUstKategori; label: string }> = [
    { value: "BINEK", label: ARAC_UST_KATEGORI_LABELS.BINEK },
    { value: "SANTIYE", label: ARAC_UST_KATEGORI_LABELS.SANTIYE },
];

const ARAC_ALT_KATEGORI_BY_UST: Record<AracUstKategori, AracAltKategori[]> = {
    BINEK: ["OTOMOBIL", "MINIBUS"],
    SANTIYE: ["KAMYONET", "KAMYON", "MINIBUS", "CEKICI", "ROMORK", "TRAKTOR", "IS_MAKINESI"],
};

const DEFAULT_ALT_KATEGORI_BY_UST: Record<AracUstKategori, AracAltKategori> = {
    BINEK: "OTOMOBIL",
    SANTIYE: "KAMYONET",
};

const UST_KATEGORI_ALIASES: Record<AracUstKategori, string[]> = {
    BINEK: ["BINEK", "BINEK_ARAC", "HAFIF_TICARI", "OTOMOBIL"],
    SANTIYE: [
        "SANTIYE",
        "SANTIYE_ARACI",
        "IS_MAKINESI",
        "IS_MAKINASI",
        "IS MAKINESI",
        "IS MAKINASI",
        "KAMYONET",
        "KAMYON",
        "CEKICI",
        "ROMORK",
        "TRAKTOR",
        "TIR",
    ],
};

const ALT_KATEGORI_ALIASES: Record<AracAltKategori, string[]> = {
    OTOMOBIL: ["OTOMOBIL", "OTOMOBİL", "BINEK"],
    MINIBUS: ["MINIBUS", "MINIBÜS"],
    KAMYONET: ["KAMYONET"],
    KAMYON: ["KAMYON"],
    CEKICI: ["CEKICI", "ÇEKICI", "ÇEKİCİ", "TIR", "DORSE_CEKICI"],
    ROMORK: ["ROMORK", "RÖMORK", "DORSE"],
    TRAKTOR: ["TRAKTOR", "TRAKTÖR"],
    IS_MAKINESI: ["IS_MAKINESI", "IS MAKINESI", "IS_MAKINASI", "IS MAKINASI", "İŞ MAKİNESİ", "İŞ MAKİNASI"],
};

function normalizeCategoryToken(value: unknown) {
    return String(value || "")
        .trim()
        .toLocaleUpperCase("tr-TR")
        .replace(/İ/g, "I")
        .replace(/İ/g, "I")
        .replace(/Ş/g, "S")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ö/g, "O")
        .replace(/Ç/g, "C")
        .replace(/\s+/g, "_")
        .replace(/-/g, "_")
        .replace(/[^A-Z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function matchesAlias(token: string, aliases: string[]) {
    return aliases.some((alias) => normalizeCategoryToken(alias) === token);
}

export function normalizeAracKategori(value: unknown): AracUstKategori | null {
    const token = normalizeCategoryToken(value);
    if (!token) return null;

    if (matchesAlias(token, UST_KATEGORI_ALIASES.BINEK)) return "BINEK";
    if (matchesAlias(token, UST_KATEGORI_ALIASES.SANTIYE)) return "SANTIYE";
    return null;
}

export function normalizeAracAltKategori(value: unknown): AracAltKategori | null {
    const token = normalizeCategoryToken(value);
    if (!token) return null;

    for (const [kategori, aliases] of Object.entries(ALT_KATEGORI_ALIASES) as Array<[AracAltKategori, string[]]>) {
        if (matchesAlias(token, aliases)) {
            return kategori;
        }
    }
    return null;
}

export function getAracAltKategorileriByUstKategori(kategori: AracUstKategori) {
    return ARAC_ALT_KATEGORI_BY_UST[kategori];
}

export function getAracAltKategoriOptions(kategori: AracUstKategori) {
    return getAracAltKategorileriByUstKategori(kategori).map((value) => ({
        value,
        label: ARAC_ALT_KATEGORI_LABELS[value],
    }));
}

export function getDefaultAracAltKategori(kategori: AracUstKategori): AracAltKategori {
    return DEFAULT_ALT_KATEGORI_BY_UST[kategori];
}

export function isAracAltKategoriValidForUstKategori(kategori: AracUstKategori, altKategori: AracAltKategori) {
    return ARAC_ALT_KATEGORI_BY_UST[kategori].includes(altKategori);
}

export function inferAracKategoriFromAltKategori(altKategori: AracAltKategori): AracUstKategori | null {
    if (altKategori === "OTOMOBIL") return "BINEK";
    if (altKategori === "MINIBUS") return null;
    return "SANTIYE";
}

export function resolveAracKategoriFields(input: {
    kategori?: unknown;
    altKategori?: unknown;
}): { kategori: AracUstKategori; altKategori: AracAltKategori } {
    const normalizedKategori = normalizeAracKategori(input.kategori);
    const normalizedAltKategori = normalizeAracAltKategori(input.altKategori);

    const kategori =
        normalizedKategori ||
        (normalizedAltKategori ? inferAracKategoriFromAltKategori(normalizedAltKategori) : null) ||
        "BINEK";

    if (normalizedAltKategori && isAracAltKategoriValidForUstKategori(kategori, normalizedAltKategori)) {
        return { kategori, altKategori: normalizedAltKategori };
    }

    return { kategori, altKategori: getDefaultAracAltKategori(kategori) };
}
