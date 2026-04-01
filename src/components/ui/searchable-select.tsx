"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
    value: string;
    label: string;
    searchText?: string;
    disabled?: boolean;
};

type SearchableSelectProps = {
    value: string;
    onValueChange: (value: string) => void;
    options: SearchableSelectOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    className?: string;
    triggerClassName?: string;
    contentClassName?: string;
};

const normalize = (value: string) =>
    value
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

export function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder = "Seçiniz...",
    searchPlaceholder = "Listede ara...",
    emptyText = "Sonuç bulunamadı.",
    disabled = false,
    className,
    triggerClassName,
    contentClassName,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const selectedOption = React.useMemo(
        () => options.find((option) => option.value === value) || null,
        [options, value]
    );

    const filteredOptions = React.useMemo(() => {
        const normalizedQuery = normalize(query.trim());
        if (!normalizedQuery) {
            return options;
        }

        return options.filter((option) => {
            const haystack = normalize([option.label, option.searchText || ""].join(" "));
            return haystack.includes(normalizedQuery);
        });
    }, [options, query]);

    React.useEffect(() => {
        if (!open) {
            setQuery("");
            return;
        }
        const handlePointerDown = (event: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    React.useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [open]);

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                className={cn(
                    "h-9 flex w-full items-center justify-between rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
                    triggerClassName
                )}
            >
                <span className={cn("truncate text-left", !selectedOption && "text-slate-400")}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronsUpDown className="h-4 w-4 text-slate-400" />
            </button>
            {open && !disabled ? (
                <div
                    className={cn(
                        "absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg",
                        contentClassName
                    )}
                >
                    <div className="border-b border-slate-100 p-2">
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={searchPlaceholder}
                            className="h-8 w-full rounded-md border border-slate-200 bg-transparent px-2.5 text-sm outline-none focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300"
                        />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={`${option.value}-${option.label}`}
                                    type="button"
                                    disabled={option.disabled}
                                    onClick={() => {
                                        onValueChange(option.value);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                        option.value === value ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-100",
                                        option.disabled && "cursor-not-allowed opacity-50"
                                    )}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {option.value === value ? <Check className="h-4 w-4" /> : null}
                                </button>
                            ))
                        ) : (
                            <p className="px-2 py-2 text-sm text-slate-500">{emptyText}</p>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
