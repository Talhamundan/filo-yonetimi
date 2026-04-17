import { redirect } from "next/navigation";
import type { DashboardSearchParams } from "@/lib/company-scope";

export default async function PersonellerCompatPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const resolved = props.searchParams ? await props.searchParams : {};
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(resolved)) {
        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, item));
        } else if (value) {
            params.set(key, value);
        }
    }
    const query = params.toString();
    redirect(query ? `/dashboard/personel?${query}` : "/dashboard/personel");
}
