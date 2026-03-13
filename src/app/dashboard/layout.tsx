import React from "react"
import { prisma } from "@/lib/prisma"
import { canAccessAllCompanies, getCurrentUserRole } from "@/lib/auth-utils"
import DashboardShell from "@/components/layout/DashboardShell"

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

async function getScopeOptions() {
    const [hasGlobalCompanyAccess, currentUserRole] = await Promise.all([
        canAccessAllCompanies(),
        getCurrentUserRole(),
    ]);

    if (!hasGlobalCompanyAccess) {
        return {
            canAccessAllCompanies: false,
            isAdmin: currentUserRole === "ADMIN",
            sirketler: [],
        };
    }

    const sirketler = await prisma.sirket.findMany({
        select: { id: true, ad: true },
        orderBy: { ad: "asc" },
    });

    return {
        canAccessAllCompanies: true,
        isAdmin: currentUserRole === "ADMIN",
        sirketler,
    };
}
