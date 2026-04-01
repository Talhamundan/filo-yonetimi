"use client";

import { useSearchParams } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportExportToolbarProps = {
    report: "penalties" | "maintenance" | "document-expirations" | "vehicle-expenses" | "monthly-cost-summary";
    className?: string;
    extraParams?: Record<string, string | null | undefined>;
};

function buildUrl(
    report: ReportExportToolbarProps["report"],
    searchParams: URLSearchParams,
    extraParams?: Record<string, string | null | undefined>
) {
    const params = new URLSearchParams();
    const allowedKeys = ["sirket", "yil", "ay", "from", "to", "q", "status", "type"] as const;
    for (const key of allowedKeys) {
        const value = searchParams.get(key);
        if (value) params.set(key, value);
    }
    if (extraParams) {
        for (const key of allowedKeys) {
            const value = extraParams[key];
            if (value && value.length > 0) {
                params.set(key, value);
            }
        }
    }
    params.set("format", "xlsx");
    return `/api/reports/${report}?${params.toString()}`;
}

export default function ReportExportToolbar({
    report,
    className,
    extraParams,
}: ReportExportToolbarProps) {
    const searchParams = useSearchParams();
    const params = new URLSearchParams(searchParams.toString());

    return (
        <div className={`flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap ${className || ""}`}>
            <a href={buildUrl(report, params, extraParams)} className="flex-1 sm:flex-none">
                <Button type="button" variant="outline" size="sm" className="h-10 w-full">
                    <Upload className="h-4 w-4" /> Dışa Aktar
                </Button>
            </a>
        </div>
    );
}
