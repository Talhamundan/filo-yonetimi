"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell";
import { PersonelLink } from "@/components/links/RecordLinks";
import { getDeadlineBadgeConfig, getDaysLeft } from "@/lib/deadline-status";

export type CezaMasrafRow = {
    id: string;
    aracId: string;
    plaka: string;
    aracMarka: string;
    aracModel: string;
    sirketAd?: string | null;
    soforId: string | null;
    soforAdSoyad: string;
    tarih: string | Date | null;
    sonOdemeTarihi: string | Date | null;
    cezaMaddesi: string;
    aciklama?: string | null;
    tutar: number;
    odendiMi: boolean;
    km: number | null;
};

const formatDate = (date: string | Date | null | undefined) =>
    date ? format(new Date(date), "dd.MM.yyyy HH:mm", { locale: tr }) : "-";

export const getColumns = (showCompanyInfo = false): ColumnDef<CezaMasrafRow>[] => {
    const columns: ColumnDef<CezaMasrafRow>[] = [
    {
        accessorKey: "arac_plaka",
        header: "Arac",
        accessorFn: (row) => row.plaka,
        cell: ({ row }) => (
            <VehicleIdentityCell
                aracId={row.original.aracId}
                plaka={row.original.plaka}
                subtitle={`${row.original.aracMarka || "-"} ${row.original.aracModel || ""}`.trim()}
                companyName={row.original.sirketAd}
                showCompanyInfo={showCompanyInfo}
            />
        ),
    },
    {
        accessorKey: "soforAdSoyad",
        header: "Sofor",
        cell: ({ row }) => (
            <PersonelLink
                personelId={row.original.soforId}
                className="text-slate-700 font-medium hover:text-indigo-600 hover:underline"
            >
                {row.original.soforAdSoyad || "-"}
            </PersonelLink>
        ),
    },
    {
        accessorKey: "cezaMaddesi",
        header: "Ceza Maddesi",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="text-slate-800 font-semibold">{row.original.cezaMaddesi || "-"}</span>
                {row.original.aciklama ? (
                    <span className="text-[11px] text-slate-500 mt-0.5">{row.original.aciklama}</span>
                ) : null}
            </div>
        ),
    },
    {
        accessorKey: "tarih",
        header: "Ceza Tarihi",
        cell: ({ row }) => (
            <div className="text-slate-700 font-medium">{formatDate(row.original.tarih)}</div>
        ),
    },
    {
        accessorKey: "sonOdemeTarihi",
        header: "Son Odeme",
        cell: ({ row }) => (
            <div className="text-slate-600">
                {row.original.sonOdemeTarihi ? formatDate(row.original.sonOdemeTarihi) : "-"}
            </div>
        ),
    },
    {
        accessorKey: "odendiMi",
        header: "Durum",
        cell: ({ row }) => {
            const data = row.original;

            if (data.odendiMi) {
                return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 shadow-none font-semibold px-2">Ödendi</Badge>;
            }

            const daysLeft = getDaysLeft(data.sonOdemeTarihi);
            if (daysLeft != null) {
                const badge = getDeadlineBadgeConfig(daysLeft);
                if (badge.status === "GECERLI") {
                    return (
                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">
                            Ödenmedi
                        </Badge>
                    );
                }
                return (
                    <Badge className={`${badge.className} ${badge.status === "GECIKTI" ? "font-bold" : "font-semibold"} px-2`}>
                        {badge.status === "GECIKTI" ? (
                            <>
                                <ShieldAlert size={12} className="mr-1" />
                                {badge.label}
                            </>
                        ) : (
                            badge.label
                        )}
                    </Badge>
                );
            }

            return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 shadow-none font-semibold px-2">Ödenmedi</Badge>;
        },
    },
    {
        accessorKey: "tutar",
        header: () => <div className="text-right">Tutar</div>,
        cell: ({ row }) => (
            <div className="text-right font-black text-rose-600">
                ₺{(row.original.tutar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </div>
        ),
    },
    ];

    return columns;
};
