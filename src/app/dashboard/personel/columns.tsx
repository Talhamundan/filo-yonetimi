"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Shield, User, Briefcase, Calculator, Truck } from "lucide-react"

export type PersonelRow = {
    id: string;
    adSoyad: string;
    tcNo?: string;
    telefon: string;
    eposta: string;
    rol: string;
    sirketAdi: string;
    sirketId?: string;
    sehir: string;
    zimmetliArac: string | null;
}

const RoleIcon = ({ rol }: { rol: string }) => {
    switch (rol) {
        case 'ADMIN': return <Shield size={14} className="text-red-600" />;
        case 'YONETICI': return <Briefcase size={14} className="text-indigo-600" />;
        case 'MUDUR': return <User size={14} className="text-blue-600" />;
        case 'MUHASEBECI': return <Calculator size={14} className="text-emerald-600" />;
        case 'SOFOR': return <Truck size={14} className="text-amber-600" />;
        default: return <User size={14} />
    }
}

export const columns: ColumnDef<PersonelRow>[] = [
    {
        accessorKey: "adSoyad",
        header: "Ad Soyad",
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-full">
                    <User size={16} className="text-slate-600" />
                </div>
                <span className="font-semibold text-slate-900">{row.getValue("adSoyad")}</span>
            </div>
        )
    },
    {
        accessorKey: "rol",
        header: "Rol",
        cell: ({ row }) => {
            const role = row.getValue("rol") as string;
            return (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 flex items-center gap-1.5 w-max">
                    <RoleIcon rol={role} />
                    {role}
                </span>
            )
        }
    },
    { accessorKey: "sirketAdi", header: "Bağlı Şirket", cell: ({ row }) => <span className="font-medium text-slate-700">{row.getValue("sirketAdi")}</span> },
    { accessorKey: "sehir", header: "Şehir", cell: ({ row }) => <span className="text-slate-500">{row.getValue("sehir")}</span> },
    { 
        accessorKey: "zimmetliArac", 
        header: "Zimmetli Araç", 
        cell: ({ row }) => {
            const arac = row.getValue("zimmetliArac") as string | null;
            return arac ? (
                <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-200">{arac}</span>
            ) : (
                <span className="text-slate-400 italic text-xs">Zimmet yok</span>
            );
        }
    },
    { accessorKey: "eposta", header: "E-Posta", cell: ({ row }) => <span className="text-slate-500">{row.getValue("eposta")}</span> },
    { accessorKey: "telefon", header: "Telefon", cell: ({ row }) => <span className="text-slate-500">{row.getValue("telefon")}</span> }
]
