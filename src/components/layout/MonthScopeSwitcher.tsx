"use client";

import React, { startTransition, useMemo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

const MONTHS = [
    { value: 1, label: "Oca" },
    { value: 2, label: "Şub" },
    { value: 3, label: "Mar" },
    { value: 4, label: "Nis" },
    { value: 5, label: "May" },
    { value: 6, label: "Haz" },
    { value: 7, label: "Tem" },
    { value: 8, label: "Ağu" },
    { value: 9, label: "Eyl" },
    { value: 10, label: "Eki" },
    { value: 11, label: "Kas" },
    { value: 12, label: "Ara" },
];

export default function MonthScopeSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, setPending] = useState(false);
    const didRestoreRef = useRef(false);
    const STORAGE_KEY = "dashboard-scope-month";

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const selectedYearRaw = Number(searchParams.get("yil"));
    const selectedYear =
        Number.isInteger(selectedYearRaw) && selectedYearRaw >= 2000 && selectedYearRaw <= 2100
            ? selectedYearRaw
            : currentYear;
    const rawAy = searchParams.get("ay");
    const parsedMonth = Number(rawAy);
    const isAllSelected = rawAy?.trim().toLowerCase() === "all" || rawAy?.trim().toLowerCase() === "__all__";
    const maxMonth =
        selectedYear < currentYear ? 12 : selectedYear === currentYear ? currentMonth : 0;
    const visibleMonths = useMemo(
        () => MONTHS.filter((month) => month.value <= maxMonth),
        [maxMonth]
    );
    const selectedValue = useMemo(() => {
        if (isAllSelected) return "all";
        if (
            Number.isInteger(parsedMonth) &&
            parsedMonth >= 1 &&
            parsedMonth <= 12 &&
            visibleMonths.some((month) => month.value === parsedMonth)
        ) {
            return String(parsedMonth);
        }
        if (visibleMonths.some((month) => month.value === currentMonth)) {
            return String(currentMonth);
        }
        return "all";
    }, [currentMonth, isAllSelected, parsedMonth, visibleMonths]);

    const selectedLabel = useMemo(
        () => (selectedValue === "all" ? "Tümü" : MONTHS.find((month) => String(month.value) === selectedValue)?.label || "Ay"),
        [selectedValue]
    );

    // Persist to localStorage when URL changes
    useEffect(() => {
        const ay = searchParams.get("ay");
        if (ay) {
            window.localStorage.setItem(STORAGE_KEY, ay);
        }
    }, [searchParams]);

    // Restore from localStorage on initial mount if missing in URL
    useEffect(() => {
        if (didRestoreRef.current) return;
        didRestoreRef.current = true;

        const urlAy = searchParams.get("ay");
        const storedAy = window.localStorage.getItem(STORAGE_KEY);
        
        if (!urlAy && storedAy) {
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.set("ay", storedAy);
            const query = nextParams.toString();
            router.replace(`${pathname}?${query}`);
        }
    }, [pathname, router, searchParams]);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        const nextParams = new URLSearchParams(searchParams.toString());
        if (value === "all") {
            nextParams.set("ay", "all");
        } else {
            nextParams.set("ay", value);
        }

        setPending(true);
        startTransition(() => {
            const query = nextParams.toString();
            router.replace(query ? `${pathname}?${query}` : pathname);
            router.refresh();
            setPending(false);
        });
    };

    return (
        <div className="relative w-[64px] md:w-[84px]">
            <select
                aria-label="Ay filtresi"
                title={`Aktif ay: ${selectedLabel}`}
                value={selectedValue}
                onChange={handleChange}
                disabled={pending}
                className="h-9 md:h-10 w-full appearance-none rounded-lg md:rounded-xl border border-slate-200 bg-white pl-2.5 md:pl-2.5 pr-7 md:pr-7 text-left text-[11px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors hover:border-slate-300 hover:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <option value="all">Tümü</option>
                {visibleMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                        {month.label}
                    </option>
                ))}
            </select>
            <ChevronsUpDown size={11} className="pointer-events-none absolute right-2.5 md:right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    );
}
