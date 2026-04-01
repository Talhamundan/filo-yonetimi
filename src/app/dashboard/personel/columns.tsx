"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Shield, User, Briefcase, Truck, Wrench } from "lucide-react"
import { AracLink, PersonelLink } from "@/components/links/RecordLinks"
import { getRoleLabel } from "@/lib/role-label"

export type PersonelRow = {
    id: string;
    adSoyad: string;
    tcNo?: string;
    telefon: string;
    girisAdi: string;
    rol: string;
    sirketAdi: string;
    sirketId?: string;
    calistigiKurum: string;
    zimmetliArac: string | null;
    zimmetliAracId?: string | null;
    maliyetKalemleri?: {
        ceza: number;
        yakit: number;
        ariza: number;
    };
    toplamMaliyet?: number;
    ortalamaYakit100Km?: number | null;
    ortalamaYakitKmBasiMaliyet?: number | null;
    ortalamaYakitIntervalSayisi?: number;
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
        case 'SOFOR': return <Truck size={14} className="text-amber-600" />;
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
    { accessorKey: "sirketAdi", header: "Bağlı Şirket", cell: ({ row }) => <span className="font-medium text-slate-700">{row.getValue("sirketAdi")}</span> },
    { accessorKey: "calistigiKurum", header: "Çalıştığı Kurum", cell: ({ row }) => <span className="text-slate-500">{row.getValue("calistigiKurum")}</span> },
    { 
        accessorKey: "zimmetliArac", 
        header: "Zimmetli Araç", 
        cell: ({ row }) => {
            const arac = row.getValue("zimmetliArac") as string | null;
            return arac ? (
                <AracLink
                    aracId={row.original.zimmetliAracId}
                    className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-100"
                >
                    {arac}
                </AracLink>
            ) : (
                <span className="text-slate-400 italic text-xs">Zimmet yok</span>
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
        const kalemler = row.original.maliyetKalemleri || { ceza: 0, yakit: 0, ariza: 0 };
        const nonZero = [
            { key: "Ceza", value: kalemler.ceza, className: "bg-rose-50 text-rose-700 border-rose-200" },
            { key: "Yakıt", value: kalemler.yakit, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { key: "Arıza", value: kalemler.ariza, className: "bg-amber-50 text-amber-700 border-amber-200" },
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
        const kmBasiMaliyet = row.original.ortalamaYakitKmBasiMaliyet;
        const intervalSayisi = row.original.ortalamaYakitIntervalSayisi || 0;

        if (litre100 == null || kmBasiMaliyet == null || intervalSayisi <= 0) {
            return <span className="text-slate-400 italic text-xs">Yetersiz veri</span>;
        }

        return (
            <div className="min-w-[150px]">
                <div className="text-sm font-semibold text-slate-800">{formatDecimal(litre100)} L/100 km</div>
                <div className="text-xs text-slate-500">₺{formatDecimal(kmBasiMaliyet)} / km</div>
                <div className="text-[11px] text-slate-400">{intervalSayisi} dolum aralığı</div>
            </div>
        );
    },
};

export const getColumns = (isTeknik = false): ColumnDef<PersonelRow>[] =>
    isTeknik ? [...baseColumns, yakitOrtalamaColumn] : [...baseColumns, yakitOrtalamaColumn, maliyetColumn];
