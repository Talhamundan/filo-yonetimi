"use client"

import React from "react";
import { Input } from "../../../components/ui/input";
import type { Rol } from "@prisma/client";
import { getRoleLabel } from "@/lib/role-label";
import type { ExternalVendorMode } from "@/lib/external-vendor-mode";

export type PersonelFormData = {
    ad: string;
    soyad: string;
    telefon: string;
    rol: Rol;
    sirketId: string;
    disFirmaId?: string;
    calistigiKurum: string;
    santiye: string;
    tcNo: string;
};

export const ROLLER: Rol[] = ['ADMIN', 'YETKILI', 'TEKNIK', 'PERSONEL'];
const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");

export const FormFields = ({
    formData,
    setFormData,
    sirketler,
    disFirmalar = [],
    allowAdminRole = false,
    allowIndependentOption = true,
    isExternalMode = false,
    externalMode = null,
}: {
    formData: PersonelFormData,
    setFormData: React.Dispatch<React.SetStateAction<PersonelFormData>>,
    sirketler: { id: string; ad: string; bulunduguIl?: string; santiyeler?: string[] }[],
    disFirmalar?: { id: string; ad: string; tur: string }[],
    allowAdminRole?: boolean,
    allowIndependentOption?: boolean,
    isExternalMode?: boolean,
    externalMode?: ExternalVendorMode | null,
}) => {
    const baseRoleOptions = allowAdminRole ? ROLLER : ROLLER.filter((item) => item !== "ADMIN");
    const roleOptions = baseRoleOptions.includes(formData.rol)
        ? baseRoleOptions
        : [formData.rol, ...baseRoleOptions];
    const selectedSirket = sirketler.find((item) => item.id === formData.sirketId);
    const santiyeOptions = (selectedSirket?.santiyeler || []).filter((item) => String(item || "").trim().length > 0);
    const santiyeListId = formData.sirketId ? `personel-santiye-${formData.sirketId}` : "personel-santiye-generic";

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
                    {roleOptions.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                </select>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Bağlı Şirket</label>
                <select value={formData.sirketId} onChange={e => {
                    const nextSirketId = e.target.value;
                    const selectedSirket = sirketler.find((s) => s.id === nextSirketId);
                    const nextSantiyeler = (selectedSirket?.santiyeler || []).filter((item) => String(item || "").trim().length > 0);
                    setFormData({
                        ...formData,
                        sirketId: nextSirketId,
                        calistigiKurum:
                            formData.calistigiKurum.trim().length > 0
                                ? formData.calistigiKurum
                                : (selectedSirket?.ad || ""),
                        santiye: formData.santiye.trim().length > 0 ? formData.santiye : (nextSantiyeler[0] || ""),
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
                <label className="text-sm font-medium">Çalıştığı Kurum</label>
                <Input
                    value={formData.calistigiKurum}
                    onChange={(e) => setFormData({ ...formData, calistigiKurum: forceUppercase(e.target.value) })}
                    placeholder="Örn: ARAT / ÖZEL"
                    className="h-9 uppercase"
                />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Bulunduğu Şantiye</label>
            <Input
                value={formData.santiye}
                onChange={(e) => setFormData({ ...formData, santiye: forceUppercase(e.target.value) })}
                list={santiyeListId}
                placeholder={santiyeOptions.length > 0 ? "Şantiye seçin veya yazın" : "Şantiye adı yazın"}
                className="h-9 uppercase"
            />
            <datalist id={santiyeListId}>
                {santiyeOptions.map((santiye) => (
                    <option key={santiye} value={santiye} />
                ))}
            </datalist>
        </div>
        {isExternalMode && (
            <div className="space-y-1.5">
                <label className="text-sm font-medium">
                    {externalMode === "KIRALIK" ? "Kiralık Firma" : externalMode === "TASERON" ? "Taşeron Firma" : "Dış Firma"}
                </label>
                <select
                    value={formData.disFirmaId || ""}
                    onChange={e => setFormData({ ...formData, disFirmaId: e.target.value })}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    <option value="">Firma seçiniz</option>
                    {disFirmalar.map((firma) => (
                        <option key={firma.id} value={firma.id}>
                            {firma.ad} ({firma.tur === "KIRALIK" ? "Kiralık" : "Taşeron"})
                        </option>
                    ))}
                </select>
            </div>
        )}
    </div>
    );
};
