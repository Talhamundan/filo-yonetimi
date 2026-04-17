import { redirect } from "next/navigation";
import DisFirmalarClient from "../_dis-firmalar/Client";
import { getDisFirmaPageData } from "../_dis-firmalar/page-data";
import type { DashboardSearchParams } from "@/lib/company-scope";

export default async function KiraliklarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const data = await getDisFirmaPageData({ tur: "KIRALIK", searchParams: props.searchParams });
    if (!data.canManageVendors) redirect("/dashboard");

    return (
        <DisFirmalarClient
            title="Kiralık Firma Yönetimi"
            description="Kiralık araç veya personel hizmeti aldığımız firmaları ve dönem bazlı maliyetlerini takip edin."
            tur="KIRALIK"
            initialData={data.rows}
            sirketler={data.sirketler}
        />
    );
}
