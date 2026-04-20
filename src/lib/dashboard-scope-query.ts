export const DASHBOARD_SCOPE_YEAR_STORAGE_KEY = "dashboard-scope-year";
export const DASHBOARD_SCOPE_MONTH_STORAGE_KEY = "dashboard-scope-month";

export const DASHBOARD_SCOPED_QUERY_KEYS = ["sirket", "yil", "ay", "kategori"] as const;

type SearchLike = URLSearchParams | ReadonlyURLSearchParams | string | null | undefined;

type ReadonlyURLSearchParams = {
    get(name: string): string | null;
    toString(): string;
};

function toSearchParams(search: SearchLike) {
    if (!search) return new URLSearchParams();
    if (typeof search === "string") return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return new URLSearchParams(search.toString());
}

export function getCurrentDashboardYear() {
    return String(new Date().getFullYear());
}

export function getCurrentDashboardMonth() {
    return String(new Date().getMonth() + 1);
}

export function normalizeDashboardYear(value: string | null | undefined) {
    const parsed = Number(value);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(parsed) || parsed < 2000 || parsed > currentYear) return null;
    return String(parsed);
}

export function normalizeDashboardMonth(value: string | null | undefined, year?: string | null) {
    const normalized = value?.trim().toLowerCase();
    if (normalized === "all" || normalized === "__all__") return "all";

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) return null;

    const parsedYear = Number(year);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    if (Number.isInteger(parsedYear) && parsedYear === currentYear && parsed > currentMonth) return null;
    if (Number.isInteger(parsedYear) && parsedYear > currentYear) return null;

    return String(parsed);
}

export function persistDashboardPeriodFromSearch(search: SearchLike) {
    if (typeof window === "undefined") return;

    const params = toSearchParams(search);
    const year = normalizeDashboardYear(params.get("yil"));
    const month = normalizeDashboardMonth(params.get("ay"), year ?? params.get("yil"));

    if (year) window.localStorage.setItem(DASHBOARD_SCOPE_YEAR_STORAGE_KEY, year);
    if (month) window.localStorage.setItem(DASHBOARD_SCOPE_MONTH_STORAGE_KEY, month);
}

export function getStoredDashboardPeriod() {
    if (typeof window === "undefined") return { yil: null, ay: null };

    const storedYear = normalizeDashboardYear(window.localStorage.getItem(DASHBOARD_SCOPE_YEAR_STORAGE_KEY));
    const fallbackYear = storedYear ?? getCurrentDashboardYear();
    const storedMonth = normalizeDashboardMonth(window.localStorage.getItem(DASHBOARD_SCOPE_MONTH_STORAGE_KEY), fallbackYear);

    return {
        yil: storedYear,
        ay: storedMonth,
    };
}

export function ensureDashboardPeriodInSearch(search: SearchLike) {
    const params = toSearchParams(search);
    let changed = false;

    const currentYear = normalizeDashboardYear(params.get("yil"));
    if (!currentYear) {
        const stored = getStoredDashboardPeriod().yil;
        params.set("yil", stored ?? getCurrentDashboardYear());
        changed = true;
    }

    const effectiveYear = params.get("yil") ?? getCurrentDashboardYear();
    const currentMonth = normalizeDashboardMonth(params.get("ay"), effectiveYear);
    if (!currentMonth) {
        const stored = normalizeDashboardMonth(getStoredDashboardPeriod().ay, effectiveYear);
        params.set("ay", stored ?? getCurrentDashboardMonth());
        changed = true;
    }

    return { params, changed };
}

export function mergeDashboardScopeIntoHref(href: string, currentSearch: SearchLike) {
    if (typeof window === "undefined") return href;
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return href;

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return href;
    if (!url.pathname.startsWith("/dashboard")) return href;

    const currentParams = toSearchParams(currentSearch);
    const { params: periodParams } = ensureDashboardPeriodInSearch(currentParams);

    for (const key of DASHBOARD_SCOPED_QUERY_KEYS) {
        if (url.searchParams.has(key)) continue;
        const value = periodParams.get(key) ?? currentParams.get(key);
        if (value) url.searchParams.set(key, value);
    }

    const query = url.searchParams.toString();
    return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
