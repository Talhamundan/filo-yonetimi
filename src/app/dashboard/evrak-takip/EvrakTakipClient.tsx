"use client"

import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { Search, ShieldAlert, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

type EvrakRow = {
    id: string;
    aracId: string;
    plaka: string;
    marka: string;
    sirketAd?: string | null;
    tur: string;
    gecerlilikTarihi: Date;
    kalanGun: number;
    durum: 'GECIKTI' | 'KRITIK' | 'YAKLASTI' | 'GECERLI';
};

export default function EvrakTakipClient({ initialEvraklar }: { initialEvraklar: EvrakRow[] }) {
    const router = useRouter();
    const { canAccessAllCompanies } = useDashboardScope();
    const [searchTerm, setSearchTerm] = useState("");
    const [filterDurum, setFilterDurum] = useState("TÜMÜ");

    const filteredEvraklar = useMemo(() => {
        return initialEvraklar.filter(evrak => {
            const matchesSearch = evrak.plaka.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDurum = filterDurum === "TÜMÜ" || evrak.durum === filterDurum;
            return matchesSearch && matchesDurum;
        });
    }, [initialEvraklar, searchTerm, filterDurum]);

    const getDurumBadge = (durum: string) => {
        switch (durum) {
            case 'GECIKTI': return <div className="flex items-center gap-1.5"><Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-none"><ShieldAlert size={12} className="mr-1" />Gecikti</Badge></div>;
            case 'KRITIK': return <div className="flex items-center gap-1.5"><Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-0 shadow-none"><AlertTriangle size={12} className="mr-1" />Kritik (&lt;15 Gün)</Badge></div>;
            case 'YAKLASTI': return <div className="flex items-center gap-1.5"><Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 shadow-none"><Clock size={12} className="mr-1" />Yaklaştı</Badge></div>;
            case 'GECERLI': return <div className="flex items-center gap-1.5"><Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 shadow-none"><CheckCircle2 size={12} className="mr-1" />Geçerli</Badge></div>;
            default: return null;
        }
    };

    const getRowColor = (durum: string, isEven: boolean) => {
        if (durum === 'GECIKTI') return "bg-rose-50/50 hover:bg-rose-50";
        if (durum === 'KRITIK') return "bg-red-50/30 hover:bg-red-50/60";
        return isEven ? 'bg-white hover:bg-[#F8FAFC]' : 'bg-[#FAFAFA] hover:bg-[#F8FAFC]';
    }

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Evrak & Sigorta Takibi</h2>
                    <p className="text-slate-500 text-sm mt-1">Muayene, Kasko ve Trafik Sigortası bitiş süreleri.</p>
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <div className="border-b border-[#E2E8F0] p-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#F8FAFC]">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            type="text"
                            placeholder="Plaka ara..."
                            className="pl-9 border-[#E2E8F0] shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md h-9 text-sm w-full bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="border-[#E2E8F0] shadow-sm border text-sm rounded-md px-3 h-9 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-700 w-full sm:w-auto"
                        value={filterDurum}
                        onChange={(e) => setFilterDurum(e.target.value)}
                    >
                        <option value="TÜMÜ">Tüm Durumlar</option>
                        <option value="GECIKTI">Gecikti</option>
                        <option value="KRITIK">Kritik (&lt;15 Gün)</option>
                        <option value="YAKLASTI">Yaklaştı (&lt;30 Gün)</option>
                        <option value="GECERLI">Geçerli</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <Table className="min-w-[900px]">
                        <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[180px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Durum</TableHead>
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Plaka</TableHead>
                                <TableHead className="w-[200px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Evrak Türü</TableHead>
                                <TableHead className="font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Geçerlilik Tarihi</TableHead>
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider text-right pr-6">Kalan Gün</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-sm">
                            {filteredEvraklar.length > 0 ? (
                                filteredEvraklar.map((evrak, idx) => (
                                    <TableRow
                                        key={evrak.id}
                                        onClick={() => router.push(`/dashboard/araclar/${evrak.aracId}`)}
                                        className={`cursor-pointer transition-colors border-b border-slate-100 ${getRowColor(evrak.durum, idx % 2 === 0)}`}
                                    >
                                        <TableCell className="px-4 py-4 align-middle">
                                            {getDurumBadge(evrak.durum)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-slate-900">{evrak.plaka}</span>
                                                <span className="text-[11px] text-slate-500 mt-0.5">{evrak.marka}</span>
                                                {canAccessAllCompanies && evrak.sirketAd ? (
                                                    <span className="text-[11px] font-semibold text-indigo-600 mt-0.5">{evrak.sirketAd}</span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle font-semibold text-slate-700">
                                            {evrak.tur}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle font-medium text-slate-600">
                                            {new Date(evrak.gecerlilikTarihi).toLocaleDateString('tr-TR')}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle text-right pr-6">
                                            {evrak.kalanGun < 0 ? (
                                                <span className="font-bold text-rose-600 border border-rose-200 bg-rose-50 px-2 py-0.5 rounded text-xs">{Math.abs(evrak.kalanGun)} Gün Geçti</span>
                                            ) : (
                                                <span className={`font-mono text-[15px] font-bold ${evrak.kalanGun <= 15 ? 'text-red-600' : evrak.kalanGun <= 30 ? 'text-amber-600' : 'text-slate-700'}`}>
                                                    {evrak.kalanGun}
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center p-10 text-slate-400">
                                            <CheckCircle2 size={32} className="mb-3 text-emerald-400" />
                                            <p className="text-sm font-medium text-slate-500">Kritik evrak kaydı bulunmuyor.</p>
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
