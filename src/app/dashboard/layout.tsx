import React from "react"
import { prisma } from "@/lib/prisma"
import { canAccessAllCompanies, getAracUsageFilter, getCurrentSirketId, getCurrentUserRole } from "@/lib/auth-utils"
import DashboardShell from "@/components/layout/DashboardShell"
import { canRoleAssignIndependentRecords } from "@/lib/policy"
import { getPendingAdminApprovalRequestCount } from "@/lib/admin-approval"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const scopeOptions = await getScopeOptions();

    return (
        <DashboardShell scopeOptions={scopeOptions}>
            {children}
        </DashboardShell>
    )
}

import { auth } from "@/auth";

async function getQuickVehicleSearchItems() {
    try {
        const usageFilter = await getAracUsageFilter();
        const rows = await prisma.arac.findMany({
            where: {
                AND: [
                    usageFilter as any,
                    { deletedAt: null },
                    { plaka: { not: null } },
                ],
            } as any,
            select: { id: true, plaka: true, marka: true, model: true },
            orderBy: { plaka: "asc" },
            take: 4000,
        });

        return rows
            .map((row) => ({
                id: row.id,
                plaka: String(row.plaka || "").trim(),
                marka: row.marka || "",
                model: row.model || "",
            }))
            .filter((row) => Boolean(row.id) && Boolean(row.plaka));
    } catch (error) {
        console.warn("Komut arama arac listesi getirilemedi.", error);
        return [];
    }
}

async function getScopeOptions() {
    const session = await auth();
    const u = session?.user as any;
    const userName = `${u?.ad || ""} ${u?.soyad || ""}`.trim() || u?.name || u?.email || "Kullanıcı";
    const authorizedSirketIds = Array.from(
        new Set<string>(
            (Array.isArray(u?.yetkiliSirketIds) ? u.yetkiliSirketIds : [])
                .map((id: unknown) => String(id || "").trim())
                .filter(Boolean)
        )
    );

    const [hasGlobalCompanyAccess, currentUserRole, currentSirketId, quickVehicleSearch] = await Promise.all([
        canAccessAllCompanies(),
        getCurrentUserRole(),
        getCurrentSirketId(),
        getQuickVehicleSearchItems(),
    ]);
    const pendingAdminApprovalCount =
        currentUserRole === "ADMIN"
            ? await getPendingAdminApprovalRequestCount().catch((error) => {
                console.warn("Bekleyen admin onay sayisi getirilemedi.", error);
                return 0;
            })
            : 0;
    const canAssignIndependentRecords = canRoleAssignIndependentRecords(currentUserRole, currentSirketId);
    const isIndependentUser = !currentSirketId;
    let currentCompany: { id: string; ad: string } | null = null;
    if (currentSirketId) {
        try {
            currentCompany = await prisma.sirket.findUnique({
                where: { id: currentSirketId },
                select: { id: true, ad: true },
            });
        } catch (error) {
            console.warn("Kullaniciya bagli sirket bilgisi getirilemedi.", error);
        }
    }
    const userCompanyName = currentCompany?.ad || (currentSirketId ? "Şirket Bulunamadı" : "Bağımsız");

    if (!hasGlobalCompanyAccess) {
        let sirketler: { id: string; ad: string }[] = [];
        if (authorizedSirketIds.length > 0) {
            try {
                sirketler = await prisma.sirket.findMany({
                    where: { id: { in: authorizedSirketIds } },
                    select: { id: true, ad: true },
                    orderBy: { ad: "asc" },
                });
            } catch (error) {
                console.warn("Yetkili sirket listesi getirilemedi, bos liste ile devam ediliyor.", error);
            }
        } else if (currentCompany) {
            sirketler = [currentCompany];
        }

        return {
            canAccessAllCompanies: false,
            isAdmin: currentUserRole === "ADMIN",
            canSelectCompanyScope: authorizedSirketIds.length > 0,
            canAssignIndependentRecords,
            isIndependentUser,
            role: currentUserRole,
            sirketler,
            userName,
            userCompanyName,
            pendingAdminApprovalCount,
            quickVehicleSearch,
        };
    }

    let sirketler: { id: string; ad: string }[] = [];
    try {
        sirketler = await prisma.sirket.findMany({
            select: { id: true, ad: true },
            orderBy: { ad: "asc" },
        });
    } catch (error) {
        console.warn("Sirket listesi getirilemedi, bos liste ile devam ediliyor.", error);
    }

    return {
        canAccessAllCompanies: true,
        isAdmin: currentUserRole === "ADMIN",
        canSelectCompanyScope: true,
        canAssignIndependentRecords,
        isIndependentUser,
        role: currentUserRole,
        sirketler,
        userName,
        userCompanyName,
        pendingAdminApprovalCount,
        quickVehicleSearch,
    };
}
