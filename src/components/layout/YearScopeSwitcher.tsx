"use client";

import React, { startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

type ScopeYearsResponse = {
    years: number[];
};

export default function YearScopeSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, setPending] = useState(false);

    const currentYear = new Date().getFullYear();
    const selectedSirketId = searchParams.get("sirket");
    const rawSelectedYear = Number(searchParams.get("yil"));
    const selectedYear = Number.isInteger(rawSelectedYear) ? rawSelectedYear : currentYear;
    const yearsApiParams = new URLSearchParams();
    if (selectedSirketId) yearsApiParams.set("sirket", selectedSirketId);
    const yearsApiKey = yearsApiParams.toString()
        ? `/api/scope-years?${yearsApiParams.toString()}`
        : "/api/scope-years";

    const { data } = useSWR<ScopeYearsResponse>(yearsApiKey, fetcher, {
        revalidateOnFocus: false,
    });

    const years = useMemo(() => {
        const options = new Set<number>([currentYear, selectedYear]);
        for (const year of data?.years || []) {
            if (Number.isInteger(year)) {
                options.add(year);
            }
        }
        return Array.from(options).sort((a, b) => b - a);
    }, [currentYear, data?.years, selectedYear]);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = Number(event.target.value);
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("yil", String(value));

        setPending(true);
        startTransition(() => {
            const query = nextParams.toString();
            router.replace(query ? `${pathname}?${query}` : pathname);
            router.refresh();
            setPending(false);
        });
    };

    return (
        <div className="relative w-[86px] md:w-[104px]">
            <select
                aria-label="Yıl filtresi"
                title={`Aktif yıl: ${selectedYear}`}
                value={String(selectedYear)}
                onChange={handleChange}
                disabled={pending}
                className="h-10 md:h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-left text-[12px] md:text-[13px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors hover:border-slate-300 hover:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {years.map((year) => (
                    <option key={year} value={year}>
                        {year}
                    </option>
                ))}
            </select>
            <ChevronsUpDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    );
}
