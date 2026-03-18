"use client"

import React, { useState } from "react";
import { updateUserStatus } from "./actions";
import { toast } from "sonner";
import { Check, X, Building2, Mail, ShieldCheck } from "lucide-react";
import type { OnayDurumu, Rol } from "@prisma/client";
import ExcelTransferToolbar from "@/components/ui/excel-transfer-toolbar";

type OnayKullanici = {
    id: string;
    ad: string;
    soyad: string;
    eposta?: string | null;
    rol: Rol;
    sirket?: { ad: string } | null;
};

export default function OnayMerkeziClient({ initialUsers }: { initialUsers: OnayKullanici[] }) {
    const [loading, setLoading] = useState<string | null>(null);

    const handleUpdate = async (userId: string, status: OnayDurumu, role?: Rol) => {
        setLoading(userId);
        const res = await updateUserStatus(userId, status, role);
        if (res.success) {
            toast.success(status === "ONAYLANDI" ? "Kullanıcı onaylandı." : "Talep reddedildi.");
        } else {
            toast.error(res.error || "Hata oluştu.");
        }
        setLoading(null);
    };

    return (
        <div className="p-8 xl:p-12 max-w-[1400px] mx-auto">
            <header className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                        <ShieldCheck className="text-indigo-600" size={32} /> Onay Merkezi
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">Sisteme yeni kayıt olan kullanıcıların taleplerini yönetin.</p>
                </div>
                <ExcelTransferToolbar options={[{ entity: "personel", label: "Personel" }]} />
            </header>

            <div className="grid grid-cols-1 gap-6">
                {initialUsers.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
                        <p className="text-slate-400 font-bold text-lg">Bekleyen onay talebi bulunmuyor.</p>
                    </div>
                ) : (
                    initialUsers.map((u) => (
                        <div key={u.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-all hover:shadow-md hover:border-indigo-100">
                            <div className="flex items-center gap-5">
                                <div className="h-16 w-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 text-xl font-bold uppercase shrink-0">
                                    {u.ad[0]}{u.soyad[0]}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{u.ad} {u.soyad}</h3>
                                    <div className="flex flex-wrap items-center gap-4 mt-1 text-sm font-medium text-slate-500">
                                        <div className="flex items-center gap-1.5"><Mail size={14}/> {u.eposta}</div>
                                        <div className="flex items-center gap-1.5"><Building2 size={14}/> {u.sirket?.ad || "Bilinmeyen Şirket"}</div>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold uppercase tracking-wider">
                                            Talep: {u.rol}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 lg:border-l lg:pl-8 border-slate-100">
                                <div className="flex flex-col gap-1.5 mr-4">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Rol Ata</span>
                                    <select 
                                        defaultValue={u.rol}
                                        id={`role-${u.id}`}
                                        className="h-10 px-3 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                                    >
                                        <option value="SOFOR">Şoför</option>
                                        <option value="MUHASEBECI">Muhasebeci</option>
                                        <option value="MUDUR">Müdür</option>
                                        <option value="YONETICI">Yönetici</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button 
                                        disabled={loading === u.id}
                                        onClick={() => {
                                            const role = (document.getElementById(`role-${u.id}`) as HTMLSelectElement).value as Rol;
                                            handleUpdate(u.id, "ONAYLANDI", role);
                                        }}
                                        className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <Check size={18} /> Onayla
                                    </button>
                                    <button 
                                        disabled={loading === u.id}
                                        onClick={() => handleUpdate(u.id, "REDDEDILDI")}
                                        className="h-12 w-12 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl font-bold transition-all flex items-center justify-center border border-rose-100 disabled:opacity-50"
                                        title="Reddet"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
