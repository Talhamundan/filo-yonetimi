"use client";

import React, { startTransition, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { isKiralikSirketName } from "@/lib/ruhsat-sahibi";

type CompanyScopeSwitcherProps = {
    sirketler: { id: string; ad: string }[];
    allowAllOption?: boolean;
};

export default function CompanyScopeSwitcher({ sirketler, allowAllOption = true }: CompanyScopeSwitcherProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, setPending] = useState(false);

    const visibleSirketler = useMemo(
        () => sirketler.filter((sirket) => !isKiralikSirketName(sirket.ad)),
        [sirketler]
    );
    const firstCompanyId = visibleSirketler[0]?.id || "";
    const rawSelectedSirketId = searchParams.get("sirket") || "";
    const selectedSirketId = useMemo(() => {
        if (allowAllOption) {
            if (!rawSelectedSirketId) return "__ALL__";
            return visibleSirketler.some((sirket) => sirket.id === rawSelectedSirketId)
                ? rawSelectedSirketId
                : "__ALL__";
        }
        if (rawSelectedSirketId && visibleSirketler.some((sirket) => sirket.id === rawSelectedSirketId)) {
            return rawSelectedSirketId;
        }
        return firstCompanyId;
    }, [allowAllOption, rawSelectedSirketId, visibleSirketler, firstCompanyId]);

    const selectedLabel = useMemo(() => {
        if (allowAllOption && selectedSirketId === "__ALL__") {
            return "Tum Sirketler";
        }

        return visibleSirketler.find((sirket) => sirket.id === selectedSirketId)?.ad || "Sirket Sec";
    }, [allowAllOption, selectedSirketId, visibleSirketler]);

    React.useEffect(() => {
        if (!rawSelectedSirketId) return;
        const hasVisibleSelection = visibleSirketler.some((sirket) => sirket.id === rawSelectedSirketId);
        if (hasVisibleSelection) return;

        const nextParams = new URLSearchParams(searchParams.toString());
        if (allowAllOption) {
            nextParams.delete("sirket");
        } else if (firstCompanyId) {
            nextParams.set("sirket", firstCompanyId);
        } else {
            nextParams.delete("sirket");
        }

        const query = nextParams.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
        router.refresh();
    }, [allowAllOption, firstCompanyId, pathname, rawSelectedSirketId, router, searchParams, visibleSirketler]);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        const nextParams = new URLSearchParams(searchParams.toString());

        if (allowAllOption && value === "__ALL__") {
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
        <div className="relative w-[142px] md:w-[156px]">
            <select
                aria-label="Sirket filtresi"
                title={`Aktif kapsam: ${selectedLabel}`}
                value={selectedSirketId}
                onChange={handleChange}
                disabled={pending}
                className="h-10 md:h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-7 text-left text-xs md:text-[11px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-colors hover:border-slate-300 hover:bg-slate-50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {allowAllOption ? <option value="__ALL__">Tum Sirketler</option> : null}
                {visibleSirketler.map((sirket) => (
                    <option key={sirket.id} value={sirket.id}>
                        {sirket.ad}
                    </option>
                ))}
            </select>
            <ChevronsUpDown size={11} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    );
}
