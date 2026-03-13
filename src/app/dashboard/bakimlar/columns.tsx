"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"

export type BakimRow = {
    id: string;
    bakimTarihi: Date;
    yapilanKm: number;
    sonrakiBakimKm: number | null;
    servisAdi: string | null;
    yapilanIslemler: string | null;
    tutar: number;
    tur?: string;
    arac: { id: string; plaka: string; marka: string; model: string; sirket?: { ad: string } | null };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<BakimRow>[] => [
    {
        accessorKey: "bakimTarihi",
        header: "Tarih",
        cell: ({ row }) => {
            return <div className="text-slate-700 font-medium">{formatDate(row.original.bakimTarihi)}</div>
        },
    },
    {
        accessorKey: "arac_plaka",
        header: "Araç",
        accessorFn: (row) => row.arac.plaka,
        cell: ({ row }) => {
            return <VehicleIdentityCell
                plaka={row.original.arac.plaka}
                subtitle={`${row.original.arac.marka} ${row.original.arac.model}`}
                companyName={row.original.arac.sirket?.ad}
                showCompanyInfo={showCompanyInfo}
            />
        },
    },
    {
        accessorKey: "servisAdi",
        header: "Servis Adı",
        cell: ({ row }) => {
            return <div className="font-bold text-slate-800">{row.getValue("servisAdi") || '-'}</div>
        },
    },
    {
        accessorKey: "islem",
        header: "Yapılan İşlemler",
        cell: ({ row }) => {
            const islem = row.original.yapilanIslemler;
            return <div className="text-slate-600 max-w-[250px] truncate" title={islem || ''}>{islem || '-'}</div>
        },
    },
    {
        accessorKey: "yapilanKm",
        header: "Bakım KM",
        cell: ({ row }) => {
            return <div className="text-slate-700 font-medium">{row.original.yapilanKm.toLocaleString()} km</div>
        },
    },
    {
        accessorKey: "sonrakiBakimKm",
        header: "Sonraki Bakım",
        cell: ({ row }) => {
            const snr = row.original.sonrakiBakimKm;
            return snr
                ? <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 shadow-none font-bold">{snr.toLocaleString()} km</Badge>
                : <span className="text-slate-400 italic text-xs">Belirtilmemiş</span>;
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Tutar</div>,
        cell: ({ row }) => {
            return <div className="text-right font-bold text-slate-900">₺{row.original.tutar.toLocaleString('tr-TR')}</div>
        },
    },
]
