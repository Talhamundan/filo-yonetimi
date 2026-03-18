import { redirect } from "next/navigation";
import { getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";

export default async function CezalarPageAlias(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
    ]);
    const params = new URLSearchParams();
    if (selectedSirketId) params.set("sirket", selectedSirketId);
    if (selectedYil) params.set("yil", String(selectedYil));
    const query = params.toString();
    redirect(`/dashboard/ceza-masraflari${query ? `?${query}` : ""}`);
}
