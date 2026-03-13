"use client";

import React, { startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

type CompanyScopeSwitcherProps = {
    sirketler: { id: string; ad: string }[];
};

export default function CompanyScopeSwitcher({ sirketler }: CompanyScopeSwitcherProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, setPending] = useState(false);

    const selectedSirketId = searchParams.get("sirket") || "__ALL__";
    const selectedLabel = useMemo(() => {
        if (selectedSirketId === "__ALL__") {
            return "Tum Sirketler";
        }

        return sirketler.find((sirket) => sirket.id === selectedSirketId)?.ad || "Sirket Sec";
    }, [selectedSirketId, sirketler]);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        const nextParams = new URLSearchParams(searchParams.toString());

        if (value === "__ALL__") {
            nextParams.delete("sirket");
        } else {
            nextParams.set("sirket", value);
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
        <div className="relative w-full max-w-[156px]">
            <select
                aria-label="Sirket filtresi"
                title={`Aktif kapsam: ${selectedLabel}`}
                value={selectedSirketId}
                onChange={handleChange}
                disabled={pending}
                className="h-11 w-full appearance-none rounded-full border border-slate-200 bg-white pl-3 pr-8 text-left text-[13px] font-semibold text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <option value="__ALL__">Tum Sirketler</option>
                {sirketler.map((sirket) => (
                    <option key={sirket.id} value={sirket.id}>
                        {sirket.ad}
                    </option>
                ))}
            </select>
            <ChevronsUpDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    );
}
