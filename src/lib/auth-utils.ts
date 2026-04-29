import { auth } from "@/auth";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
    canRoleAccessAllCompanies,
    getModelFilterByPolicy,
    isAdminRole,
    isDriverRole,
    normalizeRole,
} from "@/lib/policy";

/**
 * auth() çağrısını bir request içinde memoize eder.
 * Böylece aynı request içinde birden fazla auth-utils fonksiyonu çağrılsa bile
 * JWT doğrulaması sadece BİR KEZ yapılır.
 */
const getSession = cache(async () => {
    return await auth();
});

const getSirketNameById = cache(async (sirketId?: string | null) => {
    const normalizedId = typeof sirketId === "string" ? sirketId.trim() : "";
    if (!normalizedId) return null;

    const sirket = await prisma.sirket
        .findUnique({
            where: { id: normalizedId },
            select: { ad: true },
        })
        .catch(() => null);

    return typeof sirket?.ad === "string" && sirket.ad.trim().length > 0 ? sirket.ad.trim() : null;
});

const getSirketNamesByIds = cache(async (idsKey: string) => {
    const ids = idsKey.split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return {} as Record<string, string | null>;
    const rows = await prisma.sirket.findMany({
        where: { id: { in: ids } },
        select: { id: true, ad: true },
    }).catch(() => []);
    return Object.fromEntries(rows.map((row) => [row.id, row.ad || null])) as Record<string, string | null>;
});

function getAuthorizedCompanyIds(user: { yetkiliSirketIds?: string[] | null; sirketId?: string | null }) {
    const ids = [...new Set((user.yetkiliSirketIds || []).map((id) => id.trim()).filter(Boolean))];
    return ids.length > 0 ? ids : [];
}

function getRequestedCompanyId(value?: string | null) {
    const trimmed = value?.trim();
    const normalized = trimmed?.toLowerCase();
    if (!trimmed || normalized === "all" || normalized === "__all__") return null;
    return trimmed;
}

/**
 * Mevcut oturumdaki kullanıcının şirket filtresini döner.
 */
export async function getSirketFilter(selectedSirketId?: string | null) {
    const session = await getSession();
    if (!session?.user) return { sirketId: "blocked" };

    const { rol, sirketId } = session.user;
    const authorizedSirketIds = getAuthorizedCompanyIds(session.user);
    const requestedCompanyId = getRequestedCompanyId(selectedSirketId);

    if (canRoleAccessAllCompanies(rol, sirketId, authorizedSirketIds)) {
        return requestedCompanyId ? { sirketId: requestedCompanyId } : {};
    }
    if (authorizedSirketIds.length > 0) {
        return requestedCompanyId && authorizedSirketIds.includes(requestedCompanyId)
            ? { sirketId: requestedCompanyId }
            : { sirketId: { in: authorizedSirketIds } };
    }

    return { sirketId: sirketId || "blocked" };
}

/**
 * Modele göre yetki bazlı filtre döner.
 * @param modelName Prisma model adı (küçük harf)
 */
export async function getModelFilter(modelName: string, selectedSirketId?: string | null) {
    return getModelFilterWithOptions(modelName, selectedSirketId, { includeDeleted: false });
}

/**
 * Araç kullanım kapsamı filtresi:
 * - Standart politika filtresini kullanır
 * - `calistigiKurum` eşlemeleri policy katmanında yönetilir
 */
export async function getAracUsageFilter(selectedSirketId?: string | null) {
    const baseFilter = (await getModelFilter("arac", selectedSirketId)) as Record<string, unknown>;
    return baseFilter;
}

export async function getModelFilterWithOptions(
    modelName: string,
    selectedSirketId?: string | null,
    options?: { includeDeleted?: boolean }
) {
    const session = await getSession();
    if (!session?.user) {
        return modelName === "sirket" ? { id: "blocked" } : { id: "blocked" };
    }

    const { rol, sirketId, id: userId } = session.user;
    const authorizedSirketIds = getAuthorizedCompanyIds(session.user);
    const requestedCompanyId = getRequestedCompanyId(selectedSirketId);
    const authorizedSirketNamesById = await getSirketNamesByIds(authorizedSirketIds.join(","));
    const [currentSirketName, requestedSirketName] = await Promise.all([
        getSirketNameById(sirketId),
        getSirketNameById(requestedCompanyId),
    ]);

    return getModelFilterByPolicy({
        modelName,
        role: rol,
        currentSirketId: sirketId,
        currentSirketName,
        authorizedSirketIds,
        authorizedSirketNamesById,
        currentUserId: userId,
        requestedSirketId: requestedCompanyId,
        requestedSirketName,
        includeDeleted: options?.includeDeleted ?? false,
    });
}

/**
 * Personel secim listeleri icin kapsam kurali:
 * - Global kapsam rolleri seçili şirkete göre filtreleyebilir
 * - Şirkete bağlı kullanıcılar kendi şirket kapsamı ile devam eder
 * - Şoför rolü politika gereği kendi kaydını görür
 */
export async function getPersonnelSelectFilter(selectedSirketId?: string | null) {
    const session = await getSession();
    if (!session?.user) {
        return { id: "blocked" };
    }

    const { rol, sirketId, id: userId } = session.user;
    const authorizedSirketIds = getAuthorizedCompanyIds(session.user);
    const currentSirketId = getRequestedCompanyId(sirketId);
    const selectedCompanyId = getRequestedCompanyId(selectedSirketId);
    const requestedSirketId = isDriverRole(rol)
        ? null
        : canRoleAccessAllCompanies(rol, currentSirketId, authorizedSirketIds)
            ? selectedCompanyId
            : selectedCompanyId && authorizedSirketIds.includes(selectedCompanyId)
                ? selectedCompanyId
                : currentSirketId;
    const authorizedSirketNamesById = await getSirketNamesByIds(authorizedSirketIds.join(","));
    const [currentSirketName, requestedSirketName] = await Promise.all([
        getSirketNameById(currentSirketId),
        getSirketNameById(requestedSirketId),
    ]);

    return getModelFilterByPolicy({
        modelName: "kullanici",
        role: rol,
        currentSirketId: currentSirketId,
        currentSirketName,
        authorizedSirketIds,
        authorizedSirketNamesById,
        currentUserId: userId,
        requestedSirketId,
        requestedSirketName,
        includeDeleted: false,
    });
}

export async function canAccessAllCompanies() {
    const session = await getSession();
    return canRoleAccessAllCompanies(session?.user?.rol, session?.user?.sirketId, getAuthorizedCompanyIds(session?.user || {}));
}

export async function getSirketListFilter() {
    const session = await getSession();
    if (!session?.user) {
        return { id: "blocked" };
    }

    const { rol, sirketId } = session.user;
    const authorizedSirketIds = getAuthorizedCompanyIds(session.user);
    if (canRoleAccessAllCompanies(rol, sirketId, authorizedSirketIds)) {
        return {};
    }
    if (authorizedSirketIds.length > 0) {
        return { id: { in: authorizedSirketIds } };
    }

    return { id: sirketId || "blocked" };
}

export async function getScopedSirketId(selectedSirketId?: string | null) {
    const session = await getSession();
    if (!session?.user) return null;

    const { rol, sirketId } = session.user;
    const authorizedSirketIds = getAuthorizedCompanyIds(session.user);
    if (canRoleAccessAllCompanies(rol, sirketId, authorizedSirketIds)) {
        return getRequestedCompanyId(selectedSirketId);
    }
    const requested = getRequestedCompanyId(selectedSirketId);
    if (requested && authorizedSirketIds.includes(requested)) return requested;

    return sirketId || null;
}

export async function getCurrentSirketId() {
    const session = await getSession();
    return session?.user?.sirketId || null;
}

export async function getCurrentUserRole() {
    const session = await getSession();
    return normalizeRole(session?.user?.rol || null);
}

export async function isSofor() {
    const session = await getSession();
    return isDriverRole(session?.user?.rol);
}

export async function isAdmin() {
    const session = await getSession();
    return isAdminRole(session?.user?.rol);
}

export async function getCurrentUserId() {
    const session = await getSession();
    return session?.user?.id || null;
}
