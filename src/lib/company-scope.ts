export type DashboardSearchParams = Record<string, string | string[] | undefined>;

const SANTIYE_ALT_KATEGORI_VALUES = [
    "KAMYONET",
    "KAMYON",
    "CEKICI",
    "ROMORK",
    "TRAKTOR",
    "IS_MAKINESI",
] as const;

function normalizeAracKategoriToken(value: string | null | undefined) {
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

export function normalizeAracUstKategoriScope(value: string | null | undefined): "BINEK" | "SANTIYE" | null {
    const normalized = normalizeAracKategoriToken(value);
    if (!normalized) return null;

    if (["BINEK", "OTOMOBIL", "BINEK_ARAC"].includes(normalized)) return "BINEK";
    if (["SANTIYE", "IS_MAKINESI", "IS_MAKINASI", "IS_MAKINESI_ARACI", "SANTIYE_ARACI"].includes(normalized)) return "SANTIYE";

    return null;
}

export async function getSelectedSirketId(
    searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams
) {
    const resolved = searchParams ? await searchParams : {};
    const rawValue = resolved?.sirket;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
}

export async function getSelectedDisFirmaId(
    searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams
) {
    const resolved = searchParams ? await searchParams : {};
    const rawValue = resolved?.disFirmaId;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
}

export async function getSelectedKategori(
    searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams
): Promise<"BINEK" | "SANTIYE" | null> {
    const resolved = searchParams ? await searchParams : {};
    const rawValue = resolved?.kategori;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    return normalizeAracUstKategoriScope(value);
}

export function getAracUstKategoriWhere(kategori: "BINEK" | "SANTIYE") {
    if (kategori === "SANTIYE") {
        return {
            OR: [
                { kategori: "SANTIYE" },
                { altKategori: { in: [...SANTIYE_ALT_KATEGORI_VALUES] } },
            ],
        } as Record<string, unknown>;
    }

    return {
        OR: [
            { kategori: "BINEK" },
            { altKategori: "OTOMOBIL" },
        ],
    } as Record<string, unknown>;
}

export async function getSelectedYil(
    searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams
) {
    const resolved = searchParams ? await searchParams : {};
    const rawValue = resolved?.yil;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const parsed = Number(value);
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > currentYear) {
        return currentYear;
    }

    return parsed;
}

export async function getSelectedAy(
    searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams
) {
    const resolved = searchParams ? await searchParams : {};
    const rawValue = resolved?.ay;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const rawYearValue = resolved?.yil;
    const yearValue = Array.isArray(rawYearValue) ? rawYearValue[0] : rawYearValue;
    const normalized = value?.trim().toLowerCase();

    if (normalized === "all" || normalized === "__all__") {
        return null;
    }

    const parsed = Number(value);
    const parsedYear = Number(yearValue);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
        return currentMonth;
    }

    if (Number.isInteger(parsedYear) && parsedYear > currentYear) {
        return currentMonth;
    }

    if (Number.isInteger(parsedYear) && parsedYear === currentYear && parsed > currentMonth) {
        return currentMonth;
    }

    return parsed;
}

export function getAyDateRange(yil: number, ay: number | null) {
    if (ay == null) {
        return {
            start: new Date(yil, 0, 1, 0, 0, 0, 0),
            end: new Date(yil, 11, 31, 23, 59, 59, 999),
        };
    }

    return {
        start: new Date(yil, ay - 1, 1, 0, 0, 0, 0),
        end: new Date(yil, ay, 0, 23, 59, 59, 999),
    };
}

export function getYilDateRange(yil: number) {
    const start = new Date(yil, 0, 1, 0, 0, 0, 0);
    const end = new Date(yil, 11, 31, 23, 59, 59, 999);
    return { start, end };
}

export function withYilDateFilter<T extends Record<string, unknown>>(
    where: T,
    dateField: string,
    yil: number
) {
    const { start, end } = getYilDateRange(yil);
    return {
        AND: [
            where,
            {
                [dateField]: { gte: start, lte: end },
            },
        ],
    };
}

export function withAyDateFilter<T extends Record<string, unknown>>(
    where: T,
    dateField: string,
    yil: number,
    ay: number | null
) {
    const { start, end } = getAyDateRange(yil, ay);
    return {
        AND: [
            where,
            {
                [dateField]: { gte: start, lte: end },
            },
        ],
    };
}
