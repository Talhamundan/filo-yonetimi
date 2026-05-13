"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { ActivityActionType, ActivityEntityType } from "@prisma/client";
import { randomUUID } from "crypto";

export type AdminApprovalAction = "UPDATE" | "DELETE";
export type AdminApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AdminApprovalRow = {
    id: string;
    action: AdminApprovalAction;
    entityType: string;
    prismaModel: string;
    entityId: string;
    summary: string;
    status: AdminApprovalStatus;
    payload: unknown;
    beforeData: unknown;
    requestedById: string | null;
    requestedByName: string | null;
    companyId: string | null;
    companyName: string | null;
    reviewedById: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

const APPROVAL_REQUIRED_ROLES = new Set(["YETKILI", "TEKNIK"]);
const APPROVABLE_MODELS = new Set([
    "arac",
    "kullanici",
    "sirket",
    "disFirma",
    "kullaniciZimmet",
    "bakim",
    "yakit",
    "masraf",
    "ceza",
    "muayene",
    "kasko",
    "trafikSigortasi",
    "dokuman",
    "stokKalem",
    "yakitTank",
]);
const SOFT_DELETE_MODELS = new Set(["arac", "kullanici", "bakim", "masraf", "ceza", "dokuman"]);

function toJson(value: unknown) {
    if (value === undefined) return null;
    try {
        return JSON.parse(JSON.stringify(value, (_key, item) => (item instanceof Date ? item.toISOString() : item)));
    } catch {
        return null;
    }
}

function valuesEqual(left: unknown, right: unknown) {
    return JSON.stringify(toJson(left)) === JSON.stringify(toJson(right));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasMeaningfulObjectData(value: unknown) {
    return isPlainObject(value) && Object.keys(value).length > 0;
}

function buildApprovalChanges(beforeData: unknown, payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
    if (!hasMeaningfulObjectData(beforeData)) return [];
    const before = beforeData && typeof beforeData === "object" && !Array.isArray(beforeData)
        ? beforeData as Record<string, unknown>
        : {};

    return Object.entries(payload as Record<string, unknown>)
        .filter(([key]) => key !== "updatedAt" && key !== "olusturmaTarihi")
        .filter(([key, value]) => !valuesEqual(before[key], value))
        .map(([field, value]) => ({
            field,
            before: toJson(before[field]),
            after: toJson(value),
        }));
}

function approvalMessage(action: AdminApprovalAction) {
    return action === "DELETE"
        ? "Silme talebin admin onayına gönderildi. Admin onaylayana kadar kayıt silinmeyecek."
        : "Değişiklik talebin admin onayına gönderildi. Admin onaylayana kadar mevcut kayıt değişmeden kalacak.";
}

async function getCurrentActor() {
    const session = await auth();
    return session?.user || null;
}

export async function maybeCreateAdminApprovalRequest(params: {
    action: AdminApprovalAction;
    prismaModel: string;
    entityType: string;
    entityId: string;
    summary: string;
    payload?: unknown;
    beforeData?: unknown;
    companyId?: string | null;
}) {
    const actor = await getCurrentActor();
    if (!actor) return null;
    if (!APPROVAL_REQUIRED_ROLES.has(String(actor.rol || ""))) return null;

    const requestId = randomUUID();
    const payload = JSON.stringify(toJson(params.payload));
    const beforeData = JSON.stringify(toJson(params.beforeData));
    const changes = buildApprovalChanges(params.beforeData, params.payload);
    const requestedById = actor.id || null;
    const companyId = params.companyId || actor.sirketId || null;

    await (prisma as any).$executeRaw`
        INSERT INTO "AdminApprovalRequest"
            ("id", "action", "entityType", "prismaModel", "entityId", "summary", "status", "payload", "beforeData", "requestedById", "companyId", "createdAt", "updatedAt")
        VALUES
            (${requestId}, ${params.action}, ${params.entityType}, ${params.prismaModel}, ${params.entityId}, ${params.summary}, 'PENDING', ${payload}::jsonb, ${beforeData}::jsonb, ${requestedById}, ${companyId}, NOW(), NOW())
    `;

    await logActivity({
        actionType: params.action === "DELETE" ? ActivityActionType.DELETE : ActivityActionType.UPDATE,
        entityType: ActivityEntityType.DIGER,
        entityId: params.entityId,
        summary: `Admin onayı bekleyen talep oluşturuldu: ${params.summary}`,
        userId: requestedById,
        companyId,
        metadata: {
            approvalPending: true,
            approvalId: requestId,
            action: params.action,
            entityType: params.entityType,
            prismaModel: params.prismaModel,
            changes,
            beforeData: toJson(params.beforeData),
            payload: toJson(params.payload),
        },
    });

    return {
        success: true,
        pendingApproval: true,
        message: approvalMessage(params.action),
        error: undefined as string | undefined,
        info: undefined as string | undefined,
    };
}

export async function getPendingAdminApprovalRequests() {
    const rows: AdminApprovalRow[] = await (prisma as any).$queryRaw<AdminApprovalRow[]>`
        SELECT
            r.*,
            NULLIF(TRIM(CONCAT(k."ad", ' ', k."soyad")), '') AS "requestedByName",
            s."ad" AS "companyName"
        FROM "AdminApprovalRequest" r
        LEFT JOIN "Personel" k ON k."id" = r."requestedById"
        LEFT JOIN "Sirket" s ON s."id" = r."companyId"
        WHERE r."status" = 'PENDING'
        ORDER BY r."createdAt" DESC
    `;
    return Promise.all(rows.map(async (row) => {
        if (row.action !== "UPDATE" || hasMeaningfulObjectData(row.beforeData)) {
            return row;
        }

        const model = (prisma as any)[row.prismaModel];
        if (!model?.findUnique) return row;

        try {
            const currentData = await model.findUnique({ where: { id: row.entityId } });
            return currentData ? { ...row, beforeData: currentData } : row;
        } catch {
            return row;
        }
    }));
}

export async function getPendingAdminApprovalRequestCount() {
    const rows = await (prisma as any).$queryRaw<Array<{ count: bigint | number }>>`
        SELECT COUNT(*) AS "count"
        FROM "AdminApprovalRequest"
        WHERE "status" = 'PENDING'
    `;
    return Number(rows[0]?.count || 0);
}

async function getApprovalRequest(id: string) {
    const rows = await (prisma as any).$queryRaw<AdminApprovalRow[]>`
        SELECT * FROM "AdminApprovalRequest" WHERE "id" = ${id} LIMIT 1
    `;
    return rows[0] || null;
}

async function markApprovalRequest(id: string, status: AdminApprovalStatus, reviewerId: string | null) {
    await (prisma as any).$executeRaw`
        UPDATE "AdminApprovalRequest"
        SET "status" = ${status}, "reviewedById" = ${reviewerId}, "reviewedAt" = NOW(), "updatedAt" = NOW()
        WHERE "id" = ${id}
    `;
}

export async function approveAdminApprovalRequest(id: string) {
    const actor = await getCurrentActor();
    if (actor?.rol !== "ADMIN") {
        return { success: false, error: "Bu işlem için admin yetkisi gerekir." };
    }

    const request = await getApprovalRequest(id);
    if (!request || request.status !== "PENDING") {
        return { success: false, error: "Onay bekleyen talep bulunamadı." };
    }
    if (!APPROVABLE_MODELS.has(request.prismaModel)) {
        return { success: false, error: "Bu kayıt tipi otomatik onay için desteklenmiyor." };
    }

    const model = (prisma as any)[request.prismaModel];
    if (!model) {
        return { success: false, error: "Prisma modeli bulunamadı." };
    }

    if (request.action === "UPDATE") {
        await model.update({ where: { id: request.entityId }, data: request.payload || {} });
    } else if (request.action === "DELETE") {
        if (SOFT_DELETE_MODELS.has(request.prismaModel)) {
            await model.update({ where: { id: request.entityId }, data: { deletedAt: new Date(), deletedBy: actor.id || null } });
        } else {
            await model.delete({ where: { id: request.entityId } });
        }
    } else {
        return { success: false, error: "Bilinmeyen talep tipi." };
    }

    await markApprovalRequest(id, "APPROVED", actor.id || null);
    await logActivity({
        actionType: request.action === "DELETE" ? ActivityActionType.DELETE : ActivityActionType.UPDATE,
        entityType: ActivityEntityType.DIGER,
        entityId: request.entityId,
        summary: `Admin talebi onayladı: ${request.summary}`,
        userId: actor.id || null,
        companyId: request.companyId || null,
        metadata: { approvalId: id, approved: true },
    });

    return { success: true };
}

export async function rejectAdminApprovalRequest(id: string) {
    const actor = await getCurrentActor();
    if (actor?.rol !== "ADMIN") {
        return { success: false, error: "Bu işlem için admin yetkisi gerekir." };
    }

    const request = await getApprovalRequest(id);
    if (!request || request.status !== "PENDING") {
        return { success: false, error: "Onay bekleyen talep bulunamadı." };
    }

    await markApprovalRequest(id, "REJECTED", actor.id || null);
    await logActivity({
        actionType: ActivityActionType.STATUS_CHANGE,
        entityType: ActivityEntityType.DIGER,
        entityId: request.entityId,
        summary: `Admin talebi reddetti: ${request.summary}`,
        userId: actor.id || null,
        companyId: request.companyId || null,
        metadata: { approvalId: id, rejected: true },
    });

    return { success: true };
}
