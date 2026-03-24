"use client"

import { ColumnDef } from "@tanstack/react-table"
import { AracLink, PersonelLink } from "@/components/links/RecordLinks"

export type CezaRow = {
    id: string;
    aracId: string;
    plaka: string;
    soforId: string | null;
    soforAdSoyad: string;
    tarih: string;
    cezaMaddesi: string;
    aciklama?: string | null;
    tutar: number;
}

export const getColumns = (): ColumnDef<CezaRow>[] => {
    const columns: ColumnDef<CezaRow>[] = [
    {
        accessorKey: "plaka",
        header: "Plaka",
        cell: ({ row }) => (
            <AracLink
                aracId={row.original.aracId}
                className="font-bold text-slate-900 font-mono hover:text-indigo-600 hover:underline"
            >
                {row.original.plaka}
            </AracLink>
        )
    },
    {
        accessorKey: "soforAdSoyad",
        header: "Şoför (Ad Soyad)",
        cell: ({ row }) => (
            <PersonelLink
                personelId={row.original.soforId}
                className="text-slate-700 font-medium hover:text-indigo-600 hover:underline"
            >
                {row.original.soforAdSoyad || "-"}
            </PersonelLink>
        )
    },
    {
        accessorKey: "tarih",
        header: "Ceza Tarihi",
        cell: ({ row }) => new Date(row.original.tarih).toLocaleDateString("tr-TR")
    },
    {
        accessorKey: "cezaMaddesi",
        header: "Ceza Maddesi",
        cell: ({ row }) => <span className="text-slate-700">{row.original.cezaMaddesi}</span>
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right font-semibold">Tutar (₺)</div>,
        cell: ({ row }) => (
            <div className="text-right font-black text-rose-600">
                ₺{row.original.tutar.toLocaleString("tr-TR")}
            </div>
        )
    },
    ];

    return columns;
};
