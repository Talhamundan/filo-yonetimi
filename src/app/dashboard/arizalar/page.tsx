import { redirect } from "next/navigation";
import { type DashboardSearchParams } from "@/lib/company-scope";

export default async function ArizalarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const searchParams = (await props.searchParams) || {};
    const query = new URLSearchParams();

    if (typeof searchParams.yil === "string" && searchParams.yil) {
        query.set("yil", searchParams.yil);
    }
    if (typeof searchParams.sirket === "string" && searchParams.sirket) {
        query.set("sirket", searchParams.sirket);
    }

    const target = query.toString() ? `/dashboard/bakimlar?${query.toString()}` : "/dashboard/bakimlar";
    redirect(target);
}
