"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"
import { PersonelLink } from "@/components/links/RecordLinks"
import { ESKI_PERSONEL_ETIKETI, getActivePersonelId, getPersonelDisplayName } from "@/lib/personel-display"

export type BakimRow = {
    id: string;
    bakimTarihi: Date;
    yapilanKm: number;
    sonrakiBakimKm: number | null;
    servisAdi: string | null;
    yapilanIslemler: string | null;
    tutar: number;
    kategori?: "PERIYODIK_BAKIM" | "ARIZA";
    tur?: string;
    soforId?: string | null;
    sofor?: { id: string; ad: string; soyad: string; deletedAt?: string | Date | null } | null;
    arac: {
        id: string;
        plaka: string;
        marka: string;
        model: string;
        sirket?: { ad: string } | null;
        kullanici?: { id: string; ad: string; soyad: string; deletedAt?: string | Date | null } | null;
    };
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
        header: "Araç",
        accessorFn: (row) => row.arac.plaka,
        cell: ({ row }) => {
            const seciliPersonel = row.original.sofor || row.original.arac.kullanici || null;
            const personelText = seciliPersonel
                ? getPersonelDisplayName(seciliPersonel)
                : (row.original.soforId ? ESKI_PERSONEL_ETIKETI : null);
            const personelId = getActivePersonelId(seciliPersonel);
            return <VehicleIdentityCell
                aracId={row.original.arac.id}
                plaka={row.original.arac.plaka}
                subtitle={`${row.original.arac.marka} ${row.original.arac.model}`}
                companyName={row.original.arac.sirket?.ad}
                showCompanyInfo={showCompanyInfo}
                extra={personelText ? (
                    <PersonelLink
                        personelId={personelId}
                        className="text-[11px] text-indigo-500 font-semibold mt-0.5 hover:underline"
                    >
                        👤 {personelText}
                    </PersonelLink>
                ) : null}
            />
        },
    },
    {
        accessorKey: "kategori",
        header: "Kategori",
        cell: ({ row }) => {
            const kategori = row.original.kategori || (row.original.tur === "ARIZA" ? "ARIZA" : "PERIYODIK_BAKIM");
            if (kategori === "ARIZA") {
                return <Badge className="bg-rose-100 text-rose-700 border-0 shadow-none font-semibold">Arıza</Badge>;
            }
            return <Badge className="bg-emerald-100 text-emerald-700 border-0 shadow-none font-semibold">Periyodik Bakım</Badge>;
        },
    },
    {
        accessorKey: "servisAdi",
        header: "Servis Adı",
        cell: ({ row }) => {
            return <div className="font-bold text-slate-800">{row.getValue("servisAdi") || '-'}</div>
        },
    },
    {
        accessorKey: "islem",
        header: "Yapılan İşlemler",
        cell: ({ row }) => {
            const islem = row.original.yapilanIslemler;
            return <div className="text-slate-600 max-w-[250px] truncate" title={islem || ''}>{islem || '-'}</div>
        },
    },
    {
        accessorKey: "yapilanKm",
        header: "İşlem KM",
        cell: ({ row }) => {
            return <div className="text-slate-700 font-medium">{row.original.yapilanKm.toLocaleString()} km</div>
        },
    },
    {
        accessorKey: "sonrakiBakimKm",
        header: "Sonraki Bakım KM",
        cell: ({ row }) => {
            const snr = row.original.sonrakiBakimKm;
            return snr
                ? <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 shadow-none font-bold">{snr.toLocaleString()} km</Badge>
                : <span className="text-slate-400 italic text-xs">Belirtilmemiş</span>;
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Tutar</div>,
        cell: ({ row }) => {
            return <div className="text-right font-bold text-slate-900">₺{row.original.tutar.toLocaleString('tr-TR')}</div>
        },
    },
    ];

    return columns;
};
