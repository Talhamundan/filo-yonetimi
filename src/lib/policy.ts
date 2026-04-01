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
    | "hgs"
    | "hgsYukleme"
    | "activityLog"
    | "kullaniciZimmet"
    | "zimmet"
    | string;

const GLOBAL_SCOPE_ROLES = new Set<Rol>(["ADMIN"]);
const DRIVER_RESTRICTED_DASHBOARD_PATHS = [
    "/dashboard/personel",
    "/dashboard/yetkilendirme-paneli",
    "/dashboard/sirketler",
    "/dashboard/finans",
    "/dashboard/aktivite-gecmisi",
    "/dashboard/cop-kutusu",
] as const;

const ROLE_VALUES: readonly Rol[] = ["ADMIN", "YETKILI", "SOFOR", "TEKNIK"] as const;
const LEGACY_ROLE_ALIASES: Record<string, Rol> = {
    YONETICI: "YETKILI",
    MUDUR: "YETKILI",
    MUHASEBECI: "YETKILI",
};
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
    "hgs",
    "hgsYukleme",
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
        case "bakim":
        case "arizaKaydi":
        case "muayene":
        case "kasko":
        case "trafikSigortasi":
        case "dokuman":
        case "hgs":
        case "hgsYukleme":
            return { arac: getVehicleUsageCompanyFilter(sirketId) };
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

    if (normalizedRole === "SOFOR") {
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
