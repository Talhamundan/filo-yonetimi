import { auth } from "@/auth";
import { cache } from "react";

/**
 * auth() çağrısını bir request içinde memoize eder.
 * Böylece aynı request içinde birden fazla auth-utils fonksiyonu çağrılsa bile
 * JWT doğrulaması sadece BİR KEZ yapılır.
 */
const getSession = cache(async () => {
    return await auth();
});

const GLOBAL_SCOPE_ROLES = new Set(["ADMIN", "YONETICI"]);

function getCompanyModelFilter(modelName: string, sirketId: string | null) {
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
        case "ariza":
        case "bakim":
        case "muayene":
        case "kasko":
        case "trafikSigortasi":
        case "dokuman":
        case "hgs":
        case "hgsYukleme":
            return { sirketId };
        case "kullaniciZimmet":
        case "zimmet":
            return { arac: { sirketId } };
        default:
            return { sirketId };
    }
}

function getBlockedFilter(modelName: string) {
    if (modelName === "sirket") {
        return { id: "blocked" };
    }

    return { id: "blocked" };
}

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
    
    const { rol, sirketId } = session.user as any;
    const requestedCompanyId = getRequestedCompanyId(selectedSirketId);
    
    if (GLOBAL_SCOPE_ROLES.has(rol)) {
        return requestedCompanyId ? { sirketId: requestedCompanyId } : {};
    }

    return { sirketId: sirketId || "blocked" };
}

/**
 * Modele göre yetki bazlı filtre döner.
 * @param modelName Prisma model adı (küçük harf)
 */
export async function getModelFilter(modelName: string, selectedSirketId?: string | null) {
    const session = await getSession();
    if (!session?.user) return getBlockedFilter(modelName);
    
    const { rol, sirketId, id: userId } = session.user as any;
    const requestedCompanyId = getRequestedCompanyId(selectedSirketId);
    
    if (GLOBAL_SCOPE_ROLES.has(rol)) {
        return getCompanyModelFilter(modelName, requestedCompanyId);
    }

    // Şoför kısıtlamaları
    if (rol === 'SOFOR') {
        const aracRelatedModels = ['yakit', 'ceza', 'masraf', 'ariza', 'bakim', 'muayene', 'kasko', 'trafikSigortasi', 'dokuman', 'kullaniciZimmet', 'zimmet'];
        if (aracRelatedModels.includes(modelName)) {
            return { arac: { kullaniciId: userId } };
        }
        if (modelName === 'arac') {
            return { kullaniciId: userId };
        }
        if (modelName === 'kullanici' || modelName === 'personel') {
            return { id: userId };
        }
        if (modelName === "sirket") {
            return { id: sirketId || "blocked" };
        }
        return { id: 'none' };
    }

    // Diğer roller (Yönetici, Müdür vb.) sadece kendi şirketlerini görür
    return getCompanyModelFilter(modelName, sirketId || null);
}

export async function canAccessAllCompanies() {
    const session = await getSession();
    return GLOBAL_SCOPE_ROLES.has((session?.user as any)?.rol);
}

export async function getSirketListFilter() {
    const session = await getSession();
    if (!session?.user) {
        return { id: "blocked" };
    }

    const { rol, sirketId } = session.user as any;
    if (GLOBAL_SCOPE_ROLES.has(rol)) {
        return {};
    }

    return { id: sirketId || "blocked" };
}

export async function getScopedSirketId(selectedSirketId?: string | null) {
    const session = await getSession();
    if (!session?.user) return null;

    const { rol, sirketId } = session.user as any;
    if (GLOBAL_SCOPE_ROLES.has(rol)) {
        return getRequestedCompanyId(selectedSirketId);
    }

    return sirketId || null;
}

export async function getCurrentSirketId() {
    const session = await getSession();
    return (session?.user as any)?.sirketId || null;
}

export async function getCurrentUserRole() {
    const session = await getSession();
    return (session?.user as any)?.rol || null;
}

export async function isSofor() {
    const session = await getSession();
    return (session?.user as any)?.rol === 'SOFOR';
}

export async function isAdmin() {
    const session = await getSession();
    return (session?.user as any)?.rol === 'ADMIN';
}

export async function getCurrentUserId() {
    const session = await getSession();
    return session?.user?.id || null;
}
