"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"
import { PersonelLink } from "@/components/links/RecordLinks"
import { getActivePersonelId, getPersonelDisplayName, isDeletedPersonel } from "@/lib/personel-display"

export type SoforZimmetRow = {
    id: string;
    baslangic: Date;
    bitis: Date | null;
    baslangicKm: number;
    bitisKm: number | null;
    notlar: string | null;
    latestYakitKm?: number | null;
    arac: { id: string; plaka: string; marka: string; model: string; sirket?: { ad: string } | null };
    kullanici: { id: string; ad: string; soyad: string; tcNo: string | null; deletedAt?: Date | string | null } | null;
    maliyetKalemleri?: {
        ceza: number;
        yakit: number;
        ariza: number;
    };
    toplamMaliyet?: number;
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd.MM.yyyy HH:mm", { locale: tr }) : '-';
const formatCurrency = (value: number) => `₺${Math.round(value || 0).toLocaleString("tr-TR")}`;

export const getColumns = (showCompanyInfo = false, isTeknik = false): ColumnDef<SoforZimmetRow>[] => {
    const columns: ColumnDef<SoforZimmetRow>[] = [
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
                    aracId={row.original.arac.id}
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
            accessorFn: (row) => row.kullanici ? getPersonelDisplayName(row.kullanici, { fallback: "Atanmamış" }) : "Atanmamış",
            cell: ({ row }) => {
                const k = row.original.kullanici;
                if (!k) return <span className="text-slate-400 italic text-xs">Atanmamış</span>;
                const deleted = isDeletedPersonel(k);
                return (
                    <div className="flex flex-col">
                        <PersonelLink personelId={getActivePersonelId(k)} className="font-bold text-slate-900 hover:text-indigo-600 hover:underline">
                            {getPersonelDisplayName(k)}
                        </PersonelLink>
                        <span className="text-xs font-medium text-slate-500 mt-0.5">TC: {deleted ? "-" : (k.tcNo || "-")}</span>
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
    ];

    if (!isTeknik) {
        columns.push({
            accessorKey: "toplamMaliyet",
            header: "Maliyet Özeti",
            cell: ({ row }) => {
                const toplam = row.original.toplamMaliyet || 0;
                const kalemler = row.original.maliyetKalemleri || { ceza: 0, yakit: 0, ariza: 0 };
                const nonZeroItems = [
                    { key: "Ceza", value: kalemler.ceza, className: "bg-rose-50 text-rose-700 border-rose-200" },
                    { key: "Yakıt", value: kalemler.yakit, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { key: "Arıza", value: kalemler.ariza, className: "bg-amber-50 text-amber-700 border-amber-200" },
                ].filter((item) => item.value > 0);

                return (
                    <div className="min-w-[180px]">
                        <div className="text-sm font-bold text-slate-900">{formatCurrency(toplam)}</div>
                        {nonZeroItems.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                                {nonZeroItems.map((item) => (
                                    <span
                                        key={item.key}
                                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${item.className}`}
                                    >
                                        {item.key}: {formatCurrency(item.value)}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-slate-400 italic text-xs">Kayıt yok</span>
                        )}
                    </div>
                );
            },
        });
    }

    return columns;
};
