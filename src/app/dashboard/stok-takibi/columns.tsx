"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type StokKalemRow = {
    id: string;
    ad: string;
    kategori: string | null;
    miktar: number;
    birim: string;
    konum: string | null;
    kritikSeviye: number | null;
    aciklama: string | null;
    sirketId: string | null;
    sirketAd: string | null;
    olusturmaTarihi: Date;
    guncellemeTarihi: Date;
};

function formatQuantity(value: number) {
    return Number(value || 0).toLocaleString("tr-TR", {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
        maximumFractionDigits: 2,
    });
}

function getStockStatus(row: StokKalemRow) {
    const kritik = typeof row.kritikSeviye === "number" && Number.isFinite(row.kritikSeviye) ? row.kritikSeviye : null;
    if (kritik !== null && row.miktar <= kritik) {
        return {
            label: "Kritik",
            className: "border-rose-200 bg-rose-50 text-rose-700",
            icon: AlertTriangle,
        };
    }

    return {
        label: "Yeterli",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
    };
}

export function getColumns(showCompanyInfo: boolean): ColumnDef<StokKalemRow>[] {
    const columns: ColumnDef<StokKalemRow>[] = [
        {
            id: "durum",
            accessorFn: (row) => {
                const status = getStockStatus(row);
                return status.label;
            },
            header: "Durum",
            cell: ({ row }) => {
                const status = getStockStatus(row.original);
                const Icon = status.icon;
                return (
                    <Badge className={status.className}>
                        <Icon size={12} className="mr-1" />
                        {status.label}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "ad",
            header: "Stok Adı",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="rounded-md bg-indigo-50 p-1.5 text-indigo-600">
                        <Package size={14} />
                    </span>
                    <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">{row.original.ad}</div>
                        <div className="truncate text-xs text-slate-500">{row.original.kategori || "Kategori yok"}</div>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "miktar",
            header: () => <div className="text-right">Adet</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <span className="font-mono text-sm font-bold text-slate-800">
                        {formatQuantity(row.original.miktar)} {row.original.birim}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "konum",
            header: "Stok Yeri",
            cell: ({ row }) => <span className="font-medium text-slate-700">{row.original.konum || "-"}</span>,
        },
        {
            accessorKey: "kritikSeviye",
            header: "Kritik Seviye",
            cell: ({ row }) => {
                if (typeof row.original.kritikSeviye !== "number") return <span className="text-slate-400">-</span>;
                return (
                    <span className="font-mono text-xs text-slate-600">
                        {formatQuantity(row.original.kritikSeviye)} {row.original.birim}
                    </span>
                );
            },
        },
        {
            accessorKey: "aciklama",
            header: "Açıklama",
            cell: ({ row }) => <span className="text-slate-600">{row.original.aciklama || "-"}</span>,
        },
    ];

    if (showCompanyInfo) {
        columns.splice(4, 0, {
            id: "sirketAd",
            accessorFn: (row) => row.sirketAd || "",
            header: "Şirket",
            cell: ({ row }) => <span className="font-semibold text-indigo-600">{row.original.sirketAd || "-"}</span>,
        });
    }

    return columns;
}
