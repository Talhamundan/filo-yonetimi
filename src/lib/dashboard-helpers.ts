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
        (typeof selectedAy === "number" || (typeof selectedAy === "string" && !isNaN(Number(selectedAy)))) && Number(selectedAy) >= 1 && Number(selectedAy) <= 12
            ? Number(selectedAy)
            : (comparisonGranularity === "YIL" ? 1 : now.getMonth() + 1);

    const referenceDate = new Date(normalizedYear, normalizedMonth - 1, 1);
    const previousReferenceDate =
        comparisonGranularity === "AY"
            ? new Date(normalizedYear, normalizedMonth - 2, 1)
            : new Date(normalizedYear - 1, normalizedMonth - 1, 1);

    const isYearMode = comparisonGranularity === "YIL";

    const bugun = startOfDay(now);
    const seciliAyBasi = isYearMode 
        ? new Date(normalizedYear, 0, 1) 
        : startOfMonth(referenceDate);
    const seciliAySonu = isYearMode 
        ? new Date(normalizedYear, 11, 31, 23, 59, 59, 999) 
        : endOfMonth(referenceDate);
        
    const oncekiDonemBasi = isYearMode 
        ? new Date(normalizedYear - 1, 0, 1) 
        : startOfMonth(previousReferenceDate);
    const oncekiDonemSonu = isYearMode 
        ? new Date(normalizedYear - 1, 11, 31, 23, 59, 59, 999) 
        : endOfMonth(previousReferenceDate);

    return {
        bugun,
        seciliAyBasi,
        seciliAySonu,
        oncekiDonemBasi,
        oncekiDonemSonu,
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
                    { arac: getVehicleUsageCompanyFilter(sirketId) },
                    { AND: [{ aracId: null }, { sirketId }] },
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
