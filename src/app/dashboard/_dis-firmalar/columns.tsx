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
    toplamMaliyet: number;
    maliyetKalemleri: { key: string; label: string; tutar: number }[];
    calistigiSirketler: { id: string; ad: string }[];
};

const KALEM_RENKLERI: Record<string, string> = {
    yakit: "bg-emerald-50 text-emerald-700 border-emerald-200",
    servis: "bg-amber-50 text-amber-700 border-amber-200",
};

function formatCurrency(value: number) {
    return `₺${Math.round(value || 0).toLocaleString("tr-TR")}`;
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
            <Link href={getVendorScopedHref("/dashboard/araclar", row.original)} className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
                {row.original.aracSayisi} Araç
            </Link>
        ),
    },
    {
        accessorKey: "personelSayisi",
        header: "Kayıtlı Personel",
        cell: ({ row }) => (
            <Link href={getVendorScopedHref("/dashboard/personel", row.original)} className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
                {row.original.personelSayisi} Kişi
            </Link>
        ),
    },
    {
        accessorKey: "toplamMaliyet",
        header: () => <div className="text-right">Toplam Maliyet</div>,
        cell: ({ row }) => {
            const kalemler = row.original.maliyetKalemleri || [];
            return (
                <div className="text-right">
                    <div className="font-black text-rose-600">{formatCurrency(row.original.toplamMaliyet)}</div>
                    {kalemler.length ? (
                        <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                            {kalemler.map((kalem) => (
                                <span key={`${row.original.id}-${kalem.key}`} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${KALEM_RENKLERI[kalem.key] || KALEM_RENKLERI.servis}`}>
                                    {kalem.label}: {formatCurrency(kalem.tutar)}
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
];
