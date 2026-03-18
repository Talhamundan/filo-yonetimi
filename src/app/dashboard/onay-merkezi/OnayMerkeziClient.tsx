"use client"

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { updateUserStatus } from "./actions";
import { toast } from "sonner";
import { Check, X, Building2, Mail, ShieldCheck, History, Trash2 } from "lucide-react";
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

type DeletedDataStats = {
    total: number;
    pendingPermanentDelete: number;
    oldestDeletedAt: string | null;
    byEntity: {
        arac: number;
        masraf: number;
        bakim: number;
        dokuman: number;
        ceza: number;
        kullanici: number;
    };
};

export default function OnayMerkeziClient({
    initialUsers,
    deletedStats,
}: {
    initialUsers: OnayKullanici[];
    deletedStats: DeletedDataStats;
}) {
    const [loading, setLoading] = useState<string | null>(null);
    const searchParams = useSearchParams();

    const scopedQuery = new URLSearchParams();
    ["yil", "ay", "sirket"].forEach((key) => {
        const value = searchParams.get(key);
        if (value) scopedQuery.set(key, value);
    });
    const withScope = (path: string) => {
        const query = scopedQuery.toString();
        return query ? `${path}?${query}` : path;
    };
    const oldestDeletedText = deletedStats.oldestDeletedAt
        ? new Date(deletedStats.oldestDeletedAt).toLocaleDateString("tr-TR")
        : "-";

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
            <div className="mb-6 flex flex-wrap items-center gap-2">
                <Link
                    href={withScope("/dashboard/aktivite-gecmisi")}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                    <History size={15} />
                    Aktivite Geçmişi
                </Link>
                <Link
                    href={withScope("/dashboard/cop-kutusu")}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                    <Trash2 size={15} />
                    Silinen Veriler
                </Link>
            </div>
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Silinen Veriler Özeti</h2>
                        <p className="mt-1 text-sm text-slate-600">
                            Çöp kutusundaki toplam kayıt: <span className="font-semibold text-slate-900">{deletedStats.total}</span>
                        </p>
                        <p className="text-sm text-slate-600">
                            30+ gün dolduğu için kalıcı silinmeye aday kayıt:{" "}
                            <span className="font-semibold text-amber-700">{deletedStats.pendingPermanentDelete}</span>
                        </p>
                        <p className="text-xs text-slate-500">En eski silinme tarihi: {oldestDeletedText}</p>
                    </div>
                    <Link
                        href={withScope("/dashboard/cop-kutusu")}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                    >
                        <Trash2 size={15} />
                        Çöp Kutusunu Yönet
                    </Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Araç</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.arac}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Masraf</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.masraf}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Bakım</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.bakim}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Doküman</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.dokuman}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Ceza</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.ceza}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
                        <p className="text-slate-500">Kullanıcı</p>
                        <p className="text-sm font-semibold text-slate-900">{deletedStats.byEntity.kullanici}</p>
                    </div>
                </div>
            </div>

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
                                        <option value="YETKILI">Yetkili</option>
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
