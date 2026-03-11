"use client"

import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import { Search, Plus, Wrench } from "lucide-react";

type BakimRow = {
    id: string;
    bakimTarihi: Date;
    yapilanKm: number;
    sonrakiBakimKm?: number | null;
    servisAdi?: string | null;
    yapilanIslemler?: string | null;
    tutar: number;
    arac: {
        plaka: string;
        marka: string;
    };
};

export default function BakimServisClient({ initialBakimlar }: { initialBakimlar: BakimRow[] }) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredBakimlar = useMemo(() => {
        return initialBakimlar.filter(bakim => {
            return bakim.arac.plaka.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (bakim.servisAdi && bakim.servisAdi.toLowerCase().includes(searchTerm.toLowerCase()));
        });
    }, [initialBakimlar, searchTerm]);

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bakım & Servis Kayıtları</h2>
                    <p className="text-slate-500 text-sm mt-1">Araçların periyodik ve ağır bakım geçmişi.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                        <Plus size={16} />
                        Servis Kaydı Gir
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <div className="border-b border-[#E2E8F0] p-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#F8FAFC]">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            type="text"
                            placeholder="Plaka veya Servis adı ara..."
                            className="pl-9 border-[#E2E8F0] shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md h-9 text-sm w-full bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table className="min-w-[1000px]">
                        <TableHeader className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[120px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Tarih</TableHead>
                                <TableHead className="w-[180px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Araç</TableHead>
                                <TableHead className="w-[200px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Servis Merkezi</TableHead>
                                <TableHead className="font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider">Yapılan İşlemler</TableHead>
                                <TableHead className="w-[150px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider text-right">Bakım KM</TableHead>
                                <TableHead className="w-[130px] font-semibold text-slate-500 py-3.5 px-4 text-[11px] uppercase tracking-wider text-right pr-6">Tutar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-sm">
                            {filteredBakimlar.length > 0 ? (
                                filteredBakimlar.map((bakim, idx) => (
                                    <TableRow
                                        key={bakim.id}
                                        className={`transition-colors border-b border-slate-100 hover:bg-[#F8FAFC] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                                    >
                                        <TableCell className="px-4 py-4 align-middle font-medium text-slate-700">
                                            {new Date(bakim.bakimTarihi).toLocaleDateString('tr-TR')}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-mono font-bold text-slate-900">{bakim.arac.plaka}</span>
                                                <span className="text-[11px] text-slate-500 mt-0.5">{bakim.arac.marka}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle font-medium text-slate-700">
                                            {bakim.servisAdi ? (
                                                <div className="flex items-center gap-2">
                                                    <Wrench size={14} className="text-slate-400" />
                                                    {bakim.servisAdi}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">Belirtilmemiş</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle text-slate-600 truncate max-w-[250px]">
                                            {bakim.yapilanIslemler || '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle font-mono text-xs text-slate-600 text-right">
                                            {bakim.yapilanKm.toLocaleString('tr-TR')} km
                                        </TableCell>
                                        <TableCell className="px-4 py-3 align-middle font-bold text-slate-900 text-right pr-6 text-[15px]">
                                            ₺{bakim.tutar.toLocaleString('tr-TR')}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center p-10 text-slate-400">
                                            <Search size={28} className="mb-3 text-slate-300" />
                                            <p className="text-sm font-medium text-slate-500">Bakım kaydı bulunamadı.</p>
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
