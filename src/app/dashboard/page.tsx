import DashboardClient from "../../components/dashboard/DashboardClient";
import { getSirketFilter, getCurrentUserRole, getCurrentUserId } from "@/lib/auth-utils";
import { getDashboardData } from "@/lib/dashboard-data";
import { getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";
import { prisma } from "@/lib/prisma";

export default async function DashboardOverview(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const resolvedSearchParams = props.searchParams ? await props.searchParams : {};
    const rawAy = Array.isArray(resolvedSearchParams.ay) ? resolvedSearchParams.ay[0] : resolvedSearchParams.ay;
    const parsedAy = Number(rawAy);
    const hasMonthSelection = Number.isInteger(parsedAy) && parsedAy >= 1 && parsedAy <= 12;
    const comparisonGranularity = hasMonthSelection ? "AY" : "YIL";

    const [selectedSirketId, selectedYil, selectedAy, role, userId] = await Promise.all([
        getSelectedSirketId(resolvedSearchParams),
        getSelectedYil(resolvedSearchParams),
        getSelectedAy(resolvedSearchParams),
        getCurrentUserRole(),
        getCurrentUserId(),
    ]);
    const sirketFilter = await getSirketFilter(selectedSirketId);
    
    const isTechnicalPersonnel = role === "TEKNIK";

    const data = await getDashboardData(
        sirketFilter || null,
        selectedYil,
        selectedAy ?? new Date().getMonth() + 1,
        comparisonGranularity
    );
    let recentRecords: Array<{
        id: string;
        actionType: any;
        entityType: any;
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
