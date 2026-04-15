"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"
import { PersonelLink } from "@/components/links/RecordLinks"
import { ESKI_PERSONEL_ETIKETI, getActivePersonelId, getPersonelDisplayName } from "@/lib/personel-display"
import { ArrowRightLeft, PackageCheck } from "lucide-react"

export type YakitRow = {
    id: string;
    tarih: Date;
    litre: number;
    tutar: number;
    km: number;
    istasyon: string | null;
    odemeYontemi: 'NAKIT' | 'TASIT_TANIMA';
    soforId?: string | null;
    sofor?: {
        id: string;
        ad: string;
        soyad: string;
        deletedAt?: string | Date | null;
        calistigiKurum?: string | null;
        sirket?: { ad: string } | null;
    } | null;
    odendiMi: boolean;
    endeks?: number | null;
    kullanici?: { id: string; ad: string; soyad: string; deletedAt?: string | Date | null } | null;
    arac: { 
        id: string; 
        plaka: string; 
        marka: string; 
        model: string;
        calistigiKurum?: string | null;
        sirket?: { ad: string } | null;
        kullanici?: { id: string; ad: string; soyad: string; deletedAt?: string | Date | null } | null;
    };
    ortalamaYakit100Km?: number | null;
    ortalamaKmBasiMaliyet?: number | null;
    ortalamaYakitDistanceKm?: number | null;
    isStokHareketi?: boolean;
}

const formatDate = (date: string | Date | null | undefined) => date ? format(new Date(date), "dd.MM.yyyy", { locale: tr }) : '-';

export const getColumns = (showCompanyInfo = false): ColumnDef<YakitRow>[] => {
    void showCompanyInfo;
    const columns: ColumnDef<YakitRow>[] = [
        {
            accessorKey: "tarih",
            header: "Tarih",
            cell: ({ row }) => {
                return <div className="text-slate-700 font-medium">{formatDate(row.getValue("tarih"))}</div>
            },
        },
        {
            accessorKey: "arac_plaka",
            header: "Araç Plakası",
            accessorFn: (row) => row.arac.plaka,
            cell: ({ row }) => {
                const { arac, isStokHareketi } = row.original;
                if (isStokHareketi) {
                    const isTransfer = arac.plaka === "BİDON DOLUMU";
                    return (
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${isTransfer ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {isTransfer ? <ArrowRightLeft size={16} /> : <PackageCheck size={16} />}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900 leading-none">{arac.plaka}</p>
                                <p className="text-[10px] font-semibold text-slate-500 mt-0.5 uppercase tracking-wider">Dahili Hareket</p>
                            </div>
                        </div>
                    );
                }
                return (
                    <VehicleIdentityCell
                        aracId={arac.id}
                        plaka={arac.plaka}
                        subtitle={`${arac.marka} ${arac.model}`}
                        showCompanyInfo={false}
                    />
                )
            },
        },
        {
            accessorKey: "endeks",
            header: "Endeks",
            cell: ({ row }) => {
                const val = row.original.endeks;
                if (val === undefined || val === null) return <span className="text-sm text-slate-400">-</span>;
                return <div className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 w-fit">{val.toLocaleString('tr-TR')}</div>
            },
        },
        {
            accessorKey: "yakitAlanPersonel",
            header: "Yakıt Alan Personel",
            accessorFn: (row) => {
                const selectedSofor = row.sofor || row.kullanici || row.arac.kullanici || null;
                return selectedSofor ? getPersonelDisplayName(selectedSofor) : (row.soforId ? ESKI_PERSONEL_ETIKETI : "-");
            },
            cell: ({ row }) => {
                const { arac, kullanici, sofor } = row.original;
                const selectedSofor = sofor || kullanici || arac.kullanici || null;
                const soforText = selectedSofor
                    ? getPersonelDisplayName(selectedSofor)
                    : (row.original.soforId ? ESKI_PERSONEL_ETIKETI : null);
                const soforId = getActivePersonelId(selectedSofor);
                if (row.original.isStokHareketi) {
                    return <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">SİSTEM</span>;
                }
                if (!soforText) {
                    return <span className="text-sm text-slate-400">-</span>;
                }
                return (
                    <PersonelLink
                        personelId={soforId}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                        {soforText}
                    </PersonelLink>
                );
            },
        },
        {
            accessorKey: "km",
            header: "KM/Saat",
            cell: ({ row }) => {
                if (row.original.isStokHareketi) return <div className="text-slate-300 italic">-</div>;
                return <div className="text-slate-600 font-medium">{row.original.km.toLocaleString('tr-TR')} km/saat</div>
            },
        },
        {
            accessorKey: "litre",
            header: "Alınan Litre",
            cell: ({ row }) => {
                return <div className="font-medium text-slate-700">{row.original.litre.toFixed(2)} L</div>
            },
        },
        {
            accessorKey: "istasyon",
            header: "Yakıt Çıkışı",
            cell: ({ row }) => {
                const istasyon = row.getValue("istasyon") as string;
                return (
                    <div className="font-medium text-slate-700">
                        {istasyon || <span className="italic text-slate-400 font-normal">Belirtilmedi</span>}
                    </div>
                );
            },
        },
    ];

    return columns;
};
