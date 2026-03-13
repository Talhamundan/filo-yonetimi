"use client"

import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import { Search, Plus, Fuel, Receipt, CreditCard } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/card";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

type LedgerRecord = {
    id: string;
    tarih: Date;
    tur: string;
    aracPlaka: string;
    aracSirket?: string | null;
    detay: string;
    tutar: number;
};

type YakitMetric = {
    aracId: string;
    plaka: string;
    sirketAd?: string | null;
    toplamTutar: number;
    toplamLitre: number;
    tuketim100Km: number;
    litreMaliyet: number;
};

export default function FinansClient({ initialRecords, yakitMetrics = [] }: { initialRecords: LedgerRecord[], yakitMetrics?: YakitMetric[] }) {
    const { canAccessAllCompanies } = useDashboardScope();
    const [searchTerm, setSearchTerm] = useState("");

    const filteredRecords = useMemo(() => {
        return initialRecords.filter(rec => {
            return rec.aracPlaka.toLowerCase().includes(searchTerm.toLowerCase()) ||
                rec.tur.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [initialRecords, searchTerm]);

    const getIconForTur = (tur: string) => {
        if (tur.includes('Yakıt')) return <Fuel size={14} className="text-indigo-500" />;
        if (tur.includes('HGS')) return <CreditCard size={14} className="text-amber-500" />;
        return <Receipt size={14} className="text-slate-400" />;
    };

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Finans & HGS Defteri</h2>
                    <p className="text-slate-500 text-sm mt-1">Araçların tüm yakıt alımları ve genel gider kalemleri.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                        <Plus size={16} />
                        Gider İşle
                    </button>
                </div>
            </header>

            {yakitMetrics && yakitMetrics.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Fuel size={20} className="text-indigo-500" />
                        Araç Bazlı Yakıt Analizi
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {yakitMetrics.map(metric => (
                            <Card key={metric.aracId} className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col">
                                            <span className="font-mono font-bold text-slate-800 text-base">{metric.plaka}</span>
                                            {canAccessAllCompanies && metric.sirketAd ? (
                                                <span className="text-[11px] font-semibold text-indigo-600 mt-0.5">{metric.sirketAd}</span>
                                            ) : null}
                                        </div>
                                        <div className="p-1.5 bg-indigo-50 rounded-md text-indigo-600">
                                            <Fuel size={14} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">100km Tüketim:</span>
                                            <span className="font-semibold text-slate-900">{metric.tuketim100Km > 0 ? `${metric.tuketim100Km.toFixed(1)} L` : '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">Birim Maliyet:</span>
                                            <span className="font-semibold text-slate-900">{metric.litreMaliyet > 0 ? `₺${metric.litreMaliyet.toFixed(2)}/L` : '-'}</span>
                                        </div>
                                        <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                                            <span className="text-slate-400">Total: {metric.toplamLitre.toFixed(0)}L</span>
                                            <span className="font-bold text-indigo-700">₺{(metric.toplamTutar / 1000).toFixed(1)}k</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <div className="border-b border-[#E2E8F0] p-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#F8FAFC]">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            type="text"
                            placeholder="Plaka veya İşlem Türü ara..."
                            className="pl-9 border-[#E2E8F0] shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md h-9 text-sm w-full bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                        <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">İşlem Tarihi</TableHead>
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">İlgili Araç</TableHead>
                                <TableHead className="w-[200px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Gider Türü</TableHead>
                                <TableHead className="font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Açıklama / Detay</TableHead>
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider text-right pr-6">Tutar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-sm">
                            {filteredRecords.length > 0 ? (
                                filteredRecords.map((rec, idx) => (
                                    <TableRow
                                        key={rec.id}
                                        className={`transition-colors border-b border-slate-100 hover:bg-[#F8FAFC] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                                    >
                                        <TableCell className="px-4 py-3.5 align-middle text-slate-500 font-medium">
                                            {new Date(rec.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-slate-800">{rec.aracPlaka}</span>
                                                {canAccessAllCompanies && rec.aracSirket ? (
                                                    <span className="text-[11px] font-semibold text-indigo-600 mt-0.5">{rec.aracSirket}</span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 align-middle">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-slate-100 rounded-md">
                                                    {getIconForTur(rec.tur)}
                                                </div>
                                                <span className="font-semibold text-slate-700">{rec.tur}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 align-middle text-slate-500 text-sm">
                                            {rec.detay}
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 align-middle font-bold text-slate-900 text-right pr-6 text-[15px]">
                                            ₺{rec.tutar.toLocaleString('tr-TR')}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center p-10 text-slate-400">
                                            <Search size={28} className="mb-3 text-slate-300" />
                                            <p className="text-sm font-medium text-slate-500">Finansal kayıt bulunamadı.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
