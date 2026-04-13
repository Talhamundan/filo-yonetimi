"use client";

import React, { useState } from "react";
import { 
    ArrowLeft, 
    Calendar, 
    Car, 
    CreditCard, 
    CheckCircle2, 
    XCircle, 
    ExternalLink,
    Filter,
    Search
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DebtRecord {
    id: string;
    type: string;
    category: string;
    date: Date;
    tutar: number;
    odendiMi: boolean;
    odemeTarihi?: Date | null;
    arac?: {
        id: string;
        plaka: string;
        marka: string;
        model: string;
    } | null;
}

interface SupplierDebtDetailClientProps {
    supplierId: string;
    supplierName: string;
    initialDebts: any[];
}

export default function SupplierDebtDetailClient({ 
    supplierId, 
    supplierName, 
    initialDebts 
}: SupplierDebtDetailClientProps) {
    const [debts, setDebts] = useState<DebtRecord[]>(initialDebts);
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("unpaid");

    const filteredDebts = debts.filter(d => {
        const matchesSearch = d.arac?.plaka?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             d.category.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (filter === "unpaid") return matchesSearch && !d.odendiMi;
        if (filter === "paid") return matchesSearch && d.odendiMi;
        return matchesSearch;
    });

    const totalUnpaid = debts.filter(d => !d.odendiMi).reduce((acc, curr) => acc + curr.tutar, 0);

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-4">
                    <Link 
                        href="/dashboard/borc-takibi" 
                        className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors group"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Borç Listesine Dön
                    </Link>
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{supplierName}</h1>
                        <p className="text-slate-500 mt-2 text-lg">Bu tedarikçiye ait tüm ödeme geçmişi ve açık borçlar.</p>
                    </div>
                </div>
                
                <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 shadow-sm flex items-center gap-5">
                    <div className="h-14 w-14 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-200">
                        <CreditCard className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-rose-600/80 uppercase tracking-wider">Güncel Borç</p>
                        <p className="text-3xl font-black text-rose-700 tabular-nums">
                            {totalUnpaid.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                        </p>
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-500 hover:shadow-xl">
                <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
                    <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm self-start">
                        <button 
                            onClick={() => setFilter("all")}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                                filter === "all" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            Tümü
                        </button>
                        <button 
                            onClick={() => setFilter("unpaid")}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                                filter === "unpaid" ? "bg-rose-500 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            Ödenmemiş
                        </button>
                        <button 
                            onClick={() => setFilter("paid")}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                                filter === "paid" ? "bg-emerald-500 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            Ödenmiş
                        </button>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Plaka veya kategori ile ara..."
                            className="h-12 pl-12 bg-white border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Kayıt Türü</th>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Araç</th>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Tarih</th>
                                <th className="px-8 py-5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">Tutar</th>
                                <th className="px-8 py-5 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Durum</th>
                                <th className="px-8 py-5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredDebts.length > 0 ? (
                                filteredDebts.map((record) => (
                                    <tr key={`${record.type}-${record.id}`} className="group hover:bg-indigo-50/30 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm",
                                                    record.type === "BAKIM" ? "bg-blue-50 text-blue-600" :
                                                    record.type === "SIGORTA" || record.type === "KASKO" ? "bg-indigo-50 text-indigo-600" :
                                                    record.type === "MUAYENE" ? "bg-amber-50 text-amber-600" :
                                                    "bg-slate-50 text-slate-600"
                                                )}>
                                                    <CreditCard className="h-5 w-5" />
                                                </div>
                                                <span className="font-bold text-slate-900">{record.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {record.arac ? (
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 tracking-tight">{record.arac.plaka}</span>
                                                    <span className="text-xs font-medium text-slate-400 uppercase">{record.arac.marka} {record.arac.model}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 italic font-medium">Genel Kayıt</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center text-slate-500 font-medium">
                                                <Calendar className="h-4 w-4 mr-2 text-slate-300" />
                                                {new Date(record.date).toLocaleDateString("tr-TR")}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className={cn(
                                                "font-black text-lg tabular-nums",
                                                record.odendiMi ? "text-slate-400" : "text-rose-600"
                                            )}>
                                                {record.tutar.toLocaleString("tr-TR", { style: "currency", currency: "TRY" })}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            {record.odendiMi ? (
                                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 px-4 py-1.5 rounded-full font-bold shadow-sm whitespace-nowrap">
                                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                    ÖDENDİ
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-rose-50 text-rose-600 border-rose-100 px-4 py-1.5 rounded-full font-bold shadow-sm whitespace-nowrap animate-pulse">
                                                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                                    BEKLEYEN
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            {record.arac && (
                                                <Link 
                                                    href={`/dashboard/araclar/${record.arac.id}?tab=${record.type.toLowerCase()}`}
                                                    className="inline-flex items-center justify-center p-3 bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-slate-100 hover:border-indigo-100 shadow-sm transition-all group/btn"
                                                >
                                                    <ExternalLink className="h-5 w-5 group-hover/btn:scale-110 transition-transform" />
                                                </Link>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="h-20 w-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 shadow-inner">
                                                <Search className="h-10 w-10" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-xl font-bold text-slate-600">Kayıt Bulunamadı</h3>
                                                <p className="text-slate-400 font-medium">Arama kriterlerinize uygun sonuç bulunmuyor.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
