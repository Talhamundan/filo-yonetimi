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
    olusturmaTarihi: string;
}

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
]
