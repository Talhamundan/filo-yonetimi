import { ActivityActionType, ActivityEntityType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type ActivityLogInput = {
    actionType: ActivityActionType;
    entityType: ActivityEntityType;
    entityId: string;
    summary: string;
    userId?: string | null;
    companyId?: string | null;
    metadata?: unknown;
};

export type ActivityLogFilters = {
    q?: string | null;
    actionType?: ActivityActionType | null;
    entityType?: ActivityEntityType | null;
    companyId?: string | null;
    from?: Date | null;
    to?: Date | null;
};

export type ActivityActor = {
    id?: string | null;
    sirketId?: string | null;
};

const DEFAULT_PAGE_SIZE = 30;

function toJsonValue(metadata: unknown): Prisma.InputJsonValue | undefined {
    if (metadata === undefined) return undefined;
    try {
        return JSON.parse(
            JSON.stringify(metadata, (_key, value) => (value instanceof Date ? value.toISOString() : value))
        ) as Prisma.InputJsonValue;
    } catch {
        return undefined;
    }
}

export async function logActivity(input: ActivityLogInput) {
    try {
        await prisma.activityLog.create({
            data: {
                actionType: input.actionType,
                entityType: input.entityType,
                entityId: input.entityId,
                summary: input.summary,
                userId: input.userId || null,
                companyId: input.companyId || null,
                metadata: toJsonValue(input.metadata),
            },
        });
    } catch (error) {
        console.warn("Activity log yazilamadi.", error);
    }
}

export async function logEntityActivity(input: {
    actionType: ActivityActionType;
    entityType: ActivityEntityType;
    entityId: string;
    summary: string;
    actor?: ActivityActor | null;
    companyId?: string | null;
    metadata?: unknown;
}) {
    await logActivity({
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        userId: input.actor?.id || null,
        companyId: input.companyId ?? input.actor?.sirketId ?? null,
        metadata: input.metadata,
    });
}

export async function getActivityLogs(params: {
    filters?: ActivityLogFilters;
    page?: number;
    pageSize?: number;
}) {
    const { filters, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;

    const where: Prisma.ActivityLogWhereInput = {
        ...(filters?.actionType ? { actionType: filters.actionType } : {}),
        ...(filters?.entityType ? { entityType: filters.entityType } : {}),
        ...(filters?.companyId ? { companyId: filters.companyId } : {}),
        ...(filters?.from || filters?.to
            ? {
                  createdAt: {
                      ...(filters.from ? { gte: filters.from } : {}),
                      ...(filters.to ? { lte: filters.to } : {}),
                  },
              }
            : {}),
        ...(filters?.q
            ? {
                  OR: [
                      { summary: { contains: filters.q, mode: "insensitive" } },
                      { entityId: { contains: filters.q, mode: "insensitive" } },
                      { userId: { contains: filters.q, mode: "insensitive" } },
                  ],
              }
            : {}),
    };

    const [rows, total] = await Promise.all([
        prisma.activityLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (Math.max(page, 1) - 1) * pageSize,
            take: pageSize,
        }),
        prisma.activityLog.count({ where }),
    ]);

    return {
        rows,
        total,
        page: Math.max(page, 1),
        pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
    };
}
