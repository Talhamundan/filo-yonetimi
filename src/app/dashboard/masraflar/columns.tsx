"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"

export type MasrafRow = {
    id: string;
    tarih: Date;
    tur: string;
    tutar: number;
    arac: { id: string; plaka: string; marka: string; model: string };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

export const columns: ColumnDef<MasrafRow>[] = [
    {
        accessorKey: "tarih",
        header: "Tarih",
        cell: ({ row }) => {
            return <div className="text-slate-600 font-medium">{formatDate(row.getValue("tarih"))}</div>
        },
    },
    {
        accessorKey: "arac_plaka",
        header: "Harcanan Araç",
        accessorFn: (row) => row.arac.plaka,
        cell: ({ row }) => {
            return (
                <div className="flex flex-col">
                    <span className="font-mono font-bold text-slate-900 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-md inline-block shadow-sm tracking-wide text-xs w-max">{row.original.arac.plaka}</span>
                    <span className="text-[11px] text-slate-500 mt-1">{row.original.arac.marka} {row.original.arac.model}</span>
                </div>
            )
        },
    },
    {
        accessorKey: "tur",
        header: "Kategori",
        cell: ({ row }) => {
            const tur = row.getValue("tur") as string;
            return <Badge variant="outline" className="px-2.5 py-1 border-slate-200 shadow-sm bg-slate-50 font-bold text-slate-700">{tur.replace('_', ' ')}</Badge>
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Tutar</div>,
        cell: ({ row }) => {
            return <div className="text-right font-black text-rose-600">₺{row.original.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
        },
    },
]
