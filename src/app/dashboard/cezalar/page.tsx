import { redirect } from "next/navigation";
import { getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";

export default async function CezalarPageAlias(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, resolvedSearchParams] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        props.searchParams ? props.searchParams : Promise.resolve({} as DashboardSearchParams),
    ]);
    const params = new URLSearchParams();
    if (selectedSirketId) params.set("sirket", selectedSirketId);
    if (selectedYil) params.set("yil", String(selectedYil));
    const passthroughKeys = ["q", "status", "type", "from", "to"] as const;
    for (const key of passthroughKeys) {
        const value = resolvedSearchParams[key];
        const text = Array.isArray(value) ? value[0] : value;
        if (text) params.set(key, text);
    }
    const query = params.toString();
    redirect(`/dashboard/ceza-masraflari${query ? `?${query}` : ""}`);
}
