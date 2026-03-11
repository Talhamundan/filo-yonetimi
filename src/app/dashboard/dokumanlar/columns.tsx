"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { FileText, Download } from "lucide-react"

export type DokumanRow = {
    id: string;
    ad: string;
    dosyaUrl: string;
    tur: string;
    yuklemeTarihi: Date;
    arac: { id: string; plaka: string; marka: string; model: string };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

export const columns: ColumnDef<DokumanRow>[] = [
    {
        accessorKey: "ad",
        header: "Dosya Adı",
        cell: ({ row }) => {
            return (
                <div className="flex items-center gap-2">
                    <FileText size={16} className="text-indigo-400" />
                    <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{row.original.ad}</span>
                </div>
            )
        },
    },
    {
        accessorKey: "arac_plaka",
        header: "İlgili Araç",
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
        header: "Evrak Türü",
        cell: ({ row }) => {
            const tur = row.getValue("tur") as string;
            return <Badge variant="outline" className="px-2.5 py-1 border-slate-200 shadow-sm bg-slate-50 font-bold text-slate-700">{tur.replace('_', ' ')}</Badge>
        },
    },
    {
        accessorKey: "yuklemeTarihi",
        header: "Yüklenme Tarihi",
        cell: ({ row }) => {
            return <div className="text-slate-600 font-medium">{formatDate(row.getValue("yuklemeTarihi"))}</div>
        },
    },
    {
        accessorKey: "dosyaUrl",
        header: () => <div className="text-right">İşlemler</div>,
        cell: ({ row }) => {
            return (
                <div className="flex justify-end">
                    <a
                        href={row.original.dosyaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download size={14} /> İndir
                    </a>
                </div>
            )
        },
    },
]
