"use client";

import React, { startTransition, useMemo, useState } from "react";
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

    const currentMonth = new Date().getMonth() + 1;
    const rawSelectedMonth = Number(searchParams.get("ay"));
    const selectedMonth =
        Number.isInteger(rawSelectedMonth) && rawSelectedMonth >= 1 && rawSelectedMonth <= 12
            ? rawSelectedMonth
            : currentMonth;

    const selectedLabel = useMemo(
        () => MONTHS.find((month) => month.value === selectedMonth)?.label || "Ay",
        [selectedMonth]
    );

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = Number(event.target.value);
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("ay", String(value));

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
                aria-label="Ay filtresi"
                title={`Aktif ay: ${selectedLabel}`}
                value={String(selectedMonth)}
                onChange={handleChange}
                disabled={pending}
                className="h-10 md:h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-left text-[12px] md:text-[13px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors hover:border-slate-300 hover:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {MONTHS.map((month) => (
                    <option key={month.value} value={month.value}>
                        {month.label}
                    </option>
                ))}
            </select>
            <ChevronsUpDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    );
}
