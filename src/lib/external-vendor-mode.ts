import type { DashboardSearchParams } from "@/lib/company-scope";

export const EXTERNAL_VENDOR_MODES = ["KIRALIK", "TASERON"] as const;
export type ExternalVendorMode = (typeof EXTERNAL_VENDOR_MODES)[number];

export function parseExternalVendorModeFromSearchParams(
    searchParams?: DashboardSearchParams
): ExternalVendorMode | null {
    const rawValue = searchParams?.externalMode;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const normalized = (value || "").trim().toUpperCase();

    return EXTERNAL_VENDOR_MODES.includes(normalized as ExternalVendorMode)
        ? (normalized as ExternalVendorMode)
        : null;
}

