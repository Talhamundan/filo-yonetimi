"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "../../../components/ui/badge"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"
import { getDeadlineBadgeConfig, getDaysLeft } from "@/lib/deadline-status"

export type MuayeneRow = {
    id: string;
    gecerlilikTarihi: Date;
    arac: {
        id: string;
        plaka: string;
        marka: string;
        model: string;
        kullaniciFirmaAd?: string | null;
    };
}

const formatDate = (date: string | Date | null | undefined) =>
    date ? format(new Date(date), "dd.MM.yyyy", { locale: tr }) : "-";

const getSortableDaysLeft = (date: string | Date | null | undefined) => {
    const daysLeft = getDaysLeft(date);
    return daysLeft == null ? Number.POSITIVE_INFINITY : daysLeft;
};

export const getColumns = (showCompanyInfo = false): ColumnDef<MuayeneRow>[] => [
    {
        accessorKey: "kalanGun",
        accessorFn: (row) => getSortableDaysLeft(row.gecerlilikTarihi),
        header: "Kalan Gün",
        sortingFn: (rowA, rowB) => {
            const a = Number(rowA.getValue("kalanGun"));
            const b = Number(rowB.getValue("kalanGun"));
            return a - b;
        },
        cell: ({ row }) => {
            const kalanGun = getDaysLeft(row.original.gecerlilikTarihi);
            if (kalanGun == null) {
                return (
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">
                        Belirsiz
                    </Badge>
                );
            }

            if (kalanGun < 0) {
                const badge = getDeadlineBadgeConfig(kalanGun);
                return (
                    <Badge className={`${badge.className} font-bold px-2`}>
                        {Math.abs(kalanGun)} Gün Gecikti
                    </Badge>
                );
            }

            const badge = getDeadlineBadgeConfig(kalanGun);
            return (
                <Badge className={`${badge.className} ${badge.status === "GECERLI" ? "font-semibold" : "font-bold"} px-2`}>
                    {kalanGun} Gün
                </Badge>
            );
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
                companyName={row.original.arac.kullaniciFirmaAd || null}
                showCompanyInfo={showCompanyInfo}
            />
        },
    },
    {
        accessorKey: "gecerlilikTarihi",
        header: "Geçerlilik Bitiş",
        cell: ({ row }) => {
            return <div className="font-bold text-slate-900">{formatDate(row.getValue("gecerlilikTarihi"))}</div>
        },
    },
]
