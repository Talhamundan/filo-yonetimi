"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Fuel } from "lucide-react"

export type YakitRow = {
    id: string;
    tarih: Date;
    litre: number;
    tutar: number;
    km: number;
    istasyon: string | null;
    odemeYontemi: 'NAKIT' | 'TASIT_TANIMA';
    arac: { 
        id: string; 
        plaka: string; 
        marka: string; 
        model: string;
        kullanici?: { id: string; ad: string; soyad: string } | null;
    };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy HH:mm", { locale: tr }) : '-';

export const columns: ColumnDef<YakitRow>[] = [
    {
        accessorKey: "arac_plaka",
        header: "Araç",
        accessorFn: (row) => row.arac.plaka,
        cell: ({ row }) => {
            const { arac } = row.original;
            const sofor = arac.kullanici ? `${arac.kullanici.ad} ${arac.kullanici.soyad}` : null;
            return (
                <div className="flex flex-col">
                    <span className="font-mono font-bold text-slate-900 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-md inline-block shadow-sm tracking-wide text-xs w-max">{arac.plaka}</span>
                    <span className="text-[11px] text-slate-500 mt-1">{arac.marka} {arac.model}</span>
                    {sofor && <span className="text-[11px] text-indigo-500 font-semibold mt-0.5">👤 {sofor}</span>}
                </div>
            )
        },
    },
    {
        accessorKey: "tarih",
        header: "Alım Tarihi & Saati",
        cell: ({ row }) => {
            return <div className="text-slate-700 font-medium">{formatDate(row.getValue("tarih"))}</div>
        },
    },
    {
        accessorKey: "istasyon",
        header: "İstasyon",
        cell: ({ row }) => {
            const istasyon = row.getValue("istasyon") as string;
            return <div className="font-semibold text-slate-800 flex items-center gap-2">
                <Fuel size={14} className="text-slate-400" />
                {istasyon || <span className="italic text-slate-400 font-normal">Belirtilmedi</span>}
            </div>
        },
    },
    {
        accessorKey: "km",
        header: "Alım Anındaki KM",
        cell: ({ row }) => {
            return <div className="text-slate-600 font-medium">{row.original.km.toLocaleString('tr-TR')} km</div>
        },
    },
    {
        accessorKey: "litre",
        header: () => <div className="text-right">Miktar (Litre)</div>,
        cell: ({ row }) => {
            return <div className="text-right font-medium text-slate-700">{row.original.litre.toFixed(2)} L</div>
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Tutar</div>,
        cell: ({ row }) => {
            return <div className="text-right font-black text-rose-600">₺{row.original.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
        },
    },
    {
        accessorKey: "odemeYontemi",
        header: "Ödeme Şekli",
        cell: ({ row }) => {
            const val = row.original.odemeYontemi;
            return val === 'TASIT_TANIMA'
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">🚗 Taşıt Tanıma</span>
                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">💵 Nakit</span>;
        },
    },
]
