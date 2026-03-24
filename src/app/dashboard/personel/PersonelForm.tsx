"use client"

import React from "react";
import { Input } from "../../../components/ui/input";
import type { Rol, iller } from "@prisma/client";

export type PersonelFormData = {
    ad: string;
    soyad: string;
    telefon: string;
    rol: Rol;
    sirketId: string;
    sehir: iller | "";
    tcNo: string;
};

export const ROLLER: Rol[] = ['ADMIN', 'YETKILI', 'TEKNIK', 'SOFOR'];
export const ILLER = [
    { value: 'ISTANBUL', label: 'İSTANBUL' },
    { value: 'BURSA', label: 'BURSA' },
    { value: 'SANLIURFA', label: 'ŞANLIURFA' },
    { value: 'ANKARA', label: 'ANKARA' },
    { value: 'DIGER', label: 'DİĞER' }
];
const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");

export const FormFields = ({
    formData,
    setFormData,
    sirketler,
    allowAdminRole = false,
    allowIndependentOption = true,
}: {
    formData: PersonelFormData,
    setFormData: React.Dispatch<React.SetStateAction<PersonelFormData>>,
    sirketler: { id: string; ad: string; bulunduguIl?: string }[],
    allowAdminRole?: boolean,
    allowIndependentOption?: boolean,
}) => {
    const baseRoleOptions = allowAdminRole ? ROLLER : ROLLER.filter((item) => item !== "ADMIN");
    const roleOptions = baseRoleOptions.includes(formData.rol)
        ? baseRoleOptions
        : [formData.rol, ...baseRoleOptions];

    return (
    <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Ad <span className="text-red-500">*</span></label>
                <Input
                    value={formData.ad}
                    onChange={e => setFormData({...formData, ad: forceUppercase(e.target.value)})}
                    className="h-9 uppercase"
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Soyad <span className="text-red-500">*</span></label>
                <Input
                    value={formData.soyad}
                    onChange={e => setFormData({...formData, soyad: forceUppercase(e.target.value)})}
                    className="h-9 uppercase"
                />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Telefon</label>
            <Input value={formData.telefon} onChange={e => setFormData({...formData, telefon: e.target.value})} placeholder="0532 xxx xx xx" className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">TC Kimlik No</label>
                <Input value={formData.tcNo} onChange={e => setFormData({...formData, tcNo: e.target.value})} placeholder="11 haneli TC No" className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Rol</label>
                <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value as Rol})}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                    {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Bağlı Şirket</label>
                <select value={formData.sirketId} onChange={e => {
                    const nextSirketId = e.target.value;
                    const selectedSirket = sirketler.find((s) => s.id === nextSirketId);
                    setFormData({
                        ...formData,
                        sirketId: nextSirketId,
                        sehir: (selectedSirket?.bulunduguIl as iller | undefined) || formData.sehir
                    });
                }}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                    {allowIndependentOption ? (
                        <option value="">Bağımsız (Yok)</option>
                    ) : (
                        <option value="" disabled>
                            Şirket Seçiniz
                        </option>
                    )}
                    {sirketler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Şehir</label>
                <select value={formData.sehir} onChange={e => setFormData({...formData, sehir: e.target.value as iller | ""})}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value="">Seçiniz</option>
                    {ILLER.map(il => <option key={il.value} value={il.value}>{il.label}</option>)}
                </select>
            </div>
        </div>
    </div>
    );
};
