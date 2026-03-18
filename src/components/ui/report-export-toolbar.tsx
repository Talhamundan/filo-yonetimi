"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportExportToolbarProps = {
    report: "penalties" | "maintenance" | "document-expirations" | "vehicle-expenses" | "monthly-cost-summary";
    className?: string;
};

function buildUrl(report: ReportExportToolbarProps["report"], format: "xlsx" | "pdf", searchParams: URLSearchParams) {
    const params = new URLSearchParams();
    const allowedKeys = ["sirket", "yil", "from", "to", "q", "status"] as const;
    for (const key of allowedKeys) {
        const value = searchParams.get(key);
        if (value) params.set(key, value);
    }
    params.set("format", format);
    return `/api/reports/${report}?${params.toString()}`;
}

export default function ReportExportToolbar({ report, className }: ReportExportToolbarProps) {
    const searchParams = useSearchParams();

    return (
        <div className={`flex items-center gap-2 ${className || ""}`}>
            <a href={buildUrl(report, "xlsx", new URLSearchParams(searchParams.toString()))}>
                <Button type="button" variant="outline" size="sm" className="h-10">
                    <Download className="h-4 w-4" /> Excel Raporu
                </Button>
            </a>
            <a href={buildUrl(report, "pdf", new URLSearchParams(searchParams.toString()))}>
                <Button type="button" variant="outline" size="sm" className="h-10">
                    <FileText className="h-4 w-4" /> PDF Raporu
                </Button>
            </a>
        </div>
    );
}
