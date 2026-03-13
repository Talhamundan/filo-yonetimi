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
