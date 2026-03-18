import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { getCurrentUserRole, getModelFilterWithOptions, getSirketListFilter } from "@/lib/auth-utils";
import { getActivityLogs } from "@/lib/activity-log";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";
import prisma from "@/lib/prisma";
import ActivityLogClient from "./ActivityLogClient";

function parseString(value: string | string[] | undefined) {
    if (!value) return null;
    return Array.isArray(value) ? value[0] || null : value;
}

function parseEnumValue<T extends string>(value: string | null, values: readonly T[]): T | null {
    if (!value) return null;
    return values.includes(value as T) ? (value as T) : null;
}

function parseDateValue(value: string | null, endOfDay = false) {
    if (!value) return null;
    const date = new Date(value);
    if (endOfDay) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return Number.isNaN(date.getTime()) ? null : date;
}

export default async function AktiviteGecmisiPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [role, selectedSirketId, resolvedSearchParams, sirketFilter] = await Promise.all([
        getCurrentUserRole(),
        getSelectedSirketId(props.searchParams),
        props.searchParams ? props.searchParams : Promise.resolve({} as DashboardSearchParams),
        getSirketListFilter(),
    ]);

    if (role !== "ADMIN" && role !== "YONETICI") {
        return (
            <div className="p-8">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                    Aktivite geçmişini görüntülemek için yönetici yetkisi gerekir.
                </div>
            </div>
        );
    }

    const q = parseString(resolvedSearchParams.q);
    const actionType = parseEnumValue(parseString(resolvedSearchParams.action), Object.values(ActivityActionType));
    const entityType = parseEnumValue(parseString(resolvedSearchParams.entity), Object.values(ActivityEntityType));
    const from = parseDateValue(parseString(resolvedSearchParams.from));
    const to = parseDateValue(parseString(resolvedSearchParams.to), true);
    const page = Number(parseString(resolvedSearchParams.page) || "1");

    const scopedLogFilter = await getModelFilterWithOptions("activityLog", selectedSirketId, { includeDeleted: true });
    const forcedCompanyId = typeof (scopedLogFilter as Record<string, unknown>).companyId === "string"
        ? ((scopedLogFilter as Record<string, unknown>).companyId as string)
        : null;

    const result = await getActivityLogs({
        filters: {
            q,
            actionType,
            entityType,
            companyId: forcedCompanyId || selectedSirketId || null,
            from,
            to,
        },
        page: Number.isInteger(page) && page > 0 ? page : 1,
        pageSize: 30,
    });

    const sirketler = await prisma.sirket.findMany({
        where: sirketFilter as never,
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
    });

    return (
        <ActivityLogClient
            rows={result.rows}
            total={result.total}
            page={result.page}
            totalPages={result.totalPages}
            sirketler={sirketler}
        />
    );
}
