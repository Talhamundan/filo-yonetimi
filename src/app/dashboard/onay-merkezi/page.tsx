import { redirect } from "next/navigation";
import type { DashboardSearchParams } from "@/lib/company-scope";

export default async function LegacyOnayMerkeziPage(props: {
  searchParams?: Promise<DashboardSearchParams> | DashboardSearchParams;
}) {
  const resolved = props.searchParams ? await props.searchParams : {};
  const params = new URLSearchParams();

  Object.entries(resolved).forEach(([key, value]) => {
    if (typeof value === "string") {
      params.set(key, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "string") {
          params.append(key, entry);
        }
      });
    }
  });

  const query = params.toString();
  const target = query
    ? `/dashboard/yetkilendirme-paneli?${query}`
    : "/dashboard/yetkilendirme-paneli";

  redirect(target);
}
