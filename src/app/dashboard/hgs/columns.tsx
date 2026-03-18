"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CreditCard } from "lucide-react"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"

export type HgsRow = {
    id: string;
    tarih: Date;
    etiketNo: string | null;
    tutar: number;
    km: number | null;
    arac: { id: string; plaka: string; marka: string; model: string; sirket?: { ad: string } | null };
}

const formatDate = (date: string | Date | null | undefined) =>
    date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<HgsRow>[] => [
    {
        accessorKey: "arac_plaka",
        header: "Araç",
        accessorFn: (row) => row.arac.plaka,
        cell: ({ row }) => (
            <VehicleIdentityCell
                aracId={row.original.arac.id}
                plaka={row.original.arac.plaka}
                subtitle={`${row.original.arac.marka} ${row.original.arac.model}`}
                companyName={row.original.arac.sirket?.ad}
                showCompanyInfo={showCompanyInfo}
            />
        ),
    },
    {
        accessorKey: "etiketNo",
        header: "HGS Etiket No",
        cell: ({ row }) => {
            const no = row.getValue("etiketNo") as string;
            return (
                <div className="font-semibold text-slate-800 flex items-center gap-2">
                    <CreditCard size={14} className="text-indigo-400" />
                    {no || <span className="italic text-slate-400 font-normal">Belirtilmedi</span>}
                </div>
            );
        },
    },
    {
        accessorKey: "tarih",
        header: "İşlem Tarihi",
        cell: ({ row }) => (
            <div className="text-slate-700 font-medium">{formatDate(row.getValue("tarih"))}</div>
        ),
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Yükleme Tutarı</div>,
        cell: ({ row }) => (
            <div className="text-right font-black text-indigo-600">
                ₺{row.original.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </div>
        ),
    },
    {
        accessorKey: "km",
        header: "İşlem KM",
        cell: ({ row }) => (
            <div className="text-slate-600 font-medium">
                {row.original.km ? `${row.original.km.toLocaleString('tr-TR')} km` : '-'}
            </div>
        ),
    },
]
