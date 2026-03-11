"use client"

import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import {
    Car, Wallet, ShieldAlert, Activity, TrendingUp, Fuel
} from "lucide-react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { useRouter } from "next/navigation";
import { differenceInDays } from "date-fns";

const STATUS_COLORS = {
    AKTIF: '#10B981',
    BOSTA: '#94A3B8',
    SERVISTE: '#F59E0B',
    ARIZALI: '#F43F5E',
    YEDEK: '#64748B',
};



interface DashboardMetrics {
    aylikToplamGider: number;
    kritikUyariSayisi: number;
    verimlilikOrani: number;
    ortalamaYakit: number;
    aktifArac: number;
    toplamArac: number;
    servisteArac: number;
}

interface AlertItem {
    id: string;
    plaka: string;
    message: string;
    tarih: string;
}

interface DashboardClientProps {
    metrics: DashboardMetrics;
    durumData: { name: string, value: number }[];
    alerts: AlertItem[];
    sixMonthsTrend: { name: string, gider: number }[];
    top5Expenses: { plaka: string, tutar: number }[];
}

export default function DashboardClient({ metrics, durumData, alerts, sixMonthsTrend, top5Expenses }: DashboardClientProps) {
    const router = useRouter();

    const formattedDurumData = useMemo(() => {
        return durumData.map(item => {
            let name = item.name;
            if (item.name === 'AKTIF') name = 'Aktif Piyasada';
            else if (item.name === 'BOSTA') name = 'Boşta (Şoförsüz)';
            else if (item.name === 'SERVISTE') name = 'Servis/Bakım';
            else if (item.name === 'ARIZALI') name = 'Arızalı';
            else if (item.name === 'YEDEK') name = 'Yedek Bekliyor';

            return {
                name,
                value: item.value,
                color: (STATUS_COLORS as any)[item.name] || '#CBD5E1'
            };
        });
    }, [durumData]);

    const calculateDays = (dateStr: string) => {
        return differenceInDays(new Date(dateStr), new Date());
    }

    return (
        <div className="p-6 md:p-8 xl:p-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Operasyon Özeti</h2>
                    <p className="text-slate-500 text-sm mt-1">Filo karlılığı ve kritik uyarı sistemi anlık verileri.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/dashboard/araclar')} className="bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-slate-700 px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                        <Car size={16} />
                        Araç Envanteri
                    </button>
                </div>
            </header>
            
            {alerts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-2 mb-4">
                        <ShieldAlert size={18} className="text-amber-600" />
                        <h3 className="font-semibold text-amber-900">Acil Aksiyon Gerektirenler</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {alerts.map(alert => {
                            const days = calculateDays(alert.tarih);
                            return (
                                <div key={alert.id} className="bg-white px-4 py-3 rounded-lg border border-amber-100 shadow-sm flex flex-col justify-between">
                                    <span className="font-mono text-sm font-bold text-slate-800 mb-1">{alert.plaka}</span>
                                    <span className={`text-xs font-semibold ${days <= 7 ? 'text-rose-600' : 'text-amber-600'}`}>
                                        {alert.message} ({days} gün)
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-500">Bu Ay Toplam Gider</p>
                            <div className="p-1.5 bg-rose-50 rounded-md text-rose-600"><Wallet size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">₺{metrics.aylikToplamGider.toLocaleString("tr-TR")}</h3>
                        <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-2">
                            <TrendingUp size={12} /> +12% önceki aya göre
                        </p>
                    </CardContent>
                </Card>

                <Card 
                    className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
                    onClick={() => router.push('/dashboard/evrak-takip')}
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2 text-slate-500 group-hover:text-amber-600 transition-colors">
                            <p className="text-sm font-medium">Kritik Tarih Uyarıları</p>
                            <div className="p-1.5 bg-amber-50 rounded-md text-amber-600"><ShieldAlert size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">{metrics.kritikUyariSayisi} <span className="text-sm text-slate-400 font-medium">Risk</span></h3>
                        <p className="text-xs text-amber-600 font-medium mt-2">
                            &lt; 15 gün kalan evraklar
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-500">Operasyonel Verimlilik</p>
                            <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600"><Activity size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">%{metrics.verimlilikOrani}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-2">
                            {metrics.aktifArac} araç şu an sahada aktif
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-500">Araç Başı Yakıt (Ort.)</p>
                            <div className="p-1.5 bg-indigo-50 rounded-md text-indigo-600"><Fuel size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">₺{metrics.ortalamaYakit.toLocaleString("tr-TR")}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-2">
                            Bu ay aktif araçlar üzerinden
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 h-auto lg:h-[350px]">
                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl flex flex-col h-full col-span-1 lg:col-span-2">
                    <CardHeader className="pb-0 px-6 pt-6">
                        <CardTitle className="text-sm font-semibold text-slate-800">Operasyonel Gider Trendi (Son 6 Ay)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 pb-4 pt-4 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sixMonthsTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorGider" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `₺${val / 1000}k`} dx={-10} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`₺${Number(value).toLocaleString('tr-TR')}`, 'Toplam Gider']}
                                    labelStyle={{ color: '#0F172A', fontWeight: 600, marginBottom: '4px' }}
                                />
                                <Area type="monotone" dataKey="gider" stroke="#6366F1" fillOpacity={1} fill="url(#colorGider)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl flex flex-col h-full col-span-1">
                    <CardHeader className="pb-0 px-6 pt-6 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-800">Filo Dağılımı</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 pb-4 p-0 flex flex-col items-center">
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={90}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {formattedDurumData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 gap-x-2 gap-y-3 px-6 mt-2 w-full">
                            {formattedDurumData.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs font-medium text-slate-600 truncate">{item.name}</span>
                                    <span className="text-xs font-bold text-slate-900 ml-auto">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 h-auto lg:h-[300px]">
                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl flex flex-col h-full col-span-1 lg:col-span-2">
                    <CardHeader className="pb-0 px-6 pt-6">
                        <CardTitle className="text-sm font-semibold text-slate-800">En Çok Masraf Çıkaran Araçlar (Top 5)</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 pb-4 pt-4 px-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={top5Expenses} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F1F5F9" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `₺${val / 1000}k`} />
                                <YAxis dataKey="plaka" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#0F172A', fontWeight: 600 }} dx={-10} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`₺${Number(value).toLocaleString('tr-TR')}`, 'Masraf']}
                                    labelStyle={{ color: '#0F172A', fontWeight: 600, marginBottom: '4px' }}
                                />
                                <Bar dataKey="tutar" fill="#EF4444" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
