import type { DashboardSearchParams } from "@/lib/company-scope";

export type CommonListFilters = {
    q: string;
    status: string | null;
    type: string | null;
    from: Date | null;
    to: Date | null;
    trashed: boolean;
};

function normalizeString(value: string | string[] | undefined) {
    if (!value) return null;
    const text = Array.isArray(value) ? value[0] || null : value;
    const trimmed = text?.trim();
    return trimmed ? trimmed : null;
}

function parseDate(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export async function getCommonListFilters(
    searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams
): Promise<CommonListFilters> {
    const resolved = searchParams ? await searchParams : {};
    const q = normalizeString(resolved.q) || "";
    const status = normalizeString(resolved.status);
    const type = normalizeString(resolved.type);
    const from = parseDate(normalizeString(resolved.from));
    if (from) from.setHours(0, 0, 0, 0);
    const to = parseDate(normalizeString(resolved.to));
    if (to) to.setHours(23, 59, 59, 999);
    const trashed = normalizeString(resolved.trashed) === "1";

    return { q, status, type, from, to, trashed };
}

export function getDateRangeFilter(from: Date | null, to: Date | null) {
    if (!from && !to) return undefined;
    return {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
    };
}
