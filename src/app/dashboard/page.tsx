import DashboardClient from "../../components/dashboard/DashboardClient";
import { getSirketFilter } from "@/lib/auth-utils";
import { getDashboardData } from "@/lib/dashboard-data";
import { getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";

export default async function DashboardOverview(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const resolvedSearchParams = props.searchParams ? await props.searchParams : {};
    const rawAy = Array.isArray(resolvedSearchParams.ay) ? resolvedSearchParams.ay[0] : resolvedSearchParams.ay;
    const comparisonGranularity = rawAy ? "AY" : "YIL";

    const [selectedSirketId, selectedYil, selectedAy] = await Promise.all([
        getSelectedSirketId(resolvedSearchParams),
        getSelectedYil(resolvedSearchParams),
        getSelectedAy(resolvedSearchParams),
    ]);
    const sirketFilter = await getSirketFilter(selectedSirketId);
    const data = await getDashboardData(sirketFilter || null, selectedYil, selectedAy, comparisonGranularity);

    return (
        <DashboardClient initialData={data} />
    );
}
