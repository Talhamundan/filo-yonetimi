"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell";
import { PersonelLink } from "@/components/links/RecordLinks";

export type ArizaRow = {
    id: string;
    aciklama: string;
    oncelik: "DUSUK" | "ORTA" | "YUKSEK" | "KRITIK";
    durum: "ACIK" | "SERVISTE" | "TAMAMLANDI" | "IPTAL";
    km: number | null;
    servisAdi: string | null;
    yapilanIslemler: string | null;
    tutar: number;
    bildirimTarihi: Date;
    serviseSevkTarihi: Date | null;
    kapanisTarihi: Date | null;
    bakimId: string | null;
    soforId?: string | null;
    sofor?: {
        id: string;
        ad: string;
        soyad: string;
    } | null;
    arac: {
        id: string;
        plaka: string;
        marka: string;
        model: string;
        sirket?: { ad: string } | null;
    };
};

const formatDate = (date: string | Date | null | undefined) =>
    date ? format(new Date(date), "dd.MM.yyyy HH:mm", { locale: tr }) : "-";

function renderDurumBadge(durum: ArizaRow["durum"]) {
    switch (durum) {
        case "ACIK":
            return <Badge className="bg-rose-100 text-rose-700 border-0 shadow-none font-semibold">Açık</Badge>;
        case "SERVISTE":
            return <Badge className="bg-amber-100 text-amber-700 border-0 shadow-none font-semibold">Serviste</Badge>;
        case "TAMAMLANDI":
            return <Badge className="bg-emerald-100 text-emerald-700 border-0 shadow-none font-semibold">Tamamlandı</Badge>;
        case "IPTAL":
            return <Badge className="bg-slate-200 text-slate-700 border-0 shadow-none font-semibold">İptal</Badge>;
        default:
            return <Badge variant="outline">{durum}</Badge>;
    }
}

function renderOncelikBadge(oncelik: ArizaRow["oncelik"]) {
    switch (oncelik) {
        case "KRITIK":
            return <Badge className="bg-orange-100 text-orange-700 border-0 shadow-none font-semibold">Yüksek</Badge>;
        case "YUKSEK":
            return <Badge className="bg-orange-100 text-orange-700 border-0 shadow-none font-semibold">Yüksek</Badge>;
        case "ORTA":
            return <Badge className="bg-blue-100 text-blue-700 border-0 shadow-none font-semibold">Orta</Badge>;
        case "DUSUK":
            return <Badge className="bg-slate-100 text-slate-600 border-0 shadow-none font-semibold">Düşük</Badge>;
        default:
            return <Badge variant="outline">{oncelik}</Badge>;
    }
}

export const getColumns = (showCompanyInfo = false): ColumnDef<ArizaRow>[] => [
    {
        accessorKey: "durum",
        header: "Durum",
        cell: ({ row }) => renderDurumBadge(row.original.durum),
    },
    {
        accessorKey: "bildirimTarihi",
        header: "Bildirim Tarihi",
        cell: ({ row }) => <div className="text-slate-700 font-medium">{formatDate(row.original.bildirimTarihi)}</div>,
    },
    {
        accessorKey: "arac_plaka",
        header: "Araç",
        accessorFn: (row) => row.arac.plaka,
        cell: ({ row }) => (
            <VehicleIdentityCell
                aracId={row.original.arac.id}
                plaka={row.original.arac.plaka}
                subtitle={`${row.original.arac.marka} ${row.original.arac.model}`}
                companyName={row.original.arac.sirket?.ad}
                showCompanyInfo={showCompanyInfo}
            />
        ),
    },
    {
        accessorKey: "oncelik",
        header: "Öncelik",
        cell: ({ row }) => renderOncelikBadge(row.original.oncelik),
    },
    {
        accessorKey: "sofor",
        header: "Personel",
        cell: ({ row }) => {
            const sofor = row.original.sofor;
            if (!sofor) {
                return <div className="text-slate-400 text-xs italic">Belirtilmemiş</div>;
            }
            return (
                <PersonelLink personelId={sofor.id} className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline">
                    {`${sofor.ad} ${sofor.soyad}`.trim()}
                </PersonelLink>
            );
        },
    },
    {
        accessorKey: "aciklama",
        header: "Arıza Açıklaması",
        cell: ({ row }) => (
            <div className="max-w-[280px] truncate text-slate-700 font-medium" title={row.original.aciklama}>
                {row.original.aciklama}
            </div>
        ),
    },
    {
        accessorKey: "km",
        header: "KM",
        cell: ({ row }) => {
            const km = row.original.km;
            return <div className="text-slate-600 font-medium">{km != null ? `${km.toLocaleString("tr-TR")} km` : "-"}</div>;
        },
    },
    {
        accessorKey: "servisAdi",
        header: "Servis",
        cell: ({ row }) => <div className="font-semibold text-slate-800">{row.original.servisAdi || "-"}</div>,
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Tutar</div>,
        cell: ({ row }) => (
            <div className="text-right font-bold text-slate-900">
                ₺{row.original.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </div>
        ),
    },
];
