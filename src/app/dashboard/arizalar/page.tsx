import { redirect } from "next/navigation";
import { type DashboardSearchParams } from "@/lib/company-scope";

export default async function ArizalarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const searchParams = (await props.searchParams) || {};
    const query = new URLSearchParams();

    if (typeof searchParams.yil === "string" && searchParams.yil) {
        query.set("yil", searchParams.yil);
    }
    if (typeof searchParams.ay === "string" && searchParams.ay) {
        query.set("ay", searchParams.ay);
    }
    if (typeof searchParams.sirket === "string" && searchParams.sirket) {
        query.set("sirket", searchParams.sirket);
    }
    const passthroughKeys = ["q", "status", "type", "from", "to"] as const;
    for (const key of passthroughKeys) {
        const value = searchParams[key];
        const text = Array.isArray(value) ? value[0] : value;
        if (text) {
            query.set(key, text);
        }
    }

    const target = query.toString() ? `/dashboard/bakimlar?${query.toString()}` : "/dashboard/bakimlar";
    redirect(target);
}
