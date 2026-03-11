"use client"

import { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle, User } from "lucide-react"

export type CezaRow = {
    id: string;
    tarih: string;
    arac: string;
    sofor: string;
    tutar: number;
    km: number | null;
    aciklama: string;
    odendiMi: boolean;
}

export const columns: ColumnDef<CezaRow>[] = [
    {
        accessorKey: "arac",
        header: "Araç Plaka",
        cell: ({ row }) => <span className="font-semibold text-slate-900">{row.getValue("arac")}</span>
    },
    {
        accessorKey: "sofor",
        header: "Şoför",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <User size={14} className="text-slate-500" />
                <span>{row.getValue("sofor")}</span>
            </div>
        )
    },
    {
        accessorKey: "tarih",
        header: "Tarih",
        cell: ({ row }) => new Date(row.getValue("tarih")).toLocaleDateString("tr-TR")
    },
    {
        accessorKey: "tutar",
        header: "Tutar",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("tutar"));
            return <span className="font-medium text-rose-600">₺{amount.toLocaleString("tr-TR")}</span>;
        }
    },
    {
        accessorKey: "km",
        header: "İşlem KM",
        cell: ({ row }) => {
            const km = row.original.km;
            return <span className="text-slate-600 font-medium">{km ? `${km.toLocaleString("tr-TR")} km` : '-'}</span>;
        }
    },
    {
        accessorKey: "aciklama",
        header: "Açıklama",
    },
    {
        accessorKey: "odendiMi",
        header: "Durum",
        cell: ({ row }) => {
            const odendi = row.getValue("odendiMi") as boolean;
            return odendi ? (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">Ödendi</span>
            ) : (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 flex items-center gap-1 w-max">
                    <AlertTriangle size={12} /> Ödenmedi
                </span>
            )
        }
    }
]
