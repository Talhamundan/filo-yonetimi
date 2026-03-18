"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"
import { getDeadlineBadgeConfig, getDaysLeft } from "@/lib/deadline-status"

export type KaskoRow = {
    id: string;
    sirket: string | null;
    acente: string | null;
    policeNo: string | null;
    baslangicTarihi: Date;
    bitisTarihi: Date;
    tutar: number | null;
    aktifMi: boolean;
    arac: { id: string; plaka: string; marka: string; model: string; sirket?: { ad: string } | null };
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd MMM yyyy", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<KaskoRow>[] => [
    {
        accessorKey: "aktifMi",
        header: "Mevcut Durum",
        cell: ({ row }) => {
            const aktif = row.getValue("aktifMi") as boolean;
            const kalanGun = getDaysLeft(row.original.bitisTarihi);

            if (!aktif) {
                return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">Geçmiş Kayıt</Badge>;
            }

            if (kalanGun == null) {
                return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">Belirsiz</Badge>;
            }

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
        accessorKey: "sirket",
        header: "Sigorta Şirketi / Acente",
        cell: ({ row }) => {
            const sirket = row.getValue("sirket") as string;
            return (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{sirket || <span className="italic text-slate-400 font-normal">Belirtilmedi</span>}</span>
                    <span className="text-xs text-slate-500">{row.original.acente || '-'}</span>
                </div>
            );
        },
    },
    {
        accessorKey: "policeNo",
        header: "Poliçe / Belge No",
        cell: ({ row }) => {
            const p = row.getValue("policeNo") as string;
            return <div className="text-slate-600 font-mono text-sm">{p || '-'}</div>
        },
    },
    {
        accessorKey: "bitisTarihi",
        header: "Kasko Bitiş Tarihi",
        cell: ({ row }) => {
            return <div className="font-bold text-slate-900">{formatDate(row.getValue("bitisTarihi"))}</div>
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Prim Tutarı (₺)</div>,
        cell: ({ row }) => {
            const tutar = row.original.tutar;
            return tutar
                ? <div className="text-right font-black text-slate-900">₺{tutar.toLocaleString('tr-TR')}</div>
                : <div className="text-right italic text-slate-400 font-normal">-</div>
        },
    },
]
