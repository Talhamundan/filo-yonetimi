import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { canAccessAllCompanies, getCurrentSirketId, getModelFilter, getPersonnelSelectFilter } from "@/lib/auth-utils";
import { canRoleAssignIndependentRecords } from "@/lib/policy";

export async function assertAuthenticatedUser() {
    const session = await auth();
    if (!session?.user) {
        throw new Error("Oturum bulunamadi.");
    }

    return session.user as any;
}

export async function resolveActionSirketId(inputSirketId?: string | null) {
    const [actor, hasGlobalAccess, currentSirketId] = await Promise.all([
        assertAuthenticatedUser(),
        canAccessAllCompanies(),
        getCurrentSirketId(),
    ]);

    if (inputSirketId === undefined) {
        return currentSirketId || null;
    }

    const requestedSirketId = inputSirketId?.trim() || null;

    if (requestedSirketId) {
        if (hasGlobalAccess) {
            return requestedSirketId;
        }
        if (currentSirketId && requestedSirketId === currentSirketId) {
            return currentSirketId;
        }
        throw new Error("Secilen sirket icin yetkiniz yok.");
    }

    if (hasGlobalAccess && canRoleAssignIndependentRecords((actor as any).rol, currentSirketId)) {
        return null;
    }

    return currentSirketId || null;
}

export async function getScopedAracOrThrow<TSelect>(aracId: string, select?: TSelect) {
    const filter = await getModelFilter("arac");
    const arac = await (prisma as any).arac.findFirst({
        where: { id: aracId, ...(filter as any) },
        ...(select ? { select } : {}),
    });

    if (!arac) {
        throw new Error("Arac bulunamadi veya yetkiniz yok.");
    }

    return arac;
}

export async function getScopedKullaniciOrThrow<TSelect>(kullaniciId: string, select?: TSelect) {
    const filter = await getPersonnelSelectFilter();
    const kullanici = await (prisma as any).kullanici.findFirst({
        where: { id: kullaniciId, ...(filter as any) },
        ...(select ? { select } : {}),
    });

    if (!kullanici) {
        throw new Error("Personel bulunamadi veya yetkiniz yok.");
    }

    return kullanici;
}

export async function getScopedRecordOrThrow<TSelect>({
    prismaModel,
    filterModel,
    id,
    select,
    errorMessage,
}: {
    prismaModel: string;
    filterModel: string;
    id: string;
    select?: TSelect;
    errorMessage?: string;
}) {
    const filter = await getModelFilter(filterModel);
    const record = await (prisma as any)[prismaModel].findFirst({
        where: { id, ...(filter as any) },
        ...(select ? { select } : {}),
    });

    if (!record) {
        throw new Error(errorMessage || "Kayit bulunamadi veya yetkiniz yok.");
    }

    return record;
}
