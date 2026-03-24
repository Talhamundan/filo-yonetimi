"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Building2 } from "lucide-react"

export type SirketRow = {
    id: string;
    ad: string;
    bulunduguIl: string;
    vergiNo: string;
    aracSayisi: number;
    personelSayisi: number;
    toplamMaliyet: number;
    maliyetKalemleri: { key: string; label: string; tutar: number }[];
    olusturmaTarihi: string;
}

const KALEM_RENKLERI: Record<string, string> = {
    yakit: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bakim: "bg-amber-50 text-amber-700 border-amber-200",
    muayene: "bg-sky-50 text-sky-700 border-sky-200",
    hgs: "bg-violet-50 text-violet-700 border-violet-200",
    ceza: "bg-rose-50 text-rose-700 border-rose-200",
    kasko: "bg-indigo-50 text-indigo-700 border-indigo-200",
    trafik: "bg-cyan-50 text-cyan-700 border-cyan-200",
    diger: "bg-slate-50 text-slate-700 border-slate-200",
};

export const columns: ColumnDef<SirketRow>[] = [
    {
        accessorKey: "ad",
        header: "Şirket Adı",
        cell: ({ row }) => {
            return (
                <div className="flex items-center gap-3 pl-2">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <Building2 size={16} className="text-indigo-600" />
                    </div>
                    <span className="font-semibold text-slate-900">{row.getValue("ad")}</span>
                </div>
            )
        }
    },
    {
        accessorKey: "bulunduguIl",
        header: "Şehir",
    },
    {
        accessorKey: "vergiNo",
        header: "Vergi No",
        cell: ({ row }) => <span className="font-mono text-slate-600">{row.getValue("vergiNo")}</span>
    },
    {
        accessorKey: "aracSayisi",
        header: "Kayıtlı Araç",
        cell: ({ row }) => <span className="font-medium text-slate-700">{row.getValue("aracSayisi")} Araç</span>
    },
    {
        accessorKey: "personelSayisi",
        header: "Kayıtlı Personel",
        cell: ({ row }) => <span className="font-medium text-slate-700">{row.getValue("personelSayisi")} Kişi</span>
    },
    {
        accessorKey: "toplamMaliyet",
        header: () => <div className="text-right">Toplam Maliyet</div>,
        cell: ({ row }) => {
            const kalemler = row.original.maliyetKalemleri || [];
            return (
                <div className="text-right">
                    <div className="font-black text-rose-600">
                        ₺{Number(row.getValue("toplamMaliyet") || 0).toLocaleString("tr-TR")}
                    </div>
                    {kalemler.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                            {kalemler.map((kalem) => (
                                <span
                                    key={`${row.original.id}-${kalem.key}`}
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${KALEM_RENKLERI[kalem.key] || KALEM_RENKLERI.diger}`}
                                >
                                    {kalem.label}: ₺{kalem.tutar.toLocaleString("tr-TR")}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-1 text-[11px] italic text-slate-400">Kayıt yok</div>
                    )}
                </div>
            );
        },
    },
]
