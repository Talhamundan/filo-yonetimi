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
    | "muayene"
    | "kasko"
    | "trafikSigortasi"
    | "dokuman"
    | "hgs"
    | "hgsYukleme"
    | "activityLog"
    | "kullaniciZimmet"
    | "zimmet"
    | string;

const GLOBAL_SCOPE_ROLES = new Set<Rol>(["ADMIN", "YONETICI"]);
const DRIVER_RESTRICTED_DASHBOARD_PATHS = [
    "/dashboard/personel",
    "/dashboard/onay-merkezi",
    "/dashboard/sirketler",
    "/dashboard/finans",
    "/dashboard/aktivite-gecmisi",
    "/dashboard/cop-kutusu",
] as const;

const ROLE_VALUES: readonly Rol[] = ["ADMIN", "YONETICI", "MUDUR", "MUHASEBECI", "SOFOR"] as const;
const SOFT_DELETE_MODELS = new Set<PolicyModelName>([
    "arac",
    "kullanici",
    "personel",
    "masraf",
    "bakim",
    "ceza",
    "dokuman",
]);

export function normalizeRole(role: string | null | undefined): Rol | null {
    if (!role) return null;
    return ROLE_VALUES.includes(role as Rol) ? (role as Rol) : null;
}

export function canRoleAccessAllCompanies(role: string | null | undefined) {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) return false;
    return GLOBAL_SCOPE_ROLES.has(normalizedRole);
}

export function isDriverRole(role: string | null | undefined) {
    return normalizeRole(role) === "SOFOR";
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

function getBlockedFilter(modelName: PolicyModelName) {
    if (modelName === "sirket") {
        return { id: "blocked" };
    }

    return { id: "blocked" };
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
        case "kullanici":
        case "personel":
        case "yakit":
        case "ceza":
        case "masraf":
        case "bakim":
        case "muayene":
        case "kasko":
        case "trafikSigortasi":
        case "dokuman":
        case "hgs":
        case "hgsYukleme":
            return { sirketId };
        case "activityLog":
            return { companyId: sirketId };
        case "kullaniciZimmet":
        case "zimmet":
            return { arac: { sirketId, deletedAt: null } };
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

    if (canRoleAccessAllCompanies(normalizedRole)) {
        return withSoftDeleteFilter(modelName, getCompanyModelFilter(modelName, requestedSirketId), includeDeleted);
    }

    if (normalizedRole === "SOFOR") {
        if (!currentUserId) return getBlockedFilter(modelName);
        return withSoftDeleteFilter(
            modelName,
            getDriverModelFilter(modelName, currentUserId, currentSirketId || null),
            includeDeleted
        );
    }

    return withSoftDeleteFilter(modelName, getCompanyModelFilter(modelName, currentSirketId || null), includeDeleted);
}
