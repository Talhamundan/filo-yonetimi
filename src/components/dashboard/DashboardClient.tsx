"use client"

import React, { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import {
    Wallet,
    ShieldAlert,
    TrendingUp,
    Fuel,
    CalendarClock,
    ReceiptText,
    FileClock,
    AlertTriangle,
    Truck,
    Users,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { fetcher } from "@/lib/fetcher";
import type { DashboardData } from "@/lib/dashboard-data";
import DeadlineCalendar from "./DeadlineCalendar";

interface DashboardClientProps {
    initialData: DashboardData;
}

const EVENT_TYPE_LABEL = {
    TRAFIK: "Trafik",
    KASKO: "Kasko",
    MUAYENE: "Muayene",
    CEZA: "Ceza",
} as const;

const COST_CATEGORY_LEGEND = [
    { key: "yakit", label: "Yakıt", color: "#22C55E" },
    { key: "bakim", label: "Bakım", color: "#F59E0B" },
    { key: "muayene", label: "Muayene", color: "#0EA5E9" },
    { key: "hgs", label: "HGS", color: "#8B5CF6" },
    { key: "ceza", label: "Ceza", color: "#EF4444" },
    { key: "kasko", label: "Kasko", color: "#6366F1" },
    { key: "trafik", label: "Trafik", color: "#06B6D4" },
    { key: "diger", label: "Diğer", color: "#94A3B8" },
] as const;

export default function DashboardClient({ initialData }: DashboardClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedSirketId = searchParams.get("sirket");
    const selectedYil = searchParams.get("yil");
    const selectedAy = searchParams.get("ay");
    const apiParams = new URLSearchParams();
    if (selectedSirketId) apiParams.set("sirket", selectedSirketId);
    if (selectedYil) apiParams.set("yil", selectedYil);
    if (selectedAy) apiParams.set("ay", selectedAy);
    const dashboardApiKey = apiParams.toString() ? `/api/dashboard?${apiParams.toString()}` : "/api/dashboard";

    const { data } = useSWR<DashboardData>(dashboardApiKey, fetcher, {
        refreshInterval: 30000,
        revalidateOnFocus: true,
        shouldRetryOnError: true,
        fallbackData: initialData,
    });

    const { metrics, alerts, calendarEvents, monthlyExpenseTrend, vehicleCostReport, driverCostReport } = data!;

    const calendarCardRef = useRef<HTMLDivElement | null>(null);
    const [calendarCardHeight, setCalendarCardHeight] = React.useState<number | null>(null);

    useEffect(() => {
        const element = calendarCardRef.current;
        if (!element) return;

        const syncHeight = () => setCalendarCardHeight(element.offsetHeight);
        syncHeight();

        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(syncHeight);
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const yearlyPieData = useMemo(() => {
        return COST_CATEGORY_LEGEND
            .map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: monthlyExpenseTrend.reduce((sum, row) => sum + Number(row[category.key] || 0), 0),
            }))
            .filter((item) => item.value > 0);
    }, [monthlyExpenseTrend]);

    const selectedMonthRow = useMemo(() => {
        if (monthlyExpenseTrend.length === 0) return null;
        return monthlyExpenseTrend[monthlyExpenseTrend.length - 1];
    }, [monthlyExpenseTrend]);

    const monthlyPieData = useMemo(() => {
        if (!selectedMonthRow) return [];
        return COST_CATEGORY_LEGEND
            .map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: Number(selectedMonthRow[category.key] || 0),
            }))
            .filter((item) => item.value > 0);
    }, [selectedMonthRow]);

    const yearlyPieTotal = useMemo(
        () => yearlyPieData.reduce((sum, item) => sum + item.value, 0),
        [yearlyPieData]
    );
    const monthlyPieTotal = useMemo(
        () => monthlyPieData.reduce((sum, item) => sum + item.value, 0),
        [monthlyPieData]
    );
    const vehicleStackCategories = useMemo(
        () =>
            COST_CATEGORY_LEGEND.filter((category) =>
                vehicleCostReport.some((row) => Number(row[category.key] || 0) > 0)
            ),
        [vehicleCostReport]
    );

    const calculateDays = (dateStr: string) => {
        return differenceInCalendarDays(new Date(dateStr), new Date());
    };

    const riskSummary = useMemo(() => {
        const gecikti = calendarEvents.filter((event) => event.status === "GECIKTI").length;
        const kritik = calendarEvents.filter((event) => event.status === "KRITIK").length;
        const yaklasti = calendarEvents.filter((event) => event.status === "YAKLASTI").length;

        return {
            gecikti,
            kritik,
            yaklasti,
        };
    }, [calendarEvents]);

    const upcomingEvents = useMemo(() => {
        const alertEventIds = new Set(alerts.map((alert) => alert.id));
        return [...calendarEvents]
            .filter((event) => event.daysLeft >= 0 && !alertEventIds.has(event.id))
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .slice(0, 6);
    }, [alerts, calendarEvents]);

    const formatChangeText = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
    const getChangeClassName = (value: number) => {
        if (value > 0) return "text-rose-600";
        if (value < 0) return "text-emerald-600";
        return "text-slate-500";
    };

    const navigateWithScope = (href: string) => {
        if (href.includes("sirket=") || href.includes("yil=")) {
            router.push(href);
            return;
        }
        const scopedParams = new URLSearchParams();
        if (selectedSirketId) scopedParams.set("sirket", selectedSirketId);
        if (selectedYil) scopedParams.set("yil", selectedYil);
        if (selectedAy) scopedParams.set("ay", selectedAy);
        const query = scopedParams.toString();
        if (!query) {
            router.push(href);
            return;
        }
        const joinChar = href.includes("?") ? "&" : "?";
        router.push(`${href}${joinChar}${query}`);
    };

    return (
        <div className="p-5 md:p-7 xl:p-8 space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
                <div className="space-y-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Filo Operasyon Merkezi</h2>
                        <p className="text-slate-500 text-sm mt-1 max-w-2xl">
                            Günlük operasyon, masraf kontrolü ve son tarih yönetimini tek panelde takip edin.
                        </p>
                    </div>
                    <div className="inline-flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            Toplam Araç: <span className="font-semibold text-slate-900">{metrics.toplamArac}</span>
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Aktif: <span className="font-semibold text-slate-900">{metrics.aktifArac}</span>
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Serviste: <span className="font-semibold text-slate-900">{metrics.servisteArac}</span>
                        </span>
                    </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <CalendarClock size={16} className="text-indigo-600" />
                        <h3 className="font-semibold text-sm text-slate-900">Hızlı İşlemler</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => navigateWithScope("/dashboard/kasko")}
                        >
                            <ShieldAlert size={14} />
                            Kasko
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => navigateWithScope("/dashboard/trafik-sigortasi")}
                        >
                            <FileClock size={14} />
                            Trafik Sigortası
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => navigateWithScope("/dashboard/muayeneler")}
                        >
                            <CalendarClock size={14} />
                            Muayene
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="justify-start"
                            onClick={() => navigateWithScope("/dashboard/ceza-masraflari")}
                        >
                            <ReceiptText size={14} />
                            Ceza
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-500">Bu Ay Toplam Gider</p>
                            <div className="p-1.5 bg-rose-50 rounded-md text-rose-600"><Wallet size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">₺{metrics.aylikToplamGider.toLocaleString("tr-TR")}</h3>
                        <p className={`text-xs font-medium flex items-center gap-1 mt-2 ${getChangeClassName(metrics.giderDegisimYuzdesi)}`}>
                            <TrendingUp size={12} /> {formatChangeText(metrics.giderDegisimYuzdesi)} {metrics.comparisonLabel}
                        </p>
                    </CardContent>
                </Card>

                <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateWithScope("/dashboard/araclar")}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateWithScope("/dashboard/araclar");
                        }
                    }}
                    className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl cursor-pointer transition hover:border-amber-200 hover:shadow-md"
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2 text-slate-500">
                            <p className="text-sm font-medium">Aylık Ortalama Araç Maliyeti</p>
                            <div className="p-1.5 bg-amber-50 rounded-md text-amber-600"><Truck size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">₺{metrics.ortalamaAracMaliyeti.toLocaleString("tr-TR")}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-2">
                            {metrics.aracMaliyetOrtalamaAdet} araç ortalaması
                        </p>
                        <p className={`text-xs font-medium mt-1 ${getChangeClassName(metrics.aracMaliyetDegisimYuzdesi)}`}>
                            {formatChangeText(metrics.aracMaliyetDegisimYuzdesi)} {metrics.comparisonLabel}
                        </p>
                    </CardContent>
                </Card>

                <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateWithScope("/dashboard/personel")}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateWithScope("/dashboard/personel");
                        }
                    }}
                    className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl cursor-pointer transition hover:border-emerald-200 hover:shadow-md"
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-500">Aylık Ortalama Şoför Maliyeti</p>
                            <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600"><Users size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">₺{metrics.ortalamaSoforMaliyeti.toLocaleString("tr-TR")}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-2">
                            {metrics.soforMaliyetOrtalamaAdet} şoför ortalaması
                        </p>
                        <p className={`text-xs font-medium mt-1 ${getChangeClassName(metrics.soforMaliyetDegisimYuzdesi)}`}>
                            {formatChangeText(metrics.soforMaliyetDegisimYuzdesi)} {metrics.comparisonLabel}
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
                            Aktif araçlar üzerinden
                        </p>
                        <p className={`text-xs font-medium mt-1 ${getChangeClassName(metrics.yakitDegisimYuzdesi)}`}>
                            {formatChangeText(metrics.yakitDegisimYuzdesi)} {metrics.comparisonLabel}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] items-start gap-4">
                <div ref={calendarCardRef}>
                    <DeadlineCalendar events={calendarEvents} compact />
                </div>

                <Card
                    className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl flex flex-col overflow-hidden"
                    style={calendarCardHeight ? { height: calendarCardHeight } : undefined}
                >
                    <CardHeader className="pb-2 px-5 pt-5">
                        <button
                            type="button"
                            onClick={() => navigateWithScope("/dashboard/evrak-takip")}
                            className="inline-flex items-center gap-2 text-left text-sm font-semibold text-slate-900 transition-colors hover:text-amber-700 cursor-pointer"
                            aria-label="Evrak Takibi sayfasını aç"
                            title="Evrak Takibi"
                        >
                            <AlertTriangle size={15} className="text-amber-600" />
                            <CardTitle className="text-sm font-semibold">Evrak Takibi</CardTitle>
                        </button>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 pt-1 flex-1 min-h-0 flex flex-col gap-4">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-2">
                                <p className="text-[11px] text-rose-600 font-medium">Geciken</p>
                                <p className="text-lg font-bold text-rose-700">{riskSummary.gecikti}</p>
                            </div>
                            <div className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-2">
                                <p className="text-[11px] text-orange-600 font-medium">Kritik</p>
                                <p className="text-lg font-bold text-orange-700">{riskSummary.kritik}</p>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2">
                                <p className="text-[11px] text-amber-700 font-medium">Yaklaşan</p>
                                <p className="text-lg font-bold text-amber-700">{riskSummary.yaklasti}</p>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col gap-3">
                            <div className="flex flex-col">
                                <p className="text-xs font-semibold text-slate-500 mb-2">Acil Aksiyon Gerektirenler</p>
                                <div className="space-y-2 overflow-y-auto pr-1 max-h-[172px]">
                                    {alerts.length > 0 ? (
                                        alerts.map((alert) => {
                                            const days = calculateDays(alert.tarih);
                                            return (
                                                <button
                                                    type="button"
                                                    key={alert.id}
                                                    onClick={() => navigateWithScope(`/dashboard/araclar/${alert.aracId}`)}
                                                    className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
                                                >
                                                    <p className="text-xs font-mono font-semibold text-slate-900">{alert.plaka}</p>
                                                    <p className={`text-[11px] font-semibold mt-0.5 ${days < 0 ? "text-rose-600" : "text-amber-600"}`}>
                                                        {alert.message} ({days < 0 ? `${Math.abs(days)} gün geçti` : `${days} gün`})
                                                    </p>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 text-center">
                                            Şu an acil aksiyon gerektiren kayıt yok.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 flex flex-col pt-2 border-t border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 mb-2">Yaklaşan İşler</p>
                                <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
                                    {upcomingEvents.length > 0 ? (
                                        upcomingEvents.map((event) => (
                                            <button
                                                key={event.id}
                                                onClick={() =>
                                                    event.aracId
                                                        ? navigateWithScope(`/dashboard/araclar/${event.aracId}`)
                                                        : navigateWithScope(event.href)
                                                }
                                                className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
                                            >
                                                <p className="text-[11px] text-slate-500">
                                                    {EVENT_TYPE_LABEL[event.type]} • {event.daysLeft === 0 ? "Bugün" : `${event.daysLeft} gün`}
                                                </p>
                                                <p className="text-xs font-semibold text-slate-900 mt-0.5">
                                                    {event.plaka} - {event.title}
                                                </p>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 text-center">
                                            Yaklaşan planlı iş bulunmuyor.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl h-full">
                        <CardHeader className="pb-1 px-5 pt-5 min-h-[84px]">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                Yıl Bazlı Kategori Dağılımı ({selectedYil || new Date().getFullYear()})
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                Toplam: ₺{yearlyPieTotal.toLocaleString("tr-TR")}
                            </p>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-2 flex flex-col">
                            <div className="h-[260px]">
                                {yearlyPieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                                formatter={(value, name) => [`₺${Number(value ?? 0).toLocaleString('tr-TR')}`, String(name)]}
                                            />
                                            <Pie data={yearlyPieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={108} paddingAngle={2}>
                                                {yearlyPieData.map((item) => (
                                                    <Cell key={`year-${item.key}`} fill={item.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                                        Seçili yıl için kategori verisi yok.
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 min-h-[42px] flex flex-wrap gap-2 content-start">
                                {yearlyPieData.map((item) => (
                                    <div key={`legend-year-${item.key}`} className="inline-flex w-auto max-w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-slate-600 items-center gap-2 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                            {item.name}
                                        </span>
                                        <span className="font-semibold text-slate-800">₺{item.value.toLocaleString('tr-TR')}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl h-full">
                        <CardHeader className="pb-1 px-5 pt-5 min-h-[84px]">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                Ay Bazlı Kategori Dağılımı
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                {selectedMonthRow?.name || "-"} toplamı: ₺{monthlyPieTotal.toLocaleString("tr-TR")}
                            </p>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-2 flex flex-col">
                            <div className="h-[260px]">
                                {monthlyPieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                                formatter={(value, name) => [`₺${Number(value ?? 0).toLocaleString('tr-TR')}`, String(name)]}
                                            />
                                            <Pie data={monthlyPieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={108} paddingAngle={2}>
                                                {monthlyPieData.map((item) => (
                                                    <Cell key={`month-${item.key}`} fill={item.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                                        Seçili ay için kategori verisi yok.
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 min-h-[42px] flex flex-wrap gap-2 content-start">
                                {monthlyPieData.map((item) => (
                                    <div key={`legend-month-${item.key}`} className="inline-flex w-auto max-w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-slate-600 items-center gap-2 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                            {item.name}
                                        </span>
                                        <span className="font-semibold text-slate-800">₺{item.value.toLocaleString('tr-TR')}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-1 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                Araç Bazlı Toplam Maliyet (Top 10)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-2 pb-4 pt-2 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vehicleCostReport} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#F1F5F9" />
                                    <XAxis
                                        dataKey="plaka"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#0F172A', fontWeight: 600 }}
                                    />
                                    <YAxis
                                        type="number"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748B' }}
                                        tickFormatter={(val) => `₺${Math.round(Number(val) / 1000)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                        formatter={(value, name) => [`₺${Number(value ?? 0).toLocaleString('tr-TR')}`, String(name)]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                                    {vehicleStackCategories.map((category, index) => (
                                        <Bar
                                            key={`vehicle-cost-${category.key}`}
                                            dataKey={category.key}
                                            name={category.label}
                                            stackId="arac"
                                            fill={category.color}
                                            radius={index === vehicleStackCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                            maxBarSize={48}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-1 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                Şoför Bazlı Maliyet (Ceza + Yakıt + Arıza)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-2 pb-4 pt-2 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={driverCostReport} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#F1F5F9" />
                                    <XAxis
                                        dataKey="adSoyad"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 600 }}
                                        interval={0}
                                    />
                                    <YAxis
                                        type="number"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748B' }}
                                        tickFormatter={(val) => `₺${Math.round(Number(val) / 1000)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                        formatter={(value, name) => [`₺${Number(value ?? 0).toLocaleString('tr-TR')}`, String(name)]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                                    <Bar dataKey="yakit" name="Yakıt" stackId="sofor" fill="#22C55E" radius={[0, 0, 0, 0]} maxBarSize={42} />
                                    <Bar dataKey="ariza" name="Arıza" stackId="sofor" fill="#F59E0B" radius={[0, 0, 0, 0]} maxBarSize={42} />
                                    <Bar dataKey="ceza" name="Ceza" stackId="sofor" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={42} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>

        </div>
    );
}
