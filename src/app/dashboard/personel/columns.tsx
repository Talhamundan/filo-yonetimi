"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Shield, User, Briefcase, Truck, Wrench } from "lucide-react"
import { AracLink, PersonelLink } from "@/components/links/RecordLinks"
import { getRoleLabel } from "@/lib/role-label"
import VehicleIdentityCell from "@/components/vehicle/VehicleIdentityCell"

export type PersonelRow = {
    id: string;
    adSoyad: string;
    tcNo?: string;
    telefon: string;
    girisAdi: string;
    rol: string;
    sirketAdi: string;
    sirketId?: string;
    disFirmaId?: string;
    disFirmaAdi?: string;
    calistigiKurum: string;
    zimmetliArac: string | null;
    zimmetliAracPlaka?: string | null;
    zimmetliAracMarkaModel?: string | null;
    zimmetliAracId?: string | null;
    maliyetKalemleri?: {
        ceza: number;
        yakit: number;
    };
    toplamMaliyet?: number;
    ortalamaYakit100Km?: number | null;
    ortalamaYakitIntervalSayisi?: number;
    yakitKarsilastirmaReferans100Km?: number | null;
    ortalamaUstuYakit?: boolean;
}

function formatCurrency(value: number) {
    return `₺${Math.round(value || 0).toLocaleString("tr-TR")}`;
}

function formatDecimal(value: number, fractionDigits = 2) {
    return value.toLocaleString("tr-TR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

const RoleIcon = ({ rol }: { rol: string }) => {
    switch (rol) {
        case 'ADMIN': return <Shield size={14} className="text-red-600" />;
        case 'YETKILI': return <Briefcase size={14} className="text-indigo-600" />;
        case 'TEKNIK': return <Wrench size={14} className="text-emerald-600" />;
        case 'PERSONEL': return <Truck size={14} className="text-amber-600" />;
        default: return <User size={14} />
    }
}

const baseColumns: ColumnDef<PersonelRow>[] = [
    {
        accessorKey: "adSoyad",
        header: "Ad Soyad",
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-full">
                    <User size={16} className="text-slate-600" />
                </div>
                <PersonelLink personelId={row.original.id} className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline">
                    {row.getValue("adSoyad")}
                </PersonelLink>
            </div>
        )
    },
    { accessorKey: "sirketAdi", header: "Çalıştığı Firma", cell: ({ row }) => <span className="font-medium text-slate-700">{row.getValue("sirketAdi")}</span> },
    { accessorKey: "calistigiKurum", header: "Çalıştığı Kurum", cell: ({ row }) => <span className="text-slate-500">{row.getValue("calistigiKurum")}</span> },
    {
        accessorFn: (row) => getRoleLabel(row.rol),
        id: "rol",
        header: "Rol",
        cell: ({ row }) => {
            const role = row.original.rol;
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 flex items-center gap-1.5 w-max">
                    <RoleIcon rol={role} />
                    {getRoleLabel(role)}
                </span>
            )
        }
    },
    { 
        accessorKey: "zimmetliArac", 
        header: "Zimmetli Araç", 
        cell: ({ row }) => {
            const plaka = row.original.zimmetliAracPlaka;
            const markaModel = row.original.zimmetliAracMarkaModel;
            const sirket = row.original.sirketAdi;
            const id = row.original.zimmetliAracId;

            if (!plaka) return <span className="text-slate-400 italic text-xs">Zimmet yok</span>;

            return (
                <VehicleIdentityCell
                    aracId={id}
                    plaka={plaka}
                    subtitle={markaModel}
                    companyName={sirket}
                    showCompanyInfo={true}
                />
            );
        }
    },
    { accessorKey: "telefon", header: "Telefon", cell: ({ row }) => <span className="text-slate-500">{row.getValue("telefon")}</span> },
];

const maliyetColumn: ColumnDef<PersonelRow> = {
    accessorKey: "toplamMaliyet",
    header: "Maliyet Özeti",
    cell: ({ row }) => {
        const toplam = row.original.toplamMaliyet || 0;
        const kalemler = row.original.maliyetKalemleri || { ceza: 0, yakit: 0 };
        const nonZero = [
            { key: "Ceza", value: kalemler.ceza, className: "bg-rose-50 text-rose-700 border-rose-200" },
            { key: "Yakıt", value: kalemler.yakit, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        ].filter((item) => item.value > 0);

        return (
            <div className="min-w-[180px]">
                <div className="text-sm font-bold text-slate-900">{formatCurrency(toplam)}</div>
                {nonZero.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {nonZero.map((item) => (
                            <span
                                key={item.key}
                                className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${item.className}`}
                            >
                                {item.key}: {formatCurrency(item.value)}
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-slate-400 italic text-xs">Kayıt yok</span>
                )}
            </div>
        );
    },
};

const yakitOrtalamaColumn: ColumnDef<PersonelRow> = {
    accessorKey: "ortalamaYakit100Km",
    header: "Ortalama Yakıt",
    cell: ({ row }) => {
        const litre100 = row.original.ortalamaYakit100Km;
        const intervalSayisi = row.original.ortalamaYakitIntervalSayisi || 0;
        const referans = Number(row.original.yakitKarsilastirmaReferans100Km || 0);
        const ortalamaUstuYakit = Boolean(row.original.ortalamaUstuYakit);

        if (litre100 == null || intervalSayisi <= 0) {
            return <span className="text-slate-400 italic text-xs">Yetersiz veri</span>;
        }

        return (
            <div className="min-w-[170px]">
                <div className="text-sm font-semibold text-slate-800">{formatDecimal(litre100)} L/100 km</div>
                <div className="text-[11px] text-slate-400">{intervalSayisi} dolum aralığı</div>
                {referans > 0 ? (
                    <div className="text-[11px] text-slate-500">İş makinesi ort: {formatDecimal(referans)} L/100 km</div>
                ) : null}
                {ortalamaUstuYakit ? (
                    <span className="mt-1 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        Ortalama Üstü
                    </span>
                ) : null}
            </div>
        );
    },
};

export const getColumns = (isTeknik = false): ColumnDef<PersonelRow>[] =>
    isTeknik ? [...baseColumns, yakitOrtalamaColumn] : [...baseColumns, yakitOrtalamaColumn, maliyetColumn];
