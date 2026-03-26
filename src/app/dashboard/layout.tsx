import React from "react"
import { prisma } from "@/lib/prisma"
import { canAccessAllCompanies, getCurrentSirketId, getCurrentUserRole } from "@/lib/auth-utils"
import DashboardShell from "@/components/layout/DashboardShell"
import { canRoleAssignIndependentRecords } from "@/lib/policy"

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

async function getScopeOptions() {
    const session = await auth();
    const u = session?.user as any;
    const userName = `${u?.ad || ""} ${u?.soyad || ""}`.trim() || u?.name || u?.email || "Kullanıcı";

    const [hasGlobalCompanyAccess, currentUserRole, currentSirketId] = await Promise.all([
        canAccessAllCompanies(),
        getCurrentUserRole(),
        getCurrentSirketId(),
    ]);
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
        if (currentCompany) {
            sirketler = [currentCompany];
        }

        return {
            canAccessAllCompanies: false,
            isAdmin: currentUserRole === "ADMIN",
            canAssignIndependentRecords,
            isIndependentUser,
            role: currentUserRole,
            sirketler,
            userName,
            userCompanyName,
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
        canAssignIndependentRecords,
        isIndependentUser,
        role: currentUserRole,
        sirketler,
        userName,
        userCompanyName,
    };
}
