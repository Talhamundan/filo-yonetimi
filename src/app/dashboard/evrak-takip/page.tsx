import { redirect } from "next/navigation";
import { getSelectedAy, getSelectedSirketId, getSelectedYil, type DashboardSearchParams } from "@/lib/company-scope";

export default async function EvrakTakipRedirectPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const [selectedSirketId, selectedYil, selectedAy, resolvedSearchParams] = await Promise.all([
        getSelectedSirketId(props.searchParams),
        getSelectedYil(props.searchParams),
        getSelectedAy(props.searchParams),
        props.searchParams ? props.searchParams : Promise.resolve({} as DashboardSearchParams),
    ]);

    const params = new URLSearchParams();
    if (selectedSirketId) params.set("sirket", selectedSirketId);
    if (selectedYil) params.set("yil", String(selectedYil));
    params.set("ay", selectedAy == null ? "all" : String(selectedAy));

    const passthroughKeys = ["q", "status", "type", "from", "to"] as const;
    for (const key of passthroughKeys) {
        const value = resolvedSearchParams[key];
        const text = Array.isArray(value) ? value[0] : value;
        if (text) params.set(key, text);
    }

    const query = params.toString();
    redirect(`/dashboard/stok-takibi${query ? `?${query}` : ""}`);
}
