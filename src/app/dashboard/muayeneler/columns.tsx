"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"
import { getDeadlineBadgeConfig, getDaysLeft } from "@/lib/deadline-status"

export type MuayeneRow = {
    id: string;
    muayeneTarihi: Date;
    gecerlilikTarihi: Date;
    tutar: number | null;
    gectiMi: boolean;
    km: number | null;
    aktifMi: boolean;
    arac: { id: string; plaka: string; marka: string; model: string; sirket?: { ad: string } | null };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd.MM.yyyy HH:mm", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<MuayeneRow>[] => [
    {
        accessorKey: "aktifMi",
        header: "Durum",
        cell: ({ row }) => {
            const aktif = row.getValue("aktifMi") as boolean;
            const gectiMi = row.original.gectiMi;
            const kalanGun = getDaysLeft(row.original.gecerlilikTarihi);

            if (!aktif) return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">Geçmiş Kayıt</Badge>;
            if (!gectiMi) return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-none font-bold px-2">Muayene Geçmedi</Badge>;
            if (kalanGun == null) return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">Belirsiz</Badge>;

            if (kalanGun < 0) {
                const badge = getDeadlineBadgeConfig(kalanGun);
                return <Badge className={`${badge.className} font-bold px-2`}>{badge.label}</Badge>;
            }

            const badge = getDeadlineBadgeConfig(kalanGun);
            return <Badge className={`${badge.className} ${badge.status === "GECERLI" ? "font-semibold" : "font-bold"} px-2`}>{badge.label}</Badge>;
        },
    },
    {
        accessorKey: "arac_plaka",
        header: "Araç",
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
        accessorKey: "muayeneTarihi",
        header: "Son Muayene",
        cell: ({ row }) => {
            return <div className="text-slate-600 font-medium">{formatDate(row.getValue("muayeneTarihi"))}</div>
        },
    },
    {
        accessorKey: "gecerlilikTarihi",
        header: "Geçerlilik Bitiş",
        cell: ({ row }) => {
            return <div className="font-bold text-slate-900">{formatDate(row.getValue("gecerlilikTarihi"))}</div>
        },
    },
    {
        accessorKey: "gectiMi",
        header: "Sonuç",
        cell: ({ row }) => {
            return row.original.gectiMi
                ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 shadow-none font-semibold px-2">Geçti</Badge>
                : <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-none font-semibold px-2">Geçmedi</Badge>
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Muayene Ücreti</div>,
        cell: ({ row }) => {
            const tutar = row.original.tutar;
            return (
                <div className="text-right font-semibold text-slate-800">
                    {tutar ? `₺${tutar.toLocaleString("tr-TR")}` : '-'}
                </div>
            )
        },
    },
    {
        accessorKey: "km",
        header: "İşlem KM",
        cell: ({ row }) => {
            const km = row.original.km;
            return <div className="text-slate-600 font-medium">{km ? `${km.toLocaleString("tr-TR")} km` : '-'}</div>;
        },
    },
]
