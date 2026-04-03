import { endOfMonth, format, startOfDay, startOfMonth } from "date-fns";
import type { DashboardComparisonGranularity, DashboardDateContext, GenericWhere } from "@/lib/dashboard-types";

export function toNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function formatDateKey(date: Date) {
    return format(date, "yyyy-MM-dd");
}

export function getDegisimYuzdesi(currentValue: number, previousValue: number) {
    const current = toNumber(currentValue);
    const previous = toNumber(previousValue);

    if (previous === 0) {
        if (current === 0) return 0;
        return 100;
    }

    return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function buildDateContext(
    selectedYil: number,
    selectedAy: number,
    comparisonGranularity: DashboardComparisonGranularity
): DashboardDateContext {
    const now = new Date();
    const currentYear = now.getFullYear();

    const normalizedYear =
        Number.isInteger(selectedYil) && selectedYil >= 2000 && selectedYil <= 2100 ? selectedYil : currentYear;
    const normalizedMonth =
        Number.isInteger(selectedAy) && selectedAy >= 1 && selectedAy <= 12
            ? selectedAy
            : now.getMonth() + 1;

    const referenceDate = new Date(normalizedYear, normalizedMonth - 1, 1);
    const previousReferenceDate =
        comparisonGranularity === "AY"
            ? new Date(normalizedYear, normalizedMonth - 2, 1)
            : new Date(normalizedYear - 1, normalizedMonth - 1, 1);

    return {
        bugun: startOfDay(now),
        seciliAyBasi: startOfMonth(referenceDate),
        seciliAySonu: endOfMonth(referenceDate),
        oncekiDonemBasi: startOfMonth(previousReferenceDate),
        oncekiDonemSonu: endOfMonth(previousReferenceDate),
        normalizedYear,
        normalizedMonth,
    };
}

export function getCezaScopeWhere(scope: GenericWhere): GenericWhere {
    const rawScope = scope as { sirketId?: unknown };
    const sirketId = typeof rawScope.sirketId === "string" ? rawScope.sirketId : null;

    if (!sirketId) {
        return scope;
    }

    const restScope = { ...scope };
    delete restScope.sirketId;

    return {
        AND: [
            restScope,
            {
                OR: [
                    { sirketId },
                    { AND: [{ sirketId: null }, { arac: { sirketId } }] },
                ],
            },
        ],
    };
}

function getVehicleUsageCompanyFilter(sirketId: string): GenericWhere {
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

export function getVehicleUsageScopeWhere(scope: GenericWhere): GenericWhere {
    const rawScope = (scope || {}) as Record<string, unknown>;
    const normalizedSirketId = typeof rawScope.sirketId === "string" ? rawScope.sirketId.trim() : "";
    if (!normalizedSirketId) {
        return scope;
    }

    const restScope = { ...rawScope };
    delete restScope.sirketId;

    const scopeParts: GenericWhere[] = [];
    if (Object.keys(restScope).length > 0) {
        scopeParts.push(restScope);
    }
    scopeParts.push(getVehicleUsageCompanyFilter(normalizedSirketId));

    return scopeParts.length === 1 ? scopeParts[0] : { AND: scopeParts };
}
