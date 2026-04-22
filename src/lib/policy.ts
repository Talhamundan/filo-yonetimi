import type { OnayDurumu, Rol } from "@prisma/client";

export type PolicyModelName =
    | "sirket"
    | "arac"
    | "kullanici"
    | "personel"
    | "yakit"
    | "ceza"
    | "masraf"
    | "bakim"
    | "arizaKaydi"
    | "muayene"
    | "kasko"
    | "trafikSigortasi"
    | "dokuman"
    | "activityLog"
    | "kullaniciZimmet"
    | "zimmet"
    | string;

const GLOBAL_SCOPE_ROLES = new Set<Rol>(["ADMIN"]);
const DRIVER_RESTRICTED_DASHBOARD_PATHS = [
    "/dashboard/personel",
    "/dashboard/yetkilendirme-paneli",
    "/dashboard/sirketler",
    "/dashboard/taseronlar",
    "/dashboard/kiraliklar",
    "/dashboard/finans",
    "/dashboard/aktivite-gecmisi",
    "/dashboard/cop-kutusu",
] as const;

const ROLE_VALUES: readonly Rol[] = ["ADMIN", "YETKILI", "PERSONEL", "TEKNIK"] as const;
const LEGACY_ROLE_ALIASES: Record<string, Rol> = {
    YONETICI: "YETKILI",
    MUDUR: "YETKILI",
    MUHASEBECI: "YETKILI",
};
const AGENCY_COMPANY_NAMES = ["HISAR SIGORTA", "ERÇAL SIGORTA"] as const;
const SOFT_DELETE_MODELS = new Set<PolicyModelName>([
    "arac",
    "kullanici",
    "personel",
    "masraf",
    "bakim",
    "ceza",
    "dokuman",
]);
const VEHICLE_RELATION_MODELS = new Set<PolicyModelName>([
    "yakit",
    "ceza",
    "masraf",
    "bakim",
    "arizaKaydi",
    "muayene",
    "kasko",
    "trafikSigortasi",
    "dokuman",
    "kullaniciZimmet",
    "zimmet",
]);

export function normalizeRole(role: string | null | undefined): Rol | null {
    if (!role) return null;
    if (ROLE_VALUES.includes(role as Rol)) {
        return role as Rol;
    }
    return LEGACY_ROLE_ALIASES[role] ?? null;
}

function normalizeCompanyName(value: string | null | undefined) {
    return String(value || "")
        .trim()
        .toLocaleUpperCase("tr-TR")
        .replace(/Ç/g, "C")
        .replace(/İ/g, "I")
        .replace(/Ş/g, "S")
        .replace(/Ğ/g, "G")
        .replace(/Ü/g, "U")
        .replace(/Ö/g, "O");
}

export function isAraciKurumRole(role: string | null | undefined) {
    const normalized = String(role || "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "_");
    return normalized === "ARACI_KURUM";
}

export function isAraciKurumCompany(companyName: string | null | undefined) {
    const normalized = normalizeCompanyName(companyName);
    if (!normalized) return false;
    const companySet = new Set(AGENCY_COMPANY_NAMES.map((item) => normalizeCompanyName(item)));
    return companySet.has(normalized);
}

export function isAraciKurumOperator(role: string | null | undefined, companyName: string | null | undefined) {
    if (isAraciKurumRole(role)) return true;
    return normalizeRole(role) === "YETKILI" && isAraciKurumCompany(companyName);
}

export function resolveEffectiveSessionRole(role: string | null | undefined, companyName: string | null | undefined) {
    if (isAraciKurumOperator(role, companyName)) return "ARACI_KURUM";
    return role || null;
}

export function canRoleAccessAllCompanies(
    role: string | null | undefined,
    sirketId?: string | null | undefined
) {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) return false;
    if (GLOBAL_SCOPE_ROLES.has(normalizedRole)) return true;

    const normalizedSirketId = typeof sirketId === "string" ? sirketId.trim() : sirketId;
    return (normalizedRole === "YETKILI" || normalizedRole === "TEKNIK") && !normalizedSirketId;
}

export function canRoleAssignIndependentRecords(
    role: string | null | undefined,
    sirketId?: string | null | undefined
) {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) return false;

    const normalizedSirketId = typeof sirketId === "string" ? sirketId.trim() : sirketId;
    if (normalizedSirketId) return false;

    return normalizedRole === "ADMIN" || normalizedRole === "YETKILI" || normalizedRole === "TEKNIK";
}

export function isDriverRole(role: string | null | undefined) {
    return normalizeRole(role) === "PERSONEL";
}

export function isAdminRole(role: string | null | undefined) {
    return normalizeRole(role) === "ADMIN";
}

export function shouldForceWaitingPage(
    role: string | null | undefined,
    onayDurumu: string | OnayDurumu | null | undefined
) {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) return false;
    if (normalizedRole === "ADMIN") return false;
    return onayDurumu !== "ONAYLANDI";
}

export function isDashboardPathRestrictedForRole(role: string | null | undefined, path: string) {
    if (!isDriverRole(role)) return false;
    return DRIVER_RESTRICTED_DASHBOARD_PATHS.some((restrictedPath) => path.startsWith(restrictedPath));
}

export function isDashboardPathRestrictedForAraciKurum(
    role: string | null | undefined,
    companyName: string | null | undefined,
    path: string
) {
    if (!isAraciKurumOperator(role, companyName)) return false;
    if (path === "/dashboard/bekleme") return false;
    return !(path === "/dashboard/sigortaci" || path.startsWith("/dashboard/sigortaci/"));
}

function getBlockedFilter(modelName: PolicyModelName) {
    if (modelName === "sirket") {
        return { id: "blocked" };
    }

    return { id: "blocked" };
}

function getVehicleUsageCompanyFilter(sirketId: string) {
    return {
        OR: [
            { kullanici: { sirketId, deletedAt: null } },
            {
                kullaniciGecmisi: {
                    some: {
                        bitis: null,
                        kullanici: { sirketId, deletedAt: null },
                    },
                },
            },
        ],
    };
}

function getCompanyModelFilter(modelName: PolicyModelName, sirketId: string | null) {
    if (modelName === "sirket") {
        return sirketId ? { id: sirketId } : {};
    }

    if (!sirketId) {
        return {};
    }

    switch (modelName) {
        case "arac":
            return getVehicleUsageCompanyFilter(sirketId);
        case "kullanici":
        case "personel":
            return { sirketId };
        case "yakit":
        case "ceza":
        case "masraf":
        case "arizaKaydi":
        case "muayene":
        case "kasko":
        case "trafikSigortasi":
        case "dokuman":
            return { arac: getVehicleUsageCompanyFilter(sirketId) };
        case "bakim":
            return {
                OR: [
                    { arac: getVehicleUsageCompanyFilter(sirketId) },
                    { AND: [{ aracId: null }, { sirketId }] },
                ],
            };
        case "activityLog":
            return { companyId: sirketId };
        case "kullaniciZimmet":
        case "zimmet":
            return { arac: getVehicleUsageCompanyFilter(sirketId) };
        default:
            return { sirketId };
    }
}

function getDriverModelFilter(modelName: PolicyModelName, userId: string, sirketId: string | null) {
    const aracRelatedModels = [
        "yakit",
        "ceza",
        "masraf",
        "bakim",
        "muayene",
        "kasko",
        "trafikSigortasi",
        "dokuman",
        "kullaniciZimmet",
        "zimmet",
    ] as const;

    if (aracRelatedModels.includes(modelName as (typeof aracRelatedModels)[number])) {
        return { arac: { kullaniciId: userId, deletedAt: null } };
    }
    if (modelName === "arac") {
        return { kullaniciId: userId, deletedAt: null };
    }
    if (modelName === "kullanici" || modelName === "personel") {
        return { id: userId, deletedAt: null };
    }
    if (modelName === "sirket") {
        return { id: sirketId || "blocked" };
    }
    return { id: "none" };
}

function withSoftDeleteFilter(modelName: PolicyModelName, where: Record<string, unknown>, includeDeleted = false) {
    if (includeDeleted || !SOFT_DELETE_MODELS.has(modelName)) {
        return where;
    }
    return { ...where, deletedAt: null };
}

function withActiveVehicleFilter(modelName: PolicyModelName, where: Record<string, unknown>, includeDeleted = false) {
    if (includeDeleted || !VEHICLE_RELATION_MODELS.has(modelName)) {
        return where;
    }

    if (modelName === "bakim") {
        const existingAracFilter =
            where.arac && typeof where.arac === "object" && !Array.isArray(where.arac)
                ? (where.arac as Record<string, unknown>)
                : {};
        return {
            AND: [
                where,
                {
                    OR: [
                        {
                            arac: {
                                ...existingAracFilter,
                                deletedAt: null,
                            },
                        },
                        { aracId: null },
                    ],
                },
            ],
        };
    }

    const existingAracFilter =
        where.arac && typeof where.arac === "object" && !Array.isArray(where.arac)
            ? (where.arac as Record<string, unknown>)
            : {};
    return {
        ...where,
        arac: {
            ...existingAracFilter,
            deletedAt: null,
        },
    };
}

export function getModelFilterByPolicy(params: {
    modelName: PolicyModelName;
    role: string | null | undefined;
    currentSirketId: string | null | undefined;
    currentUserId: string | null | undefined;
    requestedSirketId: string | null;
    includeDeleted?: boolean;
}) {
    const { modelName, role, currentSirketId, currentUserId, requestedSirketId, includeDeleted = false } = params;
    const normalizedRole = normalizeRole(role);

    if (!normalizedRole) {
        return getBlockedFilter(modelName);
    }

    if (canRoleAccessAllCompanies(normalizedRole, currentSirketId)) {
        return withActiveVehicleFilter(
            modelName,
            withSoftDeleteFilter(modelName, getCompanyModelFilter(modelName, requestedSirketId), includeDeleted),
            includeDeleted
        );
    }

    if (normalizedRole === "PERSONEL") {
        if (!currentUserId) return getBlockedFilter(modelName);
        return withActiveVehicleFilter(
            modelName,
            withSoftDeleteFilter(
                modelName,
                getDriverModelFilter(modelName, currentUserId, currentSirketId || null),
                includeDeleted
            ),
            includeDeleted
        );
    }

    return withActiveVehicleFilter(
        modelName,
        withSoftDeleteFilter(modelName, getCompanyModelFilter(modelName, currentSirketId || null), includeDeleted),
        includeDeleted
    );
}
