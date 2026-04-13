"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type GaugeChartProps = {
    label: string;
    value: number;
    min?: number;
    max?: number;
    valueText?: string;
    helperText?: string;
    sublabel?: string;
    color?: string;
    trackColor?: string;
    className?: string;
    headerRight?: React.ReactNode;
    footer?: React.ReactNode;
};

function clamp(value: number, min: number, max: number) {
    if (Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
}

export function GaugeChart({
    label,
    value,
    min = 0,
    max = 100,
    valueText,
    helperText,
    sublabel,
    color = "#2563EB",
    trackColor = "#E2E8F0",
    className,
    headerRight,
    footer,
}: GaugeChartProps) {
    const safeRange = max > min ? max - min : 1;
    const normalized = clamp((value - min) / safeRange, 0, 1);
    const percentage = Math.round(normalized * 100);

    return (
        <div className={cn("rounded-xl border border-slate-200 bg-white p-4", className)}>
            <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    {sublabel ? <p className="mt-1 text-[11px] text-slate-500">{sublabel}</p> : null}
                </div>
                {headerRight}
            </div>

            <div className="relative mx-auto w-full max-w-[260px]">
                <svg viewBox="0 0 100 64" className="h-36 w-full" role="img" aria-label={`${label}: ${valueText || `${percentage}%`}`}>
                    <path
                        d="M10 52 A40 40 0 0 1 90 52"
                        fill="none"
                        stroke={trackColor}
                        strokeWidth="10"
                        strokeLinecap="round"
                    />
                    <path
                        d="M10 52 A40 40 0 0 1 90 52"
                        fill="none"
                        stroke={color}
                        strokeWidth="10"
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray={`${normalized * 100} 100`}
                    />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-5">
                    <p className="text-xl font-black text-slate-900">{valueText || `${percentage}%`}</p>
                    <p className="text-[11px] font-medium text-slate-500">
                        {min.toLocaleString("tr-TR")} - {max.toLocaleString("tr-TR")}
                    </p>
                </div>
            </div>

            {footer ? (
                <div className="mt-1">{footer}</div>
            ) : helperText ? (
                <p className="mt-1 text-center text-xs font-medium text-slate-600">{helperText}</p>
            ) : null}
        </div>
    );
}
