import DashboardClient from "../../components/dashboard/DashboardClient";
import { getAracUsageFilter, getSirketFilter, getCurrentUserRole, getCurrentUserId } from "@/lib/auth-utils";
import { getDashboardData } from "@/lib/dashboard-data";
import { getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { prisma } from "@/lib/prisma";

export default async function DashboardOverview(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const resolvedSearchParams = props.searchParams ? await props.searchParams : {};

    const [selectedSirketId, selectedYil, selectedAy, role, userId] = await Promise.all([
        getSelectedSirketId(resolvedSearchParams),
        getSelectedYil(resolvedSearchParams),
        getSelectedAy(resolvedSearchParams),
        getCurrentUserRole(),
        getCurrentUserId(),
    ]);
    const comparisonGranularity = selectedAy == null ? "YIL" : "AY";
    const [sirketFilter, aracFilter] = await Promise.all([
        getSirketFilter(selectedSirketId),
        getAracUsageFilter(selectedSirketId),
    ]);
    
    const isTechnicalPersonnel = role === "TEKNIK";

    const data = await getDashboardData(
        sirketFilter || null,
        (aracFilter as Record<string, unknown>) || null,
        selectedYil,
        selectedAy ?? new Date().getMonth() + 1,
        comparisonGranularity
    );
    let recentRecords: Array<{
        id: string;
        actionType: string | null;
        entityType: string | null;
        summary: string;
        createdAt: Date;
    }> = [];

    if (isTechnicalPersonnel) {
        if (userId) {
            recentRecords = await prisma.activityLog.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: { id: true, actionType: true, entityType: true, summary: true, createdAt: true }
            });
        }
    }

    return (
        <DashboardClient 
            initialData={data} 
            isTechnicalPersonnel={isTechnicalPersonnel} 
            recentRecords={recentRecords}
            role={role}
        />
    );
}
