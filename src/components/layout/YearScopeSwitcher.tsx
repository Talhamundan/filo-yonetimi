"use client";

import React, { startTransition, useMemo, useState, useEffect, useRef } from "react";
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
    const didRestoreRef = useRef(false);
    const STORAGE_KEY = "dashboard-scope-year";

    const currentYear = new Date().getFullYear();
    const selectedSirketId = searchParams.get("sirket");
    const rawSelectedYear = Number(searchParams.get("yil"));
    const selectedYear =
        Number.isInteger(rawSelectedYear) && rawSelectedYear >= 2000 && rawSelectedYear <= currentYear
            ? rawSelectedYear
            : currentYear;
    const yearsApiParams = new URLSearchParams();
    if (selectedSirketId) yearsApiParams.set("sirket", selectedSirketId);
    const yearsApiKey = yearsApiParams.toString()
        ? `/api/scope-years?${yearsApiParams.toString()}`
        : "/api/scope-years";

    const { data } = useSWR<ScopeYearsResponse>(yearsApiKey, fetcher, {
        revalidateOnFocus: false,
    });

    const dataYears = useMemo(
        () =>
            (data?.years || [])
                .filter((year): year is number => Number.isInteger(year))
                .sort((a, b) => b - a),
        [data?.years]
    );
    const years = useMemo(() => {
        const mergedYears = new Set<number>(dataYears);
        mergedYears.add(currentYear);
        if (Number.isInteger(rawSelectedYear) && rawSelectedYear >= 2000 && rawSelectedYear <= currentYear) {
            mergedYears.add(rawSelectedYear);
        }
        return Array.from(mergedYears).sort((a, b) => b - a);
    }, [currentYear, dataYears, rawSelectedYear]);
    const effectiveSelectedYear = years.includes(selectedYear) ? selectedYear : currentYear;
    
    // Persist to localStorage when URL changes
    useEffect(() => {
        const yil = searchParams.get("yil");
        if (yil) {
            window.localStorage.setItem(STORAGE_KEY, yil);
        }
    }, [searchParams]);

    // Restore from localStorage on initial mount if missing in URL
    useEffect(() => {
        if (didRestoreRef.current) return;
        didRestoreRef.current = true;

        const urlYil = searchParams.get("yil");
        const storedYil = window.localStorage.getItem(STORAGE_KEY);
        
        if (!urlYil && storedYil) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.set("yil", storedYil);
            const query = nextParams.toString();
            router.replace(`${pathname}?${query}`);
        }
    }, [pathname, router, searchParams]);

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
        <div className="relative w-[82px] md:w-[92px]">
            <select
                aria-label="Yıl filtresi"
                title={`Aktif yıl: ${effectiveSelectedYear}`}
                value={String(effectiveSelectedYear)}
                onChange={handleChange}
                disabled={pending}
                className="h-10 md:h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-7 text-left text-xs md:text-[11px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors hover:border-slate-300 hover:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {years.map((year) => (
                    <option key={year} value={year}>
                        {year}
                    </option>
                ))}
            </select>
            <ChevronsUpDown size={11} className="pointer-events-none absolute right-2.5 md:right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    );
}
