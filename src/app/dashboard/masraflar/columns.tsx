"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"

export type MasrafRow = {
    id: string;
    tarih: Date;
    tur: string;
    tutar: number;
    arac: { id: string; plaka: string; marka: string; model: string; sirket?: { ad: string } | null };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd.MM.yyyy HH:mm", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<MasrafRow>[] => [
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
            return <VehicleIdentityCell
                aracId={row.original.arac.id}
                plaka={row.original.arac.plaka}
                subtitle={`${row.original.arac.marka} ${row.original.arac.model}`}
                companyName={row.original.arac.sirket?.ad}
                showCompanyInfo={showCompanyInfo}
            />
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
