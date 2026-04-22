"use client";

import React, { startTransition, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

export default function CategoryScopeSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, setPending] = useState(false);

    const rawKategori = searchParams.get("kategori");
    const activeValue = rawKategori === "BINEK" ? "BINEK" : rawKategori === "SANTIYE" ? "SANTIYE" : "__ALL__";

    const labelMap: Record<string, string> = {
        "__ALL__": "Tüm Araçlar",
        "BINEK": "Binek",
        "SANTIYE": "Şantiye"
    };

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        const nextParams = new URLSearchParams(searchParams.toString());

        if (value === "__ALL__") {
            nextParams.delete("kategori");
        } else {
            nextParams.set("kategori", value);
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
        <div className="relative w-[110px] md:w-[130px]">
            <select
                aria-label="Üst Kategori Filtresi"
                title={`Aktif Üst Kategori: ${labelMap[activeValue]}`}
                value={activeValue}
                onChange={handleChange}
                disabled={pending}
                className="h-9 md:h-10 w-full appearance-none rounded-lg md:rounded-xl border border-slate-200 bg-white pl-2.5 pr-7 text-left text-[11px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors hover:border-slate-300 hover:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <option value="__ALL__">{labelMap["__ALL__"]}</option>
                <option value="BINEK">{labelMap["BINEK"]}</option>
                <option value="SANTIYE">{labelMap["SANTIYE"]}</option>
            </select>
            <ChevronsUpDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    );
}
