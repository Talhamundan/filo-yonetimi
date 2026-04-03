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

function getRequestedCompanyId(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

/**
 * Mevcut oturumdaki kullanıcının şirket filtresini döner.
 */
export async function getSirketFilter(selectedSirketId?: string | null) {
    const session = await getSession();
    if (!session?.user) return { sirketId: "blocked" };

    const { rol, sirketId } = session.user;
    const requestedCompanyId = getRequestedCompanyId(selectedSirketId);

    if (canRoleAccessAllCompanies(rol, sirketId)) {
        return requestedCompanyId ? { sirketId: requestedCompanyId } : {};
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

function normalizeCompanyName(value: string | null | undefined) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
}

/**
 * Araç kullanım kapsamı filtresi:
 * - Standart politika filtresini korur
 * - Seçili kapsam şirketi varsa, manuel girilmiş `calistigiKurum` metnini de aynı şirkete eşler
 */
export async function getAracUsageFilter(selectedSirketId?: string | null) {
    const baseFilter = (await getModelFilter("arac", selectedSirketId)) as Record<string, unknown>;
    const session = await getSession();
    const role = session?.user?.rol;

    if (isDriverRole(role)) {
        return baseFilter;
    }

    const scopedSirketId = await getScopedSirketId(selectedSirketId);
    if (!scopedSirketId) {
        return baseFilter;
    }

    const sirket = await prisma.sirket
        .findUnique({
            where: { id: scopedSirketId },
            select: { ad: true },
        })
        .catch(() => null);
    const sirketAd = normalizeCompanyName(sirket?.ad);
    if (!sirketAd) {
        return baseFilter;
    }

    return {
        OR: [
            baseFilter,
            {
                calistigiKurum: {
                    equals: sirketAd,
                    mode: "insensitive",
                },
            },
        ],
    } as Record<string, unknown>;
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
    const requestedCompanyId = getRequestedCompanyId(selectedSirketId);

    return getModelFilterByPolicy({
        modelName,
        role: rol,
        currentSirketId: sirketId,
        currentUserId: userId,
        requestedSirketId: requestedCompanyId,
        includeDeleted: options?.includeDeleted ?? false,
    });
}

/**
 * Personel secim listeleri icin sabit kapsam kurali:
 * - Bagimsiz kullanici (sirketi olmayan): tum personeller
 * - Sirkete bagli kullanici: sadece kendi sirket personeli
 * - Sofor rolu: politika geregi kendi kaydi
 */
export async function getPersonnelSelectFilter() {
    const session = await getSession();
    if (!session?.user) {
        return { id: "blocked" };
    }

    const { rol, sirketId, id: userId } = session.user;
    const currentSirketId = getRequestedCompanyId(sirketId);
    const requestedSirketId = isDriverRole(rol) ? null : currentSirketId;

    return getModelFilterByPolicy({
        modelName: "kullanici",
        role: rol,
        currentSirketId: currentSirketId,
        currentUserId: userId,
        requestedSirketId,
        includeDeleted: false,
    });
}

export async function canAccessAllCompanies() {
    const session = await getSession();
    return canRoleAccessAllCompanies(session?.user?.rol, session?.user?.sirketId);
}

export async function getSirketListFilter() {
    const session = await getSession();
    if (!session?.user) {
        return { id: "blocked" };
    }

    const { rol, sirketId } = session.user;
    if (canRoleAccessAllCompanies(rol, sirketId)) {
        return {};
    }

    return { id: sirketId || "blocked" };
}

export async function getScopedSirketId(selectedSirketId?: string | null) {
    const session = await getSession();
    if (!session?.user) return null;

    const { rol, sirketId } = session.user;
    if (canRoleAccessAllCompanies(rol, sirketId)) {
        return getRequestedCompanyId(selectedSirketId);
    }

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
