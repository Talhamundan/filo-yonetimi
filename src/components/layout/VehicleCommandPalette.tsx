"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type VehicleQuickSearchItem = {
    id: string;
    plaka: string;
    marka?: string | null;
    model?: string | null;
};

type VehicleCommandPaletteProps = {
    vehicles: VehicleQuickSearchItem[];
    className?: string;
};

type RankedVehicle = VehicleQuickSearchItem & {
    score: number;
};

function normalizePlate(value: unknown) {
    const raw = typeof value === "string" ? value : String(value || "");
    return raw.toLocaleUpperCase("tr-TR").replace(/[^A-Z0-9]/g, "");
}

function normalizeText(value: unknown) {
    const raw = typeof value === "string" ? value : String(value || "");
    return raw
        .toLocaleUpperCase("tr-TR")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getVehicleLabel(item: VehicleQuickSearchItem) {
    const markaModel = `${item.marka || ""} ${item.model || ""}`.trim();
    return markaModel || "Araç";
}

export default function VehicleCommandPalette({ vehicles, className }: VehicleCommandPaletteProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [activeIndex, setActiveIndex] = React.useState(0);
    const isMacPlatform = React.useMemo(() => {
        if (typeof navigator === "undefined") return true;
        return /Mac|iPhone|iPad/i.test(navigator.platform);
    }, []);
    const shortcutLabel = isMacPlatform ? "⌘K" : "Ctrl+K";

    const preparedVehicles = React.useMemo(
        () =>
            vehicles
                .map((item) => ({
                    ...item,
                    plaka: String(item.plaka || "").trim(),
                }))
                .filter((item) => item.id && item.plaka),
        [vehicles]
    );

    const rankedVehicles = React.useMemo(() => {
        const normalizedQueryPlate = normalizePlate(query);
        const normalizedQueryText = normalizeText(query);
        const hasQuery = normalizedQueryPlate.length > 0 || normalizedQueryText.length > 0;

        const scored: RankedVehicle[] = preparedVehicles
            .map((item) => {
                const plate = normalizePlate(item.plaka);
                const label = normalizeText(`${item.plaka} ${item.marka || ""} ${item.model || ""}`);
                let score = 0;

                if (!hasQuery) {
                    score = 10;
                } else if (normalizedQueryPlate && plate === normalizedQueryPlate) {
                    score = 500;
                } else if (normalizedQueryPlate && plate.startsWith(normalizedQueryPlate)) {
                    score = 400;
                } else if (normalizedQueryPlate && plate.includes(normalizedQueryPlate)) {
                    score = 300;
                } else if (normalizedQueryText && label.includes(normalizedQueryText)) {
                    score = 200;
                }

                return {
                    ...item,
                    score,
                };
            })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score || a.plaka.localeCompare(b.plaka, "tr"));

        return scored.slice(0, 14);
    }, [preparedVehicles, query]);

    React.useEffect(() => {
        setActiveIndex(0);
    }, [query, open]);

    React.useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 10);
        return () => window.clearTimeout(timer);
    }, [open]);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
            if (!isShortcut) return;
            event.preventDefault();
            setOpen(true);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    const handleOpenChange = React.useCallback((nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setQuery("");
            setActiveIndex(0);
        }
    }, []);

    const navigateToVehicle = React.useCallback(
        (vehicle: VehicleQuickSearchItem | undefined) => {
            if (!vehicle?.id) return;
            const params = new URLSearchParams(searchParams.toString());
            const queryText = params.toString();
            const href = queryText
                ? `/dashboard/araclar/${vehicle.id}?${queryText}`
                : `/dashboard/araclar/${vehicle.id}`;
            router.push(href);
            handleOpenChange(false);
        },
        [handleOpenChange, router, searchParams]
    );

    const handleInputKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => {
                    if (rankedVehicles.length === 0) return 0;
                    return current >= rankedVehicles.length - 1 ? 0 : current + 1;
                });
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => {
                    if (rankedVehicles.length === 0) return 0;
                    return current <= 0 ? rankedVehicles.length - 1 : current - 1;
                });
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                navigateToVehicle(rankedVehicles[activeIndex] || rankedVehicles[0]);
            }
        },
        [activeIndex, navigateToVehicle, rankedVehicles]
    );

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    "group hidden h-10 min-w-[210px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 md:inline-flex",
                    className
                )}
                aria-label="Komut aramayı aç"
                title={`Komut Arama (${shortcutLabel})`}
            >
                <span className="inline-flex items-center gap-2">
                    <Search size={14} className="text-slate-400 group-hover:text-slate-500" />
                    Plaka ile araç ara...
                </span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {shortcutLabel}
                </span>
            </button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="sm:max-w-xl p-0 gap-0" showCloseButton={false}>
                    <DialogHeader className="sr-only">
                        <DialogTitle>Komut Arama</DialogTitle>
                        <DialogDescription>Plaka yazarak araç detay sayfasına hızla gidin.</DialogDescription>
                    </DialogHeader>

                    <div className="border-b border-slate-200 p-3">
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={handleInputKeyDown}
                            placeholder="Plaka yazın (örn: 34ABC123)..."
                            className="h-10"
                        />
                    </div>

                    <div className="max-h-[360px] overflow-y-auto p-2">
                        {rankedVehicles.length > 0 ? (
                            <ul className="space-y-1">
                                {rankedVehicles.map((item, index) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => navigateToVehicle(item)}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            className={cn(
                                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition",
                                                activeIndex === index
                                                    ? "bg-indigo-50 text-indigo-900"
                                                    : "hover:bg-slate-50 text-slate-700"
                                            )}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold">{item.plaka}</span>
                                                <span className="block truncate text-[11px] text-slate-500">{getVehicleLabel(item)}</span>
                                            </span>
                                            <span className="ml-2 text-[10px] font-semibold text-slate-400">Enter</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                                Sonuç bulunamadı. Plakayı farklı biçimde deneyin.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
