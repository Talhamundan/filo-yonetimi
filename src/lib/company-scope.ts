export type DashboardSearchParams = Record<string, string | string[] | undefined>;

export async function getSelectedSirketId(
    searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams
) {
    const resolved = searchParams ? await searchParams : {};
    const rawValue = resolved?.sirket;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
}

export async function getSelectedYil(
    searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams
) {
    const resolved = searchParams ? await searchParams : {};
    const rawValue = resolved?.yil;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const parsed = Number(value);
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
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
