import { redirect } from "next/navigation";
import DisFirmalarClient from "../_dis-firmalar/Client";
import { getDisFirmaPageData } from "../_dis-firmalar/page-data";
import type { DashboardSearchParams } from "@/lib/company-scope";

export default async function TaseronlarPage(props: { searchParams?: Promise<DashboardSearchParams> }) {
    const data = await getDisFirmaPageData({ tur: "TASERON", searchParams: props.searchParams });
    if (!data.canManageVendors) redirect("/dashboard");

    return (
        <DisFirmalarClient
            title="Taşeron Firma Yönetimi"
            description="Dışarıdan hizmet aldığımız taşeron firmaları, bağlı araç/personel sayılarını ve dönem maliyetlerini yönetin."
            tur="TASERON"
            initialData={data.rows}
            sirketler={data.sirketler}
        />
    );
}
