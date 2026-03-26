"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RowActionButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    variant: "edit" | "delete";
};

const baseClassName =
    "inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:pointer-events-none disabled:opacity-50";

export function RowActionButton({ variant, className, title, "aria-label": ariaLabel, ...props }: RowActionButtonProps) {
    const label = ariaLabel ?? title ?? (variant === "edit" ? "Düzenle" : "Sil");

    return (
        <button
            type="button"
            title={title ?? (variant === "edit" ? "Düzenle" : "Sil")}
            aria-label={label}
            className={cn(baseClassName, variant === "delete" ? "text-slate-400 hover:text-slate-600" : "", className)}
            {...props}
        >
            {variant === "edit" ? <Pencil size={15} /> : <Trash2 size={15} />}
        </button>
    );
}

