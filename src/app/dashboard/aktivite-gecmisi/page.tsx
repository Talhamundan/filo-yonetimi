import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { getCurrentUserRole, getModelFilterWithOptions } from "@/lib/auth-utils";
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

function getMetadataUsername(metadata: unknown) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
    const value = (metadata as Record<string, unknown>).username;
    return typeof value === "string" ? value.trim().toLocaleLowerCase("tr-TR") : "";
}

export default async function AktiviteGecmisiPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [role, selectedSirketId, resolvedSearchParams] = await Promise.all([
        getCurrentUserRole(),
        getSelectedSirketId(props.searchParams),
        props.searchParams ? props.searchParams : Promise.resolve({} as DashboardSearchParams),
    ]);

    if (role !== "ADMIN" && role !== "YETKILI") {
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

    const userIds = Array.from(
        new Set(
            result.rows
                .map((row) => (typeof row.userId === "string" ? row.userId.trim() : ""))
                .filter((id) => id.length > 0 && id !== "0000")
        )
    );
    const usernames = Array.from(
        new Set(
            result.rows
                .map((row) => getMetadataUsername(row.metadata))
                .filter((username) => username.length > 0)
        )
    );
    const kullanicilar = userIds.length > 0 ? await prisma.kullanici.findMany({
        where: { id: { in: userIds } },
        select: { id: true, ad: true, soyad: true },
    }) : [];
    const hesaplar = userIds.length > 0 || usernames.length > 0 ? await prisma.hesap.findMany({
        where: {
            OR: [
                ...(userIds.length > 0 ? [{ id: { in: userIds } }, { personelId: { in: userIds } }] : []),
                ...(usernames.length > 0 ? [{ kullaniciAdi: { in: usernames } }] : []),
            ],
        },
        select: {
            id: true,
            personelId: true,
            kullaniciAdi: true,
            personel: { select: { ad: true, soyad: true } },
        },
    }) : [];
    const getPersonelName = (personel: { ad?: string | null; soyad?: string | null } | null | undefined) =>
        `${personel?.ad || ""} ${personel?.soyad || ""}`.trim();
    const userNameById = new Map(
        kullanicilar.map((user) => [user.id, `${user.ad || ""} ${user.soyad || ""}`.trim()])
    );
    const userNameByHesapId = new Map(
        hesaplar.map((hesap) => [hesap.id, getPersonelName(hesap.personel) || hesap.kullaniciAdi])
    );
    const userNameByPersonelId = new Map(
        hesaplar.map((hesap) => [hesap.personelId, getPersonelName(hesap.personel) || hesap.kullaniciAdi])
    );
    const userNameByUsername = new Map(
        hesaplar.map((hesap) => [hesap.kullaniciAdi.trim().toLocaleLowerCase("tr-TR"), getPersonelName(hesap.personel) || hesap.kullaniciAdi])
    );
    const rows = result.rows.map((row) => {
        const userId = typeof row.userId === "string" ? row.userId.trim() : "";
        const username = getMetadataUsername(row.metadata);
        return {
            ...row,
            userDisplayName: userId === "0000"
                ? "Sistem"
                : userId
                    ? userNameById.get(userId) || userNameByPersonelId.get(userId) || userNameByHesapId.get(userId) || (username ? userNameByUsername.get(username) : null) || userId
                    : username
                        ? userNameByUsername.get(username) || username
                        : "-",
        };
    });

    return (
        <ActivityLogClient
            rows={rows}
            total={result.total}
            page={result.page}
            totalPages={result.totalPages}
        />
    );
}
