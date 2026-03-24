"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Fuel } from "lucide-react"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"
import { PersonelLink } from "@/components/links/RecordLinks"
import { ESKI_PERSONEL_ETIKETI, getActivePersonelId, getPersonelDisplayName } from "@/lib/personel-display"

export type YakitRow = {
    id: string;
    tarih: Date;
    litre: number;
    tutar: number;
    km: number;
    istasyon: string | null;
    odemeYontemi: 'NAKIT' | 'TASIT_TANIMA';
    soforId?: string | null;
    sofor?: { id: string; ad: string; soyad: string; deletedAt?: string | Date | null } | null;
    kullanici?: { id: string; ad: string; soyad: string; deletedAt?: string | Date | null } | null;
    arac: { 
        id: string; 
        plaka: string; 
        marka: string; 
        model: string;
        sirket?: { ad: string } | null;
        kullanici?: { id: string; ad: string; soyad: string; deletedAt?: string | Date | null } | null;
    };
    ortalamaYakit100Km?: number | null;
    ortalamaKmBasiMaliyet?: number | null;
    ortalamaYakitDistanceKm?: number | null;
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy HH:mm", { locale: tr }) : '-';
const formatDecimal = (value: number, fractionDigits = 2) =>
    value.toLocaleString("tr-TR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });

export const getColumns = (showCompanyInfo = false): ColumnDef<YakitRow>[] => {
    const columns: ColumnDef<YakitRow>[] = [
    {
        accessorKey: "arac_plaka",
        header: "Araç",
        accessorFn: (row) => row.arac.plaka,
        cell: ({ row }) => {
            const { arac, kullanici, sofor } = row.original;
            const selectedSofor = sofor || kullanici || arac.kullanici || null;
            const soforText = selectedSofor
                ? getPersonelDisplayName(selectedSofor)
                : (row.original.soforId ? ESKI_PERSONEL_ETIKETI : null);
            const soforId = getActivePersonelId(selectedSofor);
            return (
                <VehicleIdentityCell
                    aracId={arac.id}
                    plaka={arac.plaka}
                    subtitle={`${arac.marka} ${arac.model}`}
                    companyName={arac.sirket?.ad}
                    showCompanyInfo={showCompanyInfo}
                    extra={soforText ? (
                        <PersonelLink
                            personelId={soforId}
                            className="text-[11px] text-indigo-500 font-semibold mt-0.5 hover:underline"
                        >
                            👤 {soforText}
                        </PersonelLink>
                    ) : null}
                />
            )
        },
    },
    {
        accessorKey: "tarih",
        header: "Alım Tarihi & Saati",
        cell: ({ row }) => {
            return <div className="text-slate-700 font-medium">{formatDate(row.getValue("tarih"))}</div>
        },
    },
    {
        accessorKey: "istasyon",
        header: "İstasyon",
        cell: ({ row }) => {
            const istasyon = row.getValue("istasyon") as string;
            return <div className="font-semibold text-slate-800 flex items-center gap-2">
                <Fuel size={14} className="text-slate-400" />
                {istasyon || <span className="italic text-slate-400 font-normal">Belirtilmedi</span>}
            </div>
        },
    },
    {
        accessorKey: "km",
        header: "Alım Anındaki KM",
        cell: ({ row }) => {
            return <div className="text-slate-600 font-medium">{row.original.km.toLocaleString('tr-TR')} km</div>
        },
    },
    {
        accessorKey: "litre",
        header: () => <div className="text-right">Miktar (Litre)</div>,
        cell: ({ row }) => {
            return <div className="text-right font-medium text-slate-700">{row.original.litre.toFixed(2)} L</div>
        },
    },
    {
        accessorKey: "ortalamaYakit100Km",
        header: "Ortalama Yakıt",
        cell: ({ row }) => {
            const tuketim = row.original.ortalamaYakit100Km;
            const kmBasiMaliyet = row.original.ortalamaKmBasiMaliyet;
            const aralikKm = row.original.ortalamaYakitDistanceKm;

            if (tuketim == null || kmBasiMaliyet == null) {
                return <span className="text-slate-400 italic text-xs">Yetersiz veri</span>;
            }

            return (
                <div className="min-w-[150px]">
                    <div className="text-xs font-semibold text-slate-800">{formatDecimal(tuketim)} L/100 km</div>
                    <div className="text-xs text-slate-500">₺{formatDecimal(kmBasiMaliyet)} / km</div>
                    {aralikKm && aralikKm > 0 ? (
                        <div className="text-[11px] text-slate-400">{Math.round(aralikKm).toLocaleString("tr-TR")} km aralık</div>
                    ) : null}
                </div>
            );
        },
    },
    {
        accessorKey: "odemeYontemi",
        header: "Ödeme Şekli",
        cell: ({ row }) => {
            const val = row.original.odemeYontemi;
            return val === 'TASIT_TANIMA'
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">🚗 Taşıt Tanıma</span>
                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">💵 Nakit</span>;
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right font-semibold">Tutar</div>,
        cell: ({ row }) => {
            return <div className="text-right font-black text-rose-600">₺{row.original.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
        },
    },
    ];

    return columns;
};
