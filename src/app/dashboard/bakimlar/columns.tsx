"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"

export type BakimRow = {
    id: string;
    bakimTarihi: Date;
    plaka?: string | null;
    arizaSikayet?: string | null;
    degisenParca?: string | null;
    islemYapanFirma?: string | null;
    servisAdi: string | null;
    yapilanIslemler: string | null;
    tutar: number;
    kategori?: "PERIYODIK_BAKIM" | "ARIZA";
    tur?: string;
    arac?: {
        id: string;
        plaka: string | null;
        marka: string;
        model: string;
        sirket?: { ad: string } | null;
        kullanici?: { id: string; ad: string; soyad: string; deletedAt?: string | Date | null } | null;
    } | null;
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd.MM.yyyy HH:mm", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<BakimRow>[] => {
    const columns: ColumnDef<BakimRow>[] = [
    {
        accessorKey: "bakimTarihi",
        header: "Tarih",
        cell: ({ row }) => {
            return <div className="text-slate-700 font-medium">{formatDate(row.original.bakimTarihi)}</div>
        },
    },
    {
        accessorKey: "arac_plaka",
        header: "Plaka",
        accessorFn: (row) => row.arac?.plaka || row.plaka || "-",
        cell: ({ row }) => {
            const plaka = row.original.arac?.plaka || row.original.plaka || "-";
            const subtitle = row.original.arac
                ? `${row.original.arac.marka} ${row.original.arac.model}`.trim()
                : "Araç kaydı yok";
            return <VehicleIdentityCell
                aracId={row.original.arac?.id}
                plaka={plaka}
                subtitle={subtitle}
                companyName={row.original.arac?.sirket?.ad}
                showCompanyInfo={showCompanyInfo}
            />
        },
    },
    {
        accessorKey: "arizaSikayet",
        header: "Arıza Şikayet",
        cell: ({ row }) => {
            return <div className="text-slate-700 max-w-[260px] truncate" title={row.original.arizaSikayet || ""}>{row.original.arizaSikayet || '-'}</div>
        },
    },
    {
        accessorKey: "yapilanIslemler",
        header: "Yapılan İşlem",
        cell: ({ row }) => {
            const islem = row.original.yapilanIslemler;
            return <div className="text-slate-600 max-w-[250px] truncate" title={islem || ''}>{islem || '-'}</div>
        },
    },
    {
        accessorKey: "degisenParca",
        header: "Değişen Parça",
        cell: ({ row }) => {
            return <div className="text-slate-700 max-w-[220px] truncate" title={row.original.degisenParca || ""}>{row.original.degisenParca || '-'}</div>
        },
    },
    {
        accessorKey: "islemYapanFirma",
        header: "İşlem Yapan Firma",
        cell: ({ row }) => {
            const firma = row.original.islemYapanFirma || row.original.servisAdi;
            return <div className="font-semibold text-slate-800 max-w-[220px] truncate" title={firma || ""}>{firma || '-'}</div>;
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Masraf Tutarı</div>,
        cell: ({ row }) => {
            return <div className="text-right font-bold text-slate-900">₺{row.original.tutar.toLocaleString('tr-TR')}</div>
        },
    },
    ];

    return columns;
};
