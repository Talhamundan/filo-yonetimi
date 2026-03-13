"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"

export type ArizaRow = {
    id: string;
    aciklama: string;
    arizaTarihi: Date;
    durum: 'ACIK' | 'TAMIRDE' | 'COZULDU' | 'PARCA_BEKLIYOR';
    servis: string | null;
    tahminiTutar: number | null;
    arac: { id: string; plaka: string; marka: string; model: string; sirket?: { ad: string } | null };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<ArizaRow>[] => [
    {
        accessorKey: "durum",
        header: "Durum",
        cell: ({ row }) => {
            const d = row.getValue("durum") as string;
            switch (d) {
                case "ACIK": return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-none font-semibold px-2">Açık Arıza</Badge>
                case "TAMIRDE": return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 shadow-none font-semibold px-2">Tamirde</Badge>
                case "PARCA_BEKLIYOR": return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-0 shadow-none font-semibold px-2">Parça Bekleniyor</Badge>
                case "COZULDU": return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 shadow-none font-semibold px-2">Çözüldü</Badge>
                default: return <Badge variant="outline">{d}</Badge>
            }
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
        accessorKey: "aciklama",
        header: "Arıza Açıklaması",
        cell: ({ row }) => {
            return <div className="font-medium text-slate-800 max-w-[300px] truncate" title={row.getValue("aciklama")}>{row.getValue("aciklama")}</div>
        },
    },
    {
        accessorKey: "arizaTarihi",
        header: "Kayıt Tarihi",
        cell: ({ row }) => {
            return <div className="text-slate-600 font-medium">{formatDate(row.getValue("arizaTarihi"))}</div>
        },
    },
    {
        accessorKey: "servis",
        header: "Yönlendirilen Servis",
        cell: ({ row }) => {
            const servis = row.getValue("servis") as string;
            return <div className="text-slate-700 font-medium">{servis || <span className="italic text-slate-400 font-normal">Belirtilmedi</span>}</div>
        },
    },
    {
        accessorKey: "tahminiTutar",
        header: () => <div className="text-right">Tahmini Maliyet</div>,
        cell: ({ row }) => {
            const tutar = row.original.tahminiTutar;
            return tutar
                ? <div className="text-right font-bold text-slate-900">₺{tutar.toLocaleString('tr-TR')}</div>
                : <div className="text-right italic text-slate-400 font-normal text-sm">Kesinleşmedi</div>
        },
    },
]
