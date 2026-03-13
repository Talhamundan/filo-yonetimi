"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"

export type SoforZimmetRow = {
    id: string;
    baslangic: Date;
    bitis: Date | null;
    baslangicKm: number;
    bitisKm: number | null;
    notlar: string | null;
    arac: { id: string; plaka: string; marka: string; model: string; sirket?: { ad: string } | null };
    kullanici: { id: string; ad: string; soyad: string; tcNo: string | null } | null;
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<SoforZimmetRow>[] => [
    {
        id: "durum",
        header: "Durum",
        cell: ({ row }) => {
            const bitis = row.original.bitis;
            return !bitis
                ? <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 font-semibold px-2.5 py-0.5 border-0 shadow-none">Aktif Zimmet</Badge>
                : <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold px-2.5 py-0.5 border-0 shadow-none">Tamamlandı</Badge>;
        },
    },
    {
        accessorKey: "arac_plaka",
        header: "Araç Plakası",
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
        accessorKey: "kullanici_adSoyad",
        header: "Şoför / Kullanıcı",
        accessorFn: (row) => row.kullanici ? `${row.kullanici.ad} ${row.kullanici.soyad}` : 'Atanmamış',
        cell: ({ row }) => {
            const k = row.original.kullanici;
            if (!k) return <span className="text-slate-400 italic text-xs">Atanmamış</span>;
            return (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{k.ad} {k.soyad}</span>
                    <span className="text-xs font-medium text-slate-500 mt-0.5">TC: {k.tcNo || '-'}</span>
                </div>
            )
        },
    },
    {
        accessorKey: "baslangic",
        header: "Başlangıç",
        cell: ({ row }) => {
            return <div className="text-slate-700 font-medium">{formatDate(row.original.baslangic)}</div>
        },
    },
    {
        accessorKey: "bitis",
        header: "Bitiş",
        cell: ({ row }) => {
            return <div className="text-slate-700 font-medium">{row.original.bitis ? formatDate(row.original.bitis) : '-'}</div>
        },
    },
    {
        accessorKey: "kmDetay",
        header: "KM Detayı (Teslim Alma / Etme)",
        cell: ({ row }) => {
            return <div className="text-slate-600 text-sm font-medium">{row.original.baslangicKm.toLocaleString()} km <span className="text-slate-300 mx-1">/</span> {row.original.bitisKm ? `${row.original.bitisKm.toLocaleString()} km` : '-'}</div>
        },
    },
]
