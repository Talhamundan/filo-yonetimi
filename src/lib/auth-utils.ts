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

/**
 * Mevcut oturumdaki kullanıcının şirket filtresini döner.
 */
export async function getSirketFilter() {
    const session = await getSession();
    if (!session?.user) return null;
    
    const { rol, sirketId } = session.user as any;
    
    if (rol === 'ADMIN') return {};
    return { sirketId };
}

/**
 * Modele göre yetki bazlı filtre döner.
 * @param modelName Prisma model adı (küçük harf)
 */
export async function getModelFilter(modelName: string) {
    const session = await getSession();
    if (!session?.user) return { id: 'blocked' };
    
    const { rol, sirketId, id: userId } = session.user as any;
    
    if (rol === 'ADMIN') return {};

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
        return { id: 'none' };
    }

    // Diğer roller (Yönetici, Müdür vb.) sadece kendi şirketlerini görür
    return { sirketId };
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
