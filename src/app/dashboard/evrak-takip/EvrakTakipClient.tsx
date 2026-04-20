"use client"

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import ReportExportToolbar from "@/components/ui/report-export-toolbar";
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { DEADLINE_STATUS_CLASS, getDeadlineLabel, type DeadlineStatus } from "@/lib/deadline-status";
import { useDashboardScopedHref } from "@/lib/use-dashboard-scoped-href";

type EvrakRow = {
    id: string;
    aracId: string;
    plaka: string;
    marka: string;
    sirketAd?: string | null;
    tur: string;
    gecerlilikTarihi: Date;
    kalanGun: number;
    durum: DeadlineStatus;
};

function getDurumBadge(durum: DeadlineStatus, kalanGun: number) {
    const label = getDeadlineLabel(durum, kalanGun);
    const className = DEADLINE_STATUS_CLASS[durum];

    switch (durum) {
        case "GECIKTI":
            return <Badge className={className}><ShieldAlert size={12} className="mr-1" />{label}</Badge>;
        case "YUKSEK":
        case "KRITIK":
            return <Badge className={className}><AlertTriangle size={12} className="mr-1" />{label}</Badge>;
        case "YAKLASTI":
            return <Badge className={className}><Clock size={12} className="mr-1" />{label}</Badge>;
        case "GECERLI":
        default:
            return <Badge className={className}><CheckCircle2 size={12} className="mr-1" />{label}</Badge>;
    }
}

function getColumns(showCompanyInfo: boolean): ColumnDef<EvrakRow>[] {
    return [
        {
            accessorKey: "durum",
            header: "Mevcut Durum",
            cell: ({ row }) => getDurumBadge(row.original.durum, row.original.kalanGun),
        },
        {
            accessorKey: "plaka",
            header: "Araç",
            cell: ({ row }) => (
                <VehicleIdentityCell
                    aracId={row.original.aracId}
                    plaka={row.original.plaka}
                    subtitle={row.original.marka}
                    companyName={row.original.sirketAd || null}
                    showCompanyInfo={showCompanyInfo}
                />
            ),
        },
        {
            accessorKey: "tur",
            header: "Evrak Türü",
            cell: ({ row }) => <span className="font-semibold text-slate-700">{row.original.tur}</span>,
        },
        {
            accessorKey: "gecerlilikTarihi",
            header: "Geçerlilik Tarihi",
            cell: ({ row }) => (
                <span className="font-medium text-slate-700">
                    {new Date(row.original.gecerlilikTarihi).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                    })}
                </span>
            ),
        },
        {
            accessorKey: "kalanGun",
            header: () => <div className="text-right">Kalan Gün</div>,
            cell: ({ row }) => {
                const value = row.original.kalanGun;
                if (value < 0) {
                    return (
                        <div className="text-right">
                            <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">
                                {Math.abs(value)} Gün Geçti
                            </span>
                        </div>
                    );
                }
                return (
                    <div className="text-right">
                        <span className={`font-mono text-sm font-bold ${value <= 15 ? "text-rose-600" : value <= 30 ? "text-amber-600" : "text-slate-700"}`}>
                            {value}
                        </span>
                    </div>
                );
            },
        },
    ];
}

export default function EvrakTakipClient({ initialEvraklar }: { initialEvraklar: EvrakRow[] }) {
    const router = useRouter();
    const scopedHref = useDashboardScopedHref();
    const { canAccessAllCompanies } = useDashboardScope();
    const columns = useMemo(() => getColumns(canAccessAllCompanies), [canAccessAllCompanies]);

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Evrak Takibi</h2>
                    <p className="text-slate-500 text-sm mt-1">Muayene, kasko ve trafik poliçesi bitiş sürelerini izleyin.</p>
                </div>
            </header>

            <DataTable
                columns={columns}
                data={initialEvraklar}
                toolbarRight={(
                    <ReportExportToolbar report="document-expirations" className="w-full sm:w-auto" />
                )}
                onRowClick={(row) => router.push(scopedHref(`/dashboard/araclar/${row.aracId}`))}
            />
        </div>
    );
}
