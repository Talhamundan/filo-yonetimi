"use client"

import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import { Search, Plus, Fuel, Receipt, CreditCard, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/card";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { AracLink } from "@/components/links/RecordLinks";
import ExcelTransferToolbar from "@/components/ui/excel-transfer-toolbar";

type LedgerRecord = {
    id: string;
    aracId: string;
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

type FinansSortKey = "tarih" | "aracPlaka" | "tur" | "detay" | "tutar";
type SortDirection = "asc" | "desc";

export default function FinansClient({ initialRecords, yakitMetrics = [] }: { initialRecords: LedgerRecord[], yakitMetrics?: YakitMetric[] }) {
    const { canAccessAllCompanies } = useDashboardScope();
    const [searchTerm, setSearchTerm] = useState("");
    const [sortState, setSortState] = useState<{ key: FinansSortKey; direction: SortDirection }>({
        key: "tarih",
        direction: "desc",
    });

    const filteredRecords = useMemo(() => {
        const filtered = initialRecords.filter(rec => {
            return rec.aracPlaka.toLowerCase().includes(searchTerm.toLowerCase()) ||
                rec.tur.toLowerCase().includes(searchTerm.toLowerCase());
        });

        return [...filtered].sort((a, b) => {
            let aValue: number | string = "";
            let bValue: number | string = "";

            switch (sortState.key) {
                case "tarih":
                    aValue = new Date(a.tarih).getTime();
                    bValue = new Date(b.tarih).getTime();
                    break;
                case "aracPlaka":
                    aValue = a.aracPlaka;
                    bValue = b.aracPlaka;
                    break;
                case "tur":
                    aValue = a.tur;
                    bValue = b.tur;
                    break;
                case "detay":
                    aValue = a.detay;
                    bValue = b.detay;
                    break;
                case "tutar":
                    aValue = a.tutar;
                    bValue = b.tutar;
                    break;
            }

            const result =
                typeof aValue === "number" && typeof bValue === "number"
                    ? aValue - bValue
                    : String(aValue).localeCompare(String(bValue), "tr", { numeric: true, sensitivity: "base" });

            return sortState.direction === "asc" ? result : -result;
        });
    }, [initialRecords, searchTerm, sortState]);

    const toggleSort = (key: FinansSortKey) => {
        setSortState((prev) => {
            if (prev.key === key) {
                return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
            }
            return { key, direction: "asc" };
        });
    };

    const renderSortIcon = (key: FinansSortKey) => {
        if (sortState.key !== key) return <ArrowUpDown size={13} className="text-slate-400" />;
        return sortState.direction === "asc"
            ? <ArrowUp size={13} className="text-slate-600" />
            : <ArrowDown size={13} className="text-slate-600" />;
    };

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
                    <p className="text-slate-500 text-sm mt-1">Araçların tüm yakıt alımları, muayene ücretleri ve genel gider kalemleri.</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                        <Plus size={16} />
                        Gider İşle
                    </button>
                    <ExcelTransferToolbar
                        options={[
                            { entity: "yakit", label: "Yakıt" },
                            { entity: "masraf", label: "Masraf" },
                            { entity: "muayene", label: "Muayene" },
                        ]}
                    />
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
                                            <AracLink
                                                aracId={metric.aracId}
                                                className="font-mono font-bold text-slate-800 text-base hover:text-indigo-600 hover:underline"
                                            >
                                                {metric.plaka}
                                            </AracLink>
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
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">
                                    <button type="button" onClick={() => toggleSort("tarih")} className="inline-flex items-center gap-1.5">
                                        İşlem Tarihi {renderSortIcon("tarih")}
                                    </button>
                                </TableHead>
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">
                                    <button type="button" onClick={() => toggleSort("aracPlaka")} className="inline-flex items-center gap-1.5">
                                        İlgili Araç {renderSortIcon("aracPlaka")}
                                    </button>
                                </TableHead>
                                <TableHead className="w-[200px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">
                                    <button type="button" onClick={() => toggleSort("tur")} className="inline-flex items-center gap-1.5">
                                        Gider Türü {renderSortIcon("tur")}
                                    </button>
                                </TableHead>
                                <TableHead className="font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">
                                    <button type="button" onClick={() => toggleSort("detay")} className="inline-flex items-center gap-1.5">
                                        Açıklama / Detay {renderSortIcon("detay")}
                                    </button>
                                </TableHead>
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider text-right pr-6">
                                    <button type="button" onClick={() => toggleSort("tutar")} className="inline-flex items-center gap-1.5 ml-auto">
                                        Tutar {renderSortIcon("tutar")}
                                    </button>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-[13px]">
                            {filteredRecords.length > 0 ? (
                                filteredRecords.map((rec, idx) => (
                                    <TableRow
                                        key={rec.id}
                                        className={`transition-colors border-b border-slate-100 hover:bg-[#F8FAFC] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                                    >
                                        <TableCell className="px-4 py-3.5 align-middle text-slate-500 font-medium">
                                            {new Date(rec.tarih).toLocaleString("tr-TR", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                hour12: false,
                                            })}
                                        </TableCell>
                                        <TableCell className="px-4 py-3.5 align-middle">
                                            <div className="flex flex-col">
                                                <AracLink
                                                    aracId={rec.aracId}
                                                    className="font-mono font-bold text-slate-800 hover:text-indigo-600 hover:underline"
                                                >
                                                    {rec.aracPlaka}
                                                </AracLink>
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
