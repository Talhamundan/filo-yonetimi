"use client"

import React from "react";
import { Input } from "../../../components/ui/input";

export const ROLLER = ['ADMIN', 'YONETICI', 'MUDUR', 'MUHASEBECI', 'SOFOR'];
export const ILLER = ['İSTANBUL', 'BURSA', 'ŞANLIURFA', 'ANKARA', 'DİĞER'];

export const FormFields = ({ formData, setFormData, sirketler }: { formData: any, setFormData: any, sirketler: any[] }) => (
    <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Ad <span className="text-red-500">*</span></label>
                <Input value={formData.ad} onChange={e => setFormData({...formData, ad: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Soyad <span className="text-red-500">*</span></label>
                <Input value={formData.soyad} onChange={e => setFormData({...formData, soyad: e.target.value})} className="h-9" />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">E-Posta</label>
            <Input type="email" value={formData.eposta} onChange={e => setFormData({...formData, eposta: e.target.value})} className="h-9" />
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
                <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                    {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Bağlı Şirket</label>
                <select value={formData.sirketId} onChange={e => setFormData({...formData, sirketId: e.target.value})}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value="">Bağımsız (Yok)</option>
                    {sirketler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Şehir</label>
                <select value={formData.sehir} onChange={e => setFormData({...formData, sehir: e.target.value})}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                    <option value="">Seçiniz</option>
                    {ILLER.map(il => <option key={il} value={il}>{il}</option>)}
                </select>
            </div>
        </div>
    </div>
);
