"use client"

import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { Search, ShieldAlert, FileText, ChevronRight } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { tr } from "date-fns/locale";

type KaskoRow = {
    id: string;
    sirket: string | null;
    policeNo: string | null;
    baslangicTarihi: Date;
    bitisTarihi: Date;
    tutar: number | null;
    aktifMi: boolean;
    arac: {
        id: string;
        plaka: string;
        marka: string;
        model: string;
        sofor: { adSoyad: string } | null;
    };
};

export default function KaskoClient({ initialData }: { initialData: KaskoRow[] }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("TÜMÜ");

    const filteredData = useMemo(() => {
        return initialData.filter(item => {
            const matchesSearch = item.arac.plaka.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.sirket && item.sirket.toLowerCase().includes(searchTerm.toLowerCase()));

            const daysLeft = differenceInDays(new Date(item.bitisTarihi), new Date());
            let status = "GÜVENLİ";
            if (daysLeft < 0) status = "GECİKTİ";
            else if (daysLeft <= 15) status = "YÜKSEK";
            else if (daysLeft <= 30) status = "YAKLAŞIYOR";

            const matchesStatus = filterStatus === "TÜMÜ" || status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [initialData, searchTerm, filterStatus]);

    const getRemainingDaysBadge = (endDate: Date) => {
        const daysLeft = differenceInDays(new Date(endDate), new Date());

        if (daysLeft < 0) {
            return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200 border-0 shadow-none px-2 py-0.5 text-[10px] font-bold">Gecikti ({Math.abs(daysLeft)} Gün)</Badge>;
        }
        if (daysLeft <= 15) {
            return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-0 shadow-none px-2 py-0.5 text-[10px] font-bold">Yüksek ({daysLeft} Gün)</Badge>;
        }
        if (daysLeft <= 30) {
            return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0 shadow-none px-2 py-0.5 text-[10px] font-bold">Yaklaşıyor ({daysLeft} Gün)</Badge>;
        }
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0 shadow-none px-2 py-0.5 text-[10px] font-bold">Güvenli ({daysLeft} Gün)</Badge>;
    };

    const yuksekSayisi = filteredData.filter(d => differenceInDays(new Date(d.bitisTarihi), new Date()) <= 15).length;

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <FileText className="text-indigo-600" size={24} />
                        Kasko Poliçe Takibi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Genişletilmiş kasko süresi bitişleri ve aktif poliçe dökümleri.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border border-red-100 shadow-sm">
                        <ShieldAlert size={16} />
                        {yuksekSayisi} Yüksek Kasko
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                <div className="border-b border-[#E2E8F0] p-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#F8FAFC]">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <Input
                            type="text"
                            placeholder="Plaka veya kasko şirketi ara..."
                            className="pl-9 border-[#E2E8F0] shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md h-9 text-sm w-full bg-white transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="border-[#E2E8F0] shadow-sm border text-sm rounded-md px-3 h-9 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-700 w-full sm:w-auto"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="TÜMÜ">Tüm Durumlar</option>
                        <option value="YÜKSEK">Yüksek (&lt;15 Gün)</option>
                        <option value="YAKLAŞIYOR">Yaklaşıyor (15-30 Gün)</option>
                        <option value="GÜVENLİ">Güvenli (&gt;30 Gün)</option>
                        <option value="GECİKTİ">Gecikmiş Poliçeler</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <Table className="min-w-[1000px]">
                        <TableHeader className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[140px] font-bold text-slate-600 py-3 px-4 text-[11px] uppercase tracking-wider">Durum</TableHead>
                                <TableHead className="w-[130px] font-bold text-slate-600 py-3 px-4 text-[11px] uppercase tracking-wider">Plaka</TableHead>
                                <TableHead className="font-bold text-slate-600 py-3 px-4 text-[11px] uppercase tracking-wider">Sigorta Şirketi & Poliçe No</TableHead>
                                <TableHead className="w-[180px] font-bold text-slate-600 py-3 px-4 text-[11px] uppercase tracking-wider">Bitiş Tarihi</TableHead>
                                <TableHead className="w-[150px] font-bold text-slate-600 py-3 px-4 text-[11px] uppercase tracking-wider">Zimmetli Şoför</TableHead>
                                <TableHead className="w-[120px] font-bold text-slate-600 py-3 px-4 text-[11px] uppercase tracking-wider text-right pr-6">Tutar</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-sm">
                            {filteredData.length > 0 ? (
                                filteredData.map((item, idx) => (
                                    <TableRow
                                        key={item.id}
                                        className={`transition-colors border-b border-slate-100 hover:bg-[#F8FAFC] group ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}`}
                                    >
                                        <TableCell className="px-4 py-2.5 align-middle">
                                            {getRemainingDaysBadge(item.bitisTarihi)}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 align-middle">
                                            <span className="font-mono font-bold text-slate-900">{item.arac.plaka}</span>
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800">{item.sirket || 'Belirtilmemiş'}</span>
                                                <span className="text-[11px] text-slate-500 font-mono mt-0.5">PN: {item.policeNo || '-'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 align-middle font-medium text-slate-700">
                                            {format(new Date(item.bitisTarihi), 'dd MMM yyyy', { locale: tr })}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 align-middle">
                                            {item.arac.sofor ? (
                                                <span className="font-medium text-slate-700">{item.arac.sofor.adSoyad}</span>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">Atanmamış</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 align-middle text-right pr-6 font-bold text-slate-800">
                                            {item.tutar ? `₺${item.tutar.toLocaleString('tr-TR')}` : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-2.5 align-middle text-right">
                                            <button className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-100">
                                                <ChevronRight size={16} />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-slate-500">
                                        Seçili kriterlere uygun kasko poliçesi bulunamadı.
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
