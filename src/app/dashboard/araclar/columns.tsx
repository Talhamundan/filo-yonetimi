"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { differenceInDays } from "date-fns"

export type AracRow = {
    id: string;
    plaka: string;
    marka: string;
    model: string;
    yil: number;
    bulunduguIl: string;
    guncelKm: number;
    durum: string;
    kategori: string;
    hgsNo?: string | null;
    kullanici?: { ad: string, soyad: string } | null;
    kullaniciId?: string | null;
    sirket?: { ad: string } | null;
    muayene?: { gecerlilikTarihi: Date }[];
    kasko?: { bitisTarihi: Date }[];
}

export const columns: ColumnDef<AracRow>[] = [
    {
        accessorKey: "durum",
        header: "Durum",
        cell: ({ row }) => {
            const durum = row.original.durum;
            const hasDriver = !!row.original.kullanici;

            // Eğer durum AKTIF ise ama şoför yoksa BOŞTA göster
            if (durum === 'AKTIF' || durum === 'BOSTA') {
                return hasDriver ? 
                    <Badge className="bg-emerald-500 text-white font-semibold px-2.5 py-0.5 border-0 shadow-sm">Aktif</Badge> :
                    <Badge className="bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 border-0 shadow-sm">Boşta</Badge>;
            }

            switch (durum) {
                case 'SERVISTE': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 font-semibold px-2.5 py-0.5 border-0 shadow-none">Serviste</Badge>;
                case 'YEDEK': return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold px-2.5 py-0.5 border-0 shadow-none">Yedek</Badge>;
                case 'ARIZALI': return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 font-semibold px-2.5 py-0.5 border-0 shadow-none">Arızalı</Badge>;
                default: return <Badge variant="outline" className="font-semibold px-2.5 py-0.5 shadow-none">{durum}</Badge>;
            }
        },
    },
    {
        accessorKey: "plaka",
        header: "Plaka",
        cell: ({ row }) => {
            return <div className="font-mono font-bold text-slate-900 border border-slate-200 bg-slate-50 px-2.5 py-1 rounded-md inline-block shadow-sm tracking-wide">{row.getValue("plaka")}</div>
        },
    },
    {
        accessorKey: "kategori",
        header: "Kategori",
        cell: ({ row }) => {
            const cat = row.original.kategori;
            const labels: any = { 'IS_MAKINESI': 'İş Makinesi', 'KAMYON_TIR': 'Kamyon/Tır', 'BINEK': 'Binek' };
            return <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{labels[cat] || cat}</span>;
        }
    },
    {
        accessorKey: "marka",
        header: "Marka / Model",
        cell: ({ row }) => {
            return (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{row.original.marka} {row.original.model}</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                        {row.original.sirket?.ad ? `${row.original.sirket.ad} • ` : ''}{row.original.yil} • {row.original.bulunduguIl}
                    </span>
                </div>
            )
        },
    },
    {
        accessorKey: "guncelKm",
        header: "KM",
        cell: ({ row }) => {
            const km = parseFloat(row.getValue("guncelKm"))
            return <div className="font-medium text-slate-700">{km.toLocaleString('tr-TR')}</div>
        },
    },
    {
        accessorKey: "sofor_ad", // TanStack table mapping accessor
        header: "Şoför",
        accessorFn: (row) => row.kullanici ? `${row.kullanici.ad} ${row.kullanici.soyad}` : "Atanmamış",
        cell: ({ row }) => {
            const kullanici = row.original.kullanici
            return kullanici ? (
                <span className="font-medium text-slate-700">{kullanici.ad} {kullanici.soyad}</span>
            ) : (
                <span className="text-slate-400 italic text-xs">Atanmamış</span>
            )
        },
    },
    {
        accessorKey: "hgsNo",
        header: "HGS No",
        cell: ({ row }) => {
            return <div className="font-mono text-xs text-slate-600">{row.getValue("hgsNo") || '-'}</div>
        },
    },
    {
        accessorKey: "kasko",
        header: "Kasko",
        cell: ({ row }) => {
            const kaskoList = row.original.kasko;
            if (!kaskoList || kaskoList.length === 0) return <span className="text-slate-400 text-xs italic">Yok</span>;

            const kalan = differenceInDays(new Date(kaskoList[0].bitisTarihi), new Date());

            if (kalan < 0) return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-sm px-2 py-0.5 text-[10px]">Gecikti</Badge>;
            if (kalan <= 15) return <Badge className="bg-red-500 text-white hover:bg-red-600 border-0 shadow-sm px-2 py-0.5 text-[10px]">{kalan} Gün (Kritik)</Badge>;
            if (kalan <= 30) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 shadow-sm px-2 py-0.5 text-[10px]">{kalan} Gün</Badge>;
            return <span className="text-emerald-600 font-semibold text-xs">{kalan} Gün</span>;
        },
    },
]
