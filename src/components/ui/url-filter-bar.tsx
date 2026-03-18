"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = { value: string; label: string };

type UrlFilterBarProps = {
    className?: string;
    showQuery?: boolean;
    showDateRange?: boolean;
    statusOptions?: Option[];
    typeOptions?: Option[];
};

export default function UrlFilterBar({
    className,
    showQuery = true,
    showDateRange = true,
    statusOptions = [],
    typeOptions = [],
}: UrlFilterBarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialValues = useMemo(
        () => ({
            q: searchParams.get("q") || "",
            status: searchParams.get("status") || "",
            type: searchParams.get("type") || "",
            from: searchParams.get("from") || "",
            to: searchParams.get("to") || "",
        }),
        [searchParams]
    );

    const [q, setQ] = useState(initialValues.q);
    const [status, setStatus] = useState(initialValues.status);
    const [type, setType] = useState(initialValues.type);
    const [from, setFrom] = useState(initialValues.from);
    const [to, setTo] = useState(initialValues.to);

    const applyFilters = () => {
        const params = new URLSearchParams(searchParams.toString());

        if (q.trim()) params.set("q", q.trim());
        else params.delete("q");

        if (status) params.set("status", status);
        else params.delete("status");

        if (type) params.set("type", type);
        else params.delete("type");

        if (from) params.set("from", from);
        else params.delete("from");

        if (to) params.set("to", to);
        else params.delete("to");

        router.push(`?${params.toString()}`);
    };

    const resetFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        ["q", "status", "type", "from", "to"].forEach((key) => params.delete(key));
        setQ("");
        setStatus("");
        setType("");
        setFrom("");
        setTo("");
        router.push(params.toString() ? `?${params.toString()}` : "?");
    };

    return (
        <div className={`flex items-center gap-2 flex-wrap ${className || ""}`}>
            {showQuery ? (
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Arama..." className="h-9 w-44" />
            ) : null}
            {statusOptions.length ? (
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                    <option value="">Durum</option>
                    {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : null}
            {typeOptions.length ? (
                <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                    <option value="">Tür</option>
                    {typeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : null}
            {showDateRange ? (
                <>
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
                </>
            ) : null}
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={applyFilters}>
                Uygula
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
                Sıfırla
            </Button>
        </div>
    );
}
