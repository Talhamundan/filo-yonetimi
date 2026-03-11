"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format, differenceInDays } from "date-fns"
import { tr } from "date-fns/locale"

export type SigortaRow = {
    id: string;
    sirket: string | null;
    policeNo: string | null;
    baslangicTarihi: Date;
    bitisTarihi: Date;
    tutar: number | null;
    aktifMi: boolean;
    arac: { id: string; plaka: string; marka: string; model: string };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

export const columns: ColumnDef<SigortaRow>[] = [
    {
        accessorKey: "aktifMi",
        header: "Mevcut Durum",
        cell: ({ row }) => {
            const aktif = row.getValue("aktifMi") as boolean;
            const bitis = new Date(row.original.bitisTarihi);
            const kalanGun = differenceInDays(bitis, new Date());

            if (!aktif) return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">Geçmiş Poliçe</Badge>;

            if (kalanGun < 0) return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-none font-bold px-2">Poliçe Süresi Doldu!</Badge>;
            if (kalanGun <= 15) return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-0 shadow-none font-bold px-2">Kritik ({kalanGun} Gün)</Badge>;
            if (kalanGun <= 30) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 shadow-none font-bold px-2">Yaklaşıyor ({kalanGun} Gün)</Badge>;
            return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 shadow-none font-semibold px-2">Geçerli</Badge>;
        },
    },
    {
        accessorKey: "arac_plaka",
        header: "Araç",
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
        accessorKey: "sirket",
        header: "Sigorta Şirketi",
        cell: ({ row }) => {
            const sirket = row.getValue("sirket") as string;
            return <div className="font-bold text-slate-800">{sirket || <span className="italic text-slate-400 font-normal">Belirtilmedi</span>}</div>
        },
    },
    {
        accessorKey: "policeNo",
        header: "Poliçe / Belge No",
        cell: ({ row }) => {
            const p = row.getValue("policeNo") as string;
            return <div className="text-slate-600 font-mono text-sm">{p || '-'}</div>
        },
    },
    {
        accessorKey: "bitisTarihi",
        header: "Son Geçerlilik",
        cell: ({ row }) => {
            return <div className="font-bold text-slate-900">{formatDate(row.getValue("bitisTarihi"))}</div>
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Prim Tutarı</div>,
        cell: ({ row }) => {
            const tutar = row.original.tutar;
            return tutar
                ? <div className="text-right font-black text-slate-900">₺{tutar.toLocaleString('tr-TR')}</div>
                : <div className="text-right italic text-slate-400 font-normal">-</div>
        },
    },
]
