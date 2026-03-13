import DashboardClient from "../../components/dashboard/DashboardClient";
import { getSirketFilter } from "@/lib/auth-utils";
import { getDashboardData } from "@/lib/dashboard-data";
import { getSelectedSirketId, type DashboardSearchParams } from "@/lib/company-scope";

export default async function DashboardOverview(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const selectedSirketId = await getSelectedSirketId(props.searchParams);
    const sirketFilter = await getSirketFilter(selectedSirketId);
    const data = await getDashboardData(sirketFilter || null);

    return (
        <DashboardClient initialData={data} />
    );
}
