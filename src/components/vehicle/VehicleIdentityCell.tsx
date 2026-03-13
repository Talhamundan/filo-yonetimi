"use client";

import React from "react";

export default function VehicleIdentityCell({
    plaka,
    subtitle,
    companyName,
    showCompanyInfo = false,
    extra,
}: {
    plaka: string;
    subtitle?: string | null;
    companyName?: string | null;
    showCompanyInfo?: boolean;
    extra?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col">
            <span className="font-mono font-bold text-slate-900 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-md inline-block shadow-sm tracking-wide text-xs w-max">
                {plaka}
            </span>
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
