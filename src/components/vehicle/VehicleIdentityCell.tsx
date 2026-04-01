"use client";

import React from "react";
import Link from "next/link";

export default function VehicleIdentityCell({
    aracId,
    plaka,
    subtitle,
    companyName,
    showCompanyInfo = false,
    extra,
}: {
    aracId?: string | null;
    plaka?: string | null;
    subtitle?: string | null;
    companyName?: string | null;
    showCompanyInfo?: boolean;
    extra?: React.ReactNode;
}) {
    const plateText = (plaka || "-").trim() || "-";
    const plateBadge = (
        <span className="font-mono font-bold text-slate-900 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-md inline-block shadow-sm tracking-wide text-xs w-max">
            {plateText}
        </span>
    );

    return (
        <div className="flex flex-col">
            {aracId ? (
                <Link
                    href={`/dashboard/araclar/${aracId}`}
                    className="w-max rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    onClick={(event) => event.stopPropagation()}
                >
                    {plateBadge}
                </Link>
            ) : (
                plateBadge
            )}
            {subtitle ? (
                <span className="text-[11px] text-slate-500 mt-1">
                    {subtitle}
                </span>
            ) : null}
            {showCompanyInfo && companyName ? (
                <span className="text-[11px] font-semibold text-indigo-600 mt-0.5">
                    {companyName}
                </span>
            ) : null}
            {extra}
        </div>
    );
}
