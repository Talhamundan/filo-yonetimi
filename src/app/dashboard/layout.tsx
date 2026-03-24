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

    if (!hasGlobalCompanyAccess) {
        let sirketler: { id: string; ad: string }[] = [];
        if (currentSirketId) {
            try {
                const currentCompany = await prisma.sirket.findUnique({
                    where: { id: currentSirketId },
                    select: { id: true, ad: true },
                });
                if (currentCompany) {
                    sirketler = [currentCompany];
                }
            } catch (error) {
                console.warn("Mevcut sirket bilgisi getirilemedi, bos liste ile devam ediliyor.", error);
            }
        }

        return {
            canAccessAllCompanies: false,
            isAdmin: currentUserRole === "ADMIN",
            canAssignIndependentRecords,
            role: currentUserRole,
            sirketler,
            userName
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
        role: currentUserRole,
        sirketler,
        userName
    };
}
