"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Building2, Truck } from "lucide-react";
import type { DisFirmaTuruValue } from "./schema";

export type DisFirmaRow = {
    id: string;
    ad: string;
    tur: DisFirmaTuruValue;
    sehir: string;
    vergiNo: string;
    yetkiliKisi: string;
    telefon: string;
    calistigiKurum: string;
    aracSayisi: number;
    personelSayisi: number;
    toplamYakitLitre: number;
    yakitKayitSayisi: number;
    calistigiSirketler: { id: string; ad: string }[];
};

function formatLitres(value: number) {
    return `${(value || 0).toLocaleString("tr-TR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })} L`;
}

function getVendorScopedHref(basePath: string, row: DisFirmaRow) {
    const params = new URLSearchParams();
    params.set("externalMode", row.tur);
    params.set("disFirmaId", row.id);
    return `${basePath}?${params.toString()}`;
}

export const columns: ColumnDef<DisFirmaRow>[] = [
    {
        accessorKey: "ad",
        header: "Firma Adı",
        cell: ({ row }) => {
            const Icon = row.original.tur === "KIRALIK" ? Truck : Building2;
            return (
                <div className="flex items-center gap-3 pl-2">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <Icon size={16} className="text-indigo-600" />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{row.original.ad}</div>
                        <div className="text-[11px] font-medium text-slate-400">{row.original.yetkiliKisi}</div>
                    </div>
                </div>
            );
        },
    },
    {
        id: "calistigiSirketler",
        header: "Çalıştığı Kurum",
        accessorFn: (row) => row.calistigiKurum || row.calistigiSirketler.map((sirket) => sirket.ad).join(" ") || "-",
        cell: ({ row }) => {
            if (row.original.calistigiKurum) {
                return <span className="font-medium text-slate-700">{row.original.calistigiKurum}</span>;
            }
            const sirketler = row.original.calistigiSirketler;
            if (!sirketler.length) {
                return <span className="text-xs italic text-slate-400">Eşleşme yok</span>;
            }
            return (
                <div className="flex max-w-[260px] flex-wrap gap-1.5">
                    {sirketler.slice(0, 3).map((sirket) => (
                        <span key={sirket.id} className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            {sirket.ad}
                        </span>
                    ))}
                    {sirketler.length > 3 ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            +{sirketler.length - 3}
                        </span>
                    ) : null}
                </div>
            );
        },
    },
    { accessorKey: "sehir", header: "Şehir" },
    {
        accessorKey: "vergiNo",
        header: "Vergi No",
        cell: ({ row }) => <span className="font-mono text-slate-600">{row.original.vergiNo}</span>,
    },
    {
        accessorKey: "aracSayisi",
        header: "Kayıtlı Araç",
        cell: ({ row }) => (
            <Link href={`${getVendorScopedHref("/dashboard/kiraliklar", row.original)}#kiralik-arac-listesi`} className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
                {row.original.aracSayisi} Araç
            </Link>
        ),
    },
    {
        accessorKey: "personelSayisi",
        header: "Kayıtlı Personel",
        cell: ({ row }) => (
            <Link href={`${getVendorScopedHref("/dashboard/kiraliklar", row.original)}#kiralik-personel-listesi`} className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
                {row.original.personelSayisi} Kişi
            </Link>
        ),
    },
    {
        accessorKey: "toplamYakitLitre",
        header: () => <div className="text-right">Toplam Yakıt</div>,
        cell: ({ row }) => {
            const toplamLitre = row.original.toplamYakitLitre || 0;
            const kayitSayisi = row.original.yakitKayitSayisi || 0;
            return (
                <div className="text-right">
                    <div className="font-black text-emerald-600">{formatLitres(toplamLitre)}</div>
                    <div className="mt-1 text-[11px] italic text-slate-400">
                        {kayitSayisi > 0 ? `${kayitSayisi} dolum kaydı` : "Kayıt yok"}
                    </div>
                </div>
            );
        },
    },
];
