"use client"

import React, { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import {
    Wallet,
    ArrowRight,
    TrendingUp,
    Wrench,
    Car,
    ClipboardCheck,
    AlertTriangle,
    Truck,
    Users,
    Fuel,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fetcher } from "@/lib/fetcher";
import type { DashboardData } from "@/lib/dashboard-data";
import DeadlineCalendar from "./DeadlineCalendar";
import YeniZimmetShortcut from "./shortcuts/YeniZimmetShortcut";
import YeniAracShortcut from "./shortcuts/YeniAracShortcut";
import YeniPersonelShortcut from "./shortcuts/YeniPersonelShortcut";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

interface DashboardClientProps {
    initialData: DashboardData;
    isTechnicalPersonnel?: boolean;
    recentRecords?: any[];
    role?: string | null;
}

const ARIZA_ONCELIK_LABEL = {
    KRITIK: "Yüksek",
    YUKSEK: "Yüksek",
    ORTA: "Orta",
    DUSUK: "Düşük",
} as const;

const ARIZA_ONCELIK_TONE = {
    KRITIK: "text-orange-700",
    YUKSEK: "text-orange-700",
    ORTA: "text-amber-700",
    DUSUK: "text-slate-700",
} as const;

const EVENT_TYPE_LABEL = {
    TRAFIK: "Trafik",
    KASKO: "Kasko",
    MUAYENE: "Muayene",
    CEZA: "Ceza",
} as const;

const EVENT_STATUS_LABEL = {
    GECIKTI: "Geciken",
    YUKSEK: "Yüksek",
    KRITIK: "Yüksek",
    YAKLASTI: "Yaklaşan",
    PLANLI: "Planlı",
} as const;

const EVENT_STATUS_TONE = {
    GECIKTI: "text-rose-700",
    YUKSEK: "text-orange-700",
    KRITIK: "text-orange-700",
    YAKLASTI: "text-amber-700",
    PLANLI: "text-slate-700",
} as const;

const COST_CATEGORY_LEGEND = [
    { key: "yakit", label: "Yakıt", color: "#22C55E" },
    { key: "bakim", label: "Servis", color: "#F59E0B" },
    { key: "muayene", label: "Muayene", color: "#0EA5E9" },
    { key: "hgs", label: "HGS", color: "#8B5CF6" },
    { key: "ceza", label: "Ceza", color: "#EF4444" },
    { key: "kasko", label: "Kasko", color: "#6366F1" },
    { key: "trafik", label: "Trafik", color: "#06B6D4" },
    { key: "diger", label: "Diğer", color: "#94A3B8" },
] as const;

const COMPANY_COST_BADGE_COLORS: Record<string, string> = {
    yakit: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bakim: "bg-amber-50 text-amber-700 border-amber-200",
    muayene: "bg-sky-50 text-sky-700 border-sky-200",
    hgs: "bg-violet-50 text-violet-700 border-violet-200",
    ceza: "bg-rose-50 text-rose-700 border-rose-200",
    kasko: "bg-indigo-50 text-indigo-700 border-indigo-200",
    trafik: "bg-cyan-50 text-cyan-700 border-cyan-200",
    diger: "bg-slate-50 text-slate-700 border-slate-200",
};

const DRIVER_COST_BADGE_COLORS: Record<string, string> = {
    yakit: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ariza: "bg-amber-50 text-amber-700 border-amber-200",
    ceza: "bg-rose-50 text-rose-700 border-rose-200",
};

const DRIVER_CATEGORY_LEGEND = [
    { key: "yakit", label: "Yakıt", color: "#22C55E" },
    { key: "ariza", label: "Arıza", color: "#F59E0B" },
    { key: "ceza", label: "Ceza", color: "#EF4444" },
] as const;

export default function DashboardClient({ initialData, isTechnicalPersonnel, recentRecords, role }: DashboardClientProps) {
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedSirketId = searchParams.get("sirket");
    const selectedYil = searchParams.get("yil");
    const selectedAy = searchParams.get("ay");
    const isAllMonthSelected = selectedAy?.trim().toLowerCase() === "all" || selectedAy?.trim().toLowerCase() === "__all__";
    const apiParams = new URLSearchParams();
    if (selectedSirketId) apiParams.set("sirket", selectedSirketId);
    if (selectedYil) apiParams.set("yil", selectedYil);
    if (selectedAy) apiParams.set("ay", selectedAy);
    const dashboardApiKey = apiParams.toString() ? `/api/dashboard?${apiParams.toString()}` : "/api/dashboard";

    const { data } = useSWR<DashboardData>(isTechnicalPersonnel ? null : dashboardApiKey, fetcher, {
        refreshInterval: 30000,
        revalidateOnFocus: true,
        shouldRetryOnError: true,
        fallbackData: initialData,
    });

    const {
        metrics = {} as any,
        calendarEvents = [],
        operationSummary = { kritik: 0, yuksek: 0, orta: 0, dusuk: 0, toplam: 0, serviste: 0 },
        operationArizalar = [],
        monthlyExpenseTrend = [],
        dailyExpenseTrend = [],
        vehicleCostReport = [],
        driverCostReport = [],
        companyCostReport = [],
    } = data || {} as any;

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
                value: monthlyExpenseTrend.reduce((sum: number, row: any) => sum + Number(row[category.key] || 0), 0),
            }))
            .filter((item) => item.value > 0);
    }, [monthlyExpenseTrend]);

    const monthForMonthlyPie = useMemo(() => {
        const parsed = Number(selectedAy);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 12) {
            return parsed;
        }
        return new Date().getMonth() + 1;
    }, [selectedAy]);

    const selectedMonthRow = useMemo(() => {
        if (monthlyExpenseTrend.length === 0) return null;
        if (isAllMonthSelected) {
            return monthlyExpenseTrend[monthForMonthlyPie - 1] || monthlyExpenseTrend[monthlyExpenseTrend.length - 1];
        }
        return monthlyExpenseTrend[monthlyExpenseTrend.length - 1];
    }, [isAllMonthSelected, monthForMonthlyPie, monthlyExpenseTrend]);

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

    const dailyTotalData = useMemo(
        () =>
            dailyExpenseTrend
                .map((row: any) => ({ ...row, toplam: Number(row.toplam || 0) }))
                .filter((row: any) => row.toplam > 0),
        [dailyExpenseTrend]
    );

    const dailyStackCategories = useMemo(
        () =>
            COST_CATEGORY_LEGEND.filter((category) =>
                dailyExpenseTrend.some((row: any) => Number(row[category.key] || 0) > 0)
            ),
        [dailyExpenseTrend]
    );

    const dailyCategorySummary = useMemo(
        () =>
            COST_CATEGORY_LEGEND.map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: dailyExpenseTrend.reduce((sum: number, row: any) => sum + Number(row[category.key] || 0), 0),
            })).filter((item) => item.value > 0),
        [dailyExpenseTrend]
    );

    const yearlyPieTotal = useMemo(
        () => yearlyPieData.reduce((sum: number, item: { value: number }) => sum + item.value, 0),
        [yearlyPieData]
    );
    const monthlyPieTotal = useMemo(
        () => monthlyPieData.reduce((sum: number, item: { value: number }) => sum + item.value, 0),
        [monthlyPieData]
    );
    const dailyTotal = useMemo(
        () => dailyTotalData.reduce((sum: number, row: any) => sum + Number(row.toplam || 0), 0),
        [dailyTotalData]
    );
    const isAdminOrYetkili = role === "ADMIN" || role === "YETKILI";
    const shouldShowVehicleAndDriverCostLists = isAdminOrYetkili;
    const shouldShowCompanyCostReport = role === "ADMIN" || (role === "YETKILI" && canAccessAllCompanies);
    const sortedCompanyCostReport = useMemo(
        () => [...companyCostReport].sort((a: any, b: any) => Number(b.toplam || 0) - Number(a.toplam || 0)),
        [companyCostReport]
    );
    const companyReportTotal = useMemo(
        () => companyCostReport.reduce((sum: number, row: any) => sum + Number(row?.toplam || 0), 0),
        [companyCostReport]
    );
    const sortedVehicleCostReport = useMemo(
        () => [...vehicleCostReport].sort((a: any, b: any) => Number(b.toplam || 0) - Number(a.toplam || 0)),
        [vehicleCostReport]
    );
    const sortedDriverCostReport = useMemo(
        () => [...driverCostReport].sort((a: any, b: any) => Number(b.toplam || 0) - Number(a.toplam || 0)),
        [driverCostReport]
    );
    const monthlyServiceCost = Number(selectedMonthRow?.bakim || 0);
    const monthlyAverageServiceCost = metrics.aktifArac > 0 ? Math.round(monthlyServiceCost / metrics.aktifArac) : 0;
    const vehicleStackCategories = useMemo(
        () =>
            COST_CATEGORY_LEGEND.filter((category) =>
                vehicleCostReport.some((row: any) => Number(row[category.key] || 0) > 0)
            ),
        [vehicleCostReport]
    );
    const vehicleReportTotal = useMemo(
        () => vehicleCostReport.reduce((sum: number, row: any) => sum + Number(row?.toplam || 0), 0),
        [vehicleCostReport]
    );
    const vehicleCategorySummary = useMemo(
        () =>
            COST_CATEGORY_LEGEND.map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: vehicleCostReport.reduce((sum: number, row: any) => sum + Number(row?.[category.key] || 0), 0),
            })).filter((item) => item.value > 0),
        [vehicleCostReport]
    );
    const driverTop10CostReport = useMemo(
        () => sortedDriverCostReport.slice(0, 10),
        [sortedDriverCostReport]
    );
    const driverTop10ReportTotal = useMemo(
        () => driverTop10CostReport.reduce((sum: number, row: any) => sum + Number(row?.toplam || 0), 0),
        [driverTop10CostReport]
    );
    const driverReportTotal = useMemo(
        () => driverCostReport.reduce((sum: number, row: any) => sum + Number(row?.toplam || 0), 0),
        [driverCostReport]
    );
    const driverCategorySummary = useMemo(
        () =>
            DRIVER_CATEGORY_LEGEND.map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: driverTop10CostReport.reduce((sum: number, row: any) => sum + Number(row?.[category.key] || 0), 0),
            })),
        [driverTop10CostReport]
    );

    const urgentOperationArizalar = useMemo(
        () => operationArizalar.filter((row: any) => row.oncelik === "KRITIK" || row.oncelik === "YUKSEK").slice(0, 8),
        [operationArizalar]
    );

    const otherOperationArizalar = useMemo(
        () => operationArizalar.filter((row: any) => row.oncelik === "ORTA" || row.oncelik === "DUSUK").slice(0, 8),
        [operationArizalar]
    );
    const yuksekOncelikSayisi = Number(operationSummary.yuksek || 0) + Number(operationSummary.kritik || 0);
    const gecikenOperasyonSayisi = useMemo(
        () => calendarEvents.filter((event: any) => event.status === "GECIKTI").length,
        [calendarEvents]
    );
    const yuksekOperasyonSayisi = useMemo(
        () => calendarEvents.filter((event: any) => event.status === "YUKSEK" || event.status === "KRITIK").length,
        [calendarEvents]
    );
    const yaklasanOperasyonSayisi = useMemo(
        () => calendarEvents.filter((event: any) => event.status === "YAKLASTI").length,
        [calendarEvents]
    );
    const urgentOperationItems = useMemo(() => {
        const urgentEvents = calendarEvents
            .filter((event: any) => event.status === "GECIKTI" || event.status === "YUKSEK" || event.status === "KRITIK")
            .sort((a: any, b: any) => Number(a.daysLeft || 0) - Number(b.daysLeft || 0))
            .map((event: any) => ({
                id: `event-${event.id}`,
                href: event.href,
                plaka: event.plaka,
                line: `${EVENT_TYPE_LABEL[event.type as keyof typeof EVENT_TYPE_LABEL] || event.type} • ${EVENT_STATUS_LABEL[event.status as keyof typeof EVENT_STATUS_LABEL] || event.status}`,
                lineClass: EVENT_STATUS_TONE[event.status as keyof typeof EVENT_STATUS_TONE] || "text-slate-700",
                detail:
                    Number(event.daysLeft) < 0
                        ? `${Math.abs(Number(event.daysLeft))} gün gecikti`
                        : `${Number(event.daysLeft)} gün kaldı`,
            }));

        const urgentArizalar = urgentOperationArizalar.map((item: any) => ({
            id: `ariza-${item.id}`,
            href: "/dashboard/arizalar",
            plaka: item.plaka,
            line: `Arıza • ${ARIZA_ONCELIK_LABEL[item.oncelik as keyof typeof ARIZA_ONCELIK_LABEL] || item.oncelik} • ${item.durum === "SERVISTE" ? "Serviste" : "Açık"}`,
            lineClass: ARIZA_ONCELIK_TONE[item.oncelik as keyof typeof ARIZA_ONCELIK_TONE] || "text-slate-700",
            detail: item.aciklama,
        }));

        return [...urgentEvents, ...urgentArizalar].slice(0, 8);
    }, [calendarEvents, urgentOperationArizalar]);
    const upcomingOperationItems = useMemo(() => {
        const upcomingEvents = calendarEvents
            .filter((event: any) => event.status === "YAKLASTI")
            .sort((a: any, b: any) => Number(a.daysLeft || 0) - Number(b.daysLeft || 0))
            .map((event: any) => ({
                id: `event-${event.id}`,
                href: event.href,
                plaka: event.plaka,
                line: `${EVENT_TYPE_LABEL[event.type as keyof typeof EVENT_TYPE_LABEL] || event.type} • ${EVENT_STATUS_LABEL[event.status as keyof typeof EVENT_STATUS_LABEL] || event.status}`,
                lineClass: EVENT_STATUS_TONE[event.status as keyof typeof EVENT_STATUS_TONE] || "text-slate-700",
                detail: `${Number(event.daysLeft)} gün kaldı`,
            }));

        const otherArizalar = otherOperationArizalar.map((item: any) => ({
            id: `ariza-${item.id}`,
            href: "/dashboard/arizalar",
            plaka: item.plaka,
            line: `Arıza • ${ARIZA_ONCELIK_LABEL[item.oncelik as keyof typeof ARIZA_ONCELIK_LABEL] || item.oncelik} • ${item.durum === "SERVISTE" ? "Serviste" : "Açık"}`,
            lineClass: ARIZA_ONCELIK_TONE[item.oncelik as keyof typeof ARIZA_ONCELIK_TONE] || "text-slate-700",
            detail: item.aciklama,
        }));

        return [...upcomingEvents, ...otherArizalar].slice(0, 8);
    }, [calendarEvents, otherOperationArizalar]);

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

    const renderOperationTrackingCard = () => (
        <Card
            className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl flex flex-col overflow-hidden"
            style={calendarCardHeight ? { height: calendarCardHeight } : undefined}
        >
            <CardHeader className="pb-2 px-5 pt-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <button
                        type="button"
                        onClick={() => navigateWithScope("/dashboard/evrak-takip")}
                        className="inline-flex items-center gap-2 text-left text-sm font-semibold text-slate-900 transition-colors hover:text-rose-700 cursor-pointer"
                        aria-label="Operasyon Takibi sayfasını aç"
                        title="Operasyon Takibi"
                    >
                        <AlertTriangle size={15} className="text-rose-600" />
                        <CardTitle className="text-sm font-semibold">Operasyon Takibi</CardTitle>
                    </button>

                    <div className="grid grid-cols-3 gap-2 sm:min-w-[300px] lg:min-w-[340px]">
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5">
                            <p className="text-[11px] text-rose-600 font-medium">Geciken</p>
                            <p className="text-lg font-bold text-rose-700">{gecikenOperasyonSayisi}</p>
                        </div>
                        <div className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5">
                            <p className="text-[11px] text-orange-600 font-medium">Yüksek</p>
                            <p className="text-lg font-bold text-orange-700">{yuksekOperasyonSayisi + yuksekOncelikSayisi}</p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                            <p className="text-[11px] text-amber-700 font-medium">Yaklaşan</p>
                            <p className="text-lg font-bold text-amber-700">{yaklasanOperasyonSayisi}</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-1 flex-1 min-h-0 flex flex-col gap-2">
                <div className="flex-1 min-h-0 flex flex-col gap-2">
                    <div className="flex flex-col">
                        <p className="text-xs font-semibold text-slate-500 mb-1.5">Acil Aksiyon Gerektirenler</p>
                        <div className="space-y-1.5 overflow-y-auto pr-1 max-h-[132px] md:max-h-[148px]">
                            {urgentOperationItems.length > 0 ? (
                                urgentOperationItems.map((item: any) => (
                                    <button
                                        type="button"
                                        key={item.id}
                                        onClick={() => navigateWithScope(item.href)}
                                        className="w-full text-left rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-mono font-semibold text-slate-900">{item.plaka}</p>
                                            <p className="text-[10px] text-slate-500 whitespace-nowrap">{item.detail}</p>
                                        </div>
                                        <p className={`text-[11px] font-semibold mt-0.5 truncate ${item.lineClass}`}>
                                            {item.line}
                                        </p>
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 text-center">
                                    Acil evrak veya arıza kaydı yok.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 flex flex-col pt-1.5 border-t border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 mb-1.5">Yaklaşan İşler</p>
                        <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
                            {upcomingOperationItems.length > 0 ? (
                                upcomingOperationItems.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => navigateWithScope(item.href)}
                                        className="w-full text-left rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                                    >
                                        <p className="text-xs font-semibold text-slate-900">
                                            {item.plaka}
                                            <span className="text-slate-500 font-medium"> • {item.detail}</span>
                                        </p>
                                        <p className={`text-[11px] mt-0.5 truncate ${item.lineClass}`}>
                                            {item.line}
                                        </p>
                                    </button>
                                ))
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 text-center">
                                    Yaklaşan evrak veya takip arızası yok.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (isTechnicalPersonnel) {
        return (
            <div className="p-4 md:p-6 xl:p-8 pt-4 md:pt-5 xl:pt-6 pb-8 space-y-5 font-sans">
                <div className="flex justify-between items-start lg:items-center flex-col lg:flex-row gap-3">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Teknik Operasyon Paneli</h2>
                        <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">
                            Servis, bakım ve yakıt girişlerinizi kolayca yapabilir, araç durumlarını güncelleyebilirsiniz.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Card className="hover:shadow-md transition-shadow border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg text-indigo-700">
                                <Car className="h-5 w-5" />
                                Yeni Araç
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-500 mb-6">Filoya yeni araç kaydı ekleyin ve şirket/şoför atamasını tek adımda yapın.</p>
                            <YeniAracShortcut className="w-full bg-indigo-600 hover:bg-indigo-700 text-white hover:text-white font-semibold border-0 transition-colors [&_svg]:text-white" />
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg text-emerald-700">
                                <Users className="h-5 w-5" />
                                Yeni Personel
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-500 mb-6">Yeni şoför veya personel kaydı oluşturup operasyon ekibini güncel tutun.</p>
                            <YeniPersonelShortcut className="w-full bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white font-semibold border-0 transition-colors [&_svg]:text-white" />
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg text-amber-700">
                                <ClipboardCheck className="h-5 w-5" />
                                Yeni Zimmet
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-500 mb-6">Araçları personele zimmetleyin, teslim tarihi ve KM bilgilerini kayıt altına alın.</p>
                            <YeniZimmetShortcut className="w-full bg-amber-600 hover:bg-amber-700 text-white hover:text-white font-semibold border-0 transition-colors [&_svg]:text-white" />
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Card className="hover:shadow-md transition-shadow border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg text-rose-700">
                                <Wrench className="h-5 w-5" />
                                Servis Kaydı Ekle
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-500 mb-6">Yeni bir periyodik bakım veya arıza kaydı oluşturun.</p>
                            <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold" asChild>
                                <Link href="/dashboard/bakimlar?add=true">
                                    İşlem Başlat <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
                                <Fuel className="h-5 w-5" />
                                Yakıt Fişi İşle
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-500 mb-6">Araçların günlük/haftalık yakıt alımlarını sisteme girin.</p>
                            <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold" asChild>
                                <Link href="/dashboard/yakitlar?add=true">
                                    İşlem Başlat <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-md transition-shadow border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg text-indigo-700">
                                <Truck className="h-5 w-5" />
                                Araç Durumu Güncelle
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-500 mb-6">Kilometre, konum veya aktiflik durumlarını güncelleyin.</p>
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" asChild>
                                <Link href="/dashboard/araclar">
                                    Araç Listesi <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] items-start gap-4">
                    <div ref={calendarCardRef}>
                        <DeadlineCalendar events={calendarEvents} compact />
                    </div>

                    {renderOperationTrackingCard()}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 xl:p-8 pt-4 md:pt-5 xl:pt-6 space-y-4">
            <div className="flex justify-between items-center flex-col lg:flex-row gap-4">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-none">Filo Operasyon Merkezi</h2>
                        <p className="text-slate-500 text-[12px] max-w-2xl">
                            Günlük operasyon, masraf kontrolü ve son tarih yönetimini tek panelde takip edin.
                        </p>
                    </div>
                    
                    <div className="inline-flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Toplam Araç: <span className="font-bold text-slate-900">{metrics.toplamArac}</span>
                        </span>
                        <span className="w-px h-2 bg-slate-200" />
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Aktif: <span className="font-bold text-slate-900">{metrics.aktifArac}</span>
                        </span>
                        <span className="w-px h-2 bg-slate-200" />
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Serviste: <span className="font-bold text-slate-900">{metrics.servisteArac}</span>
                        </span>
                        <span className="w-px h-2 bg-slate-200" />
                        <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Arızalı: <span className="font-bold text-slate-900">{metrics.arizaliArac}</span>
                        </span>
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {!isAdminOrYetkili && (
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
                )}

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

                <Card 
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateWithScope("/dashboard/yakitlar")}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateWithScope("/dashboard/yakitlar");
                        }
                    }}
                    className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl cursor-pointer transition hover:border-indigo-200 hover:shadow-md"
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-500">Aylık Ortalama Yakıt Maliyeti</p>
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

                {isAdminOrYetkili && (
                    <Card
                        role="button"
                        tabIndex={0}
                        onClick={() => navigateWithScope("/dashboard/bakimlar")}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                navigateWithScope("/dashboard/bakimlar");
                            }
                        }}
                        className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl cursor-pointer transition hover:border-emerald-200 hover:shadow-md"
                    >
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-sm font-medium text-slate-500">Aylık Ortalama Servis Maliyeti</p>
                                <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600"><Wrench size={16} /></div>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900">₺{monthlyAverageServiceCost.toLocaleString("tr-TR")}</h3>
                            <p className="text-xs text-slate-500 font-medium mt-2">
                                Aktif araçlar üzerinden
                            </p>
                            <p className={`text-xs font-medium mt-1 ${getChangeClassName(metrics.servisMaliyetDegisimYuzdesi)}`}>
                                {formatChangeText(metrics.servisMaliyetDegisimYuzdesi)} {metrics.comparisonLabel}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] items-start gap-4">
                <div ref={calendarCardRef}>
                    <DeadlineCalendar events={calendarEvents} compact />
                </div>

                {renderOperationTrackingCard()}
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl h-full">
                        <CardHeader className="pb-1 px-5 pt-5 min-h-[84px]">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                {isAllMonthSelected
                                    ? `Yıl Bazlı Kategori Dağılımı (${selectedYil || new Date().getFullYear()})`
                                    : "Gün Bazlı Gider Dağılımı"}
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                {isAllMonthSelected
                                    ? `Toplam: ₺${yearlyPieTotal.toLocaleString("tr-TR")}`
                                    : `${selectedMonthRow?.name || "-"} toplamı: ₺${dailyTotal.toLocaleString("tr-TR")}`}
                            </p>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-2 flex flex-col">
                            <div className="h-[260px]">
                                {isAllMonthSelected ? (
                                    yearlyPieData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart accessibilityLayer={false}>
                                                <Tooltip
                                                    cursor={false}
                                                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                                    formatter={(value, name) => [`₺${Number(value ?? 0).toLocaleString('tr-TR')}`, String(name)]}
                                                />
                                                <Pie
                                                    data={yearlyPieData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={62}
                                                    outerRadius={108}
                                                    paddingAngle={2}
                                                    rootTabIndex={-1}
                                                >
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
                                    )
                                ) : (
                                    dailyTotalData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart accessibilityLayer={false} data={dailyTotalData} margin={{ top: 10, right: 10, left: 4, bottom: 4 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#F1F5F9" />
                                                <XAxis
                                                    dataKey="name"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 11, fill: "#64748B" }}
                                                    tickFormatter={(val) => `₺${Math.round(Number(val) / 1000)}k`}
                                                />
                                                <Tooltip
                                                    cursor={false}
                                                    contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0" }}
                                                    content={({ active, payload, label }) => {
                                                        if (!active || !payload || payload.length === 0) return null;
                                                        const row = payload[0]?.payload as { toplam?: number } | undefined;
                                                        const total = Number(row?.toplam || 0);
                                                        return (
                                                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                                                                <p className="text-xs font-semibold text-slate-900">{`${String(label || "-")}. gün`}</p>
                                                                <div className="mt-1.5 space-y-1">
                                                                    {payload.map((item) => (
                                                                        <div key={`${item.dataKey}`} className="flex items-center justify-between gap-3 text-xs">
                                                                            <span className="font-medium" style={{ color: item.color || "#334155" }}>
                                                                                {String(item.name || item.dataKey || "-")}
                                                                            </span>
                                                                            <span className="font-semibold text-slate-700">
                                                                                ₺{Number(item.value ?? 0).toLocaleString("tr-TR")}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="mt-2 border-t border-slate-200 pt-1.5 text-xs font-bold text-slate-900">
                                                                    Toplam: ₺{total.toLocaleString("tr-TR")}
                                                                </div>
                                                            </div>
                                                        );
                                                    }}
                                                />
                                                {dailyStackCategories.map((category, index) => (
                                                    <Bar
                                                        key={`daily-cost-${category.key}`}
                                                        dataKey={category.key}
                                                        name={category.label}
                                                        stackId="gunluk"
                                                        fill={category.color}
                                                        radius={index === dailyStackCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                                        maxBarSize={20}
                                                    />
                                                ))}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                                            Seçili ay için günlük gider verisi yok.
                                        </div>
                                    )
                                )}
                            </div>
                            <div className="mt-2 min-h-[42px] flex flex-wrap justify-center gap-2 content-center">
                                {(isAllMonthSelected ? yearlyPieData : dailyCategorySummary).map((item) => (
                                    <div key={`legend-left-${item.key}`} className="inline-flex w-auto max-w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-slate-600 items-center gap-2 whitespace-nowrap">
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
                                        <PieChart accessibilityLayer={false}>
                                            <Tooltip
                                                cursor={false}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                                formatter={(value, name) => [`₺${Number(value ?? 0).toLocaleString('tr-TR')}`, String(name)]}
                                            />
                                            <Pie
                                                data={monthlyPieData}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={62}
                                                outerRadius={108}
                                                paddingAngle={2}
                                                rootTabIndex={-1}
                                            >
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
                            <div className="mt-2 min-h-[42px] flex flex-wrap justify-center gap-2 content-center">
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
                            <p className="text-xs text-slate-500">
                                Toplam: ₺{vehicleReportTotal.toLocaleString("tr-TR")}
                            </p>
                        </CardHeader>
                        <CardContent className="px-2 pb-4 pt-2 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart accessibilityLayer={false} data={vehicleCostReport} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
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
                                        cursor={false}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                        content={({ active, payload, label }) => {
                                            if (!active || !payload || payload.length === 0) return null;
                                            const row = payload[0]?.payload as { toplam?: number } | undefined;
                                            const total = Number(row?.toplam || 0);
                                            return (
                                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                                                    <p className="text-xs font-semibold text-slate-900">{String(label || "-")}</p>
                                                    <div className="mt-1.5 space-y-1">
                                                        {payload.map((item) => (
                                                            <div key={`${item.dataKey}`} className="flex items-center justify-between gap-3 text-xs">
                                                                <span className="font-medium" style={{ color: item.color || "#334155" }}>
                                                                    {String(item.name || item.dataKey || "-")}
                                                                </span>
                                                                <span className="font-semibold text-slate-700">
                                                                    ₺{Number(item.value ?? 0).toLocaleString("tr-TR")}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-2 border-t border-slate-200 pt-1.5 text-xs font-bold text-slate-900">
                                                        Toplam: ₺{total.toLocaleString("tr-TR")}
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
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
                        <div className="px-4 pb-4 pt-0 min-h-[42px] flex flex-wrap justify-center gap-2 content-center">
                            {vehicleCategorySummary.map((item) => (
                                <div key={`legend-vehicle-${item.key}`} className="inline-flex w-auto max-w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-slate-600 items-center gap-2 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        {item.name}
                                    </span>
                                    <span className="font-semibold text-slate-800">₺{item.value.toLocaleString("tr-TR")}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-1 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                Personel Bazlı Maliyet (Top 10)
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                Toplam: ₺{driverTop10ReportTotal.toLocaleString("tr-TR")}
                            </p>
                        </CardHeader>
                        <CardContent className="px-2 pb-4 pt-2 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart accessibilityLayer={false} data={driverTop10CostReport} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
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
                                        cursor={false}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                        formatter={(value, name) => [`₺${Number(value ?? 0).toLocaleString('tr-TR')}`, String(name)]}
                                    />
                                    <Bar dataKey="yakit" name="Yakıt" stackId="sofor" fill="#22C55E" radius={[0, 0, 0, 0]} maxBarSize={42} />
                                    <Bar dataKey="ariza" name="Arıza" stackId="sofor" fill="#F59E0B" radius={[0, 0, 0, 0]} maxBarSize={42} />
                                    <Bar dataKey="ceza" name="Ceza" stackId="sofor" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={42} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                        <div className="px-4 pb-4 pt-0 min-h-[42px] flex flex-wrap justify-center gap-2 content-center">
                            {driverCategorySummary.map((item) => (
                                <div key={`legend-driver-${item.key}`} className="inline-flex w-auto max-w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-slate-600 items-center gap-2 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        {item.name}
                                    </span>
                                    <span className="font-semibold text-slate-800">₺{item.value.toLocaleString("tr-TR")}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {shouldShowVehicleAndDriverCostLists && (
                <div className="space-y-4">
                    {shouldShowCompanyCostReport && (
                        <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                            <CardHeader className="pb-2 px-5 pt-5">
                                <CardTitle className="text-sm font-semibold text-slate-900">Şirket Bazlı Toplam Gider</CardTitle>
                                <p className="text-xs text-slate-500">
                                    Toplam: ₺{companyReportTotal.toLocaleString("tr-TR")}
                                </p>
                            </CardHeader>
                            <CardContent className="px-5 pb-5 pt-1">
                                {sortedCompanyCostReport.length > 0 ? (
                                    <div className="space-y-2">
                                        {sortedCompanyCostReport.map((item, index) => (
                                            (() => {
                                                const maliyetKalemleri = [
                                                    { key: "bakim", label: "Servis", tutar: Number(item.bakim || 0) },
                                                    { key: "yakit", label: "Yakıt", tutar: Number(item.yakit || 0) },
                                                    { key: "muayene", label: "Muayene", tutar: Number(item.muayene || 0) },
                                                    { key: "hgs", label: "HGS", tutar: Number(item.hgs || 0) },
                                                    { key: "ceza", label: "Ceza", tutar: Number(item.ceza || 0) },
                                                    { key: "kasko", label: "Kasko", tutar: Number(item.kasko || 0) },
                                                    { key: "trafik", label: "Trafik", tutar: Number(item.trafik || 0) },
                                                    { key: "diger", label: "Diğer", tutar: Number(item.diger || 0) },
                                                ].filter((kalem) => kalem.tutar > 0);

                                                return (
                                                    <div
                                                        key={`${item.sirketId || "bagimsiz"}-${index}`}
                                                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-xs font-medium text-slate-700 truncate pr-2">
                                                                {item.sirketAd}
                                                            </p>
                                                            <p className="text-sm font-black text-rose-600 whitespace-nowrap">
                                                                ₺{item.toplam.toLocaleString("tr-TR")}
                                                            </p>
                                                        </div>
                                                        {maliyetKalemleri.length > 0 ? (
                                                            <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                                                                {maliyetKalemleri.map((kalem) => (
                                                                    <span
                                                                        key={`${item.sirketId || "bagimsiz"}-${kalem.key}`}
                                                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${COMPANY_COST_BADGE_COLORS[kalem.key] || COMPANY_COST_BADGE_COLORS.diger}`}
                                                                    >
                                                                        {kalem.label}: ₺{kalem.tutar.toLocaleString("tr-TR")}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-1 text-[11px] italic text-slate-400 text-right">Kayıt yok</div>
                                                        )}
                                                    </div>
                                                );
                                            })()
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 text-center">
                                        Seçili dönem için şirket maliyet verisi yok.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-2 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">Araç Bazlı Toplam Gider</CardTitle>
                            <p className="text-xs text-slate-500">
                                Toplam: ₺{vehicleReportTotal.toLocaleString("tr-TR")}
                            </p>
                        </CardHeader>
                        <CardContent className="px-5 pb-5 pt-1">
                            {sortedVehicleCostReport.length > 0 ? (
                                <div className="space-y-2">
                                    {sortedVehicleCostReport.map((item, index) => (
                                        (() => {
                                            const maliyetKalemleri = [
                                                { key: "bakim", label: "Servis", tutar: Number(item.bakim || 0) },
                                                { key: "yakit", label: "Yakıt", tutar: Number(item.yakit || 0) },
                                                { key: "muayene", label: "Muayene", tutar: Number(item.muayene || 0) },
                                                { key: "hgs", label: "HGS", tutar: Number(item.hgs || 0) },
                                                { key: "ceza", label: "Ceza", tutar: Number(item.ceza || 0) },
                                                { key: "kasko", label: "Kasko", tutar: Number(item.kasko || 0) },
                                                { key: "trafik", label: "Trafik", tutar: Number(item.trafik || 0) },
                                                { key: "diger", label: "Diğer", tutar: Number(item.diger || 0) },
                                            ].filter((kalem) => kalem.tutar > 0);

                                            return (
                                                <div
                                                    key={`${item.aracId || item.plaka || "arac"}-${index}`}
                                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-xs font-medium text-slate-700 truncate pr-2">
                                                            {item.plaka || "Araç"}
                                                        </p>
                                                        <p className="text-sm font-black text-rose-600 whitespace-nowrap">
                                                            ₺{Number(item.toplam || 0).toLocaleString("tr-TR")}
                                                        </p>
                                                    </div>
                                                    {maliyetKalemleri.length > 0 ? (
                                                        <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                                                            {maliyetKalemleri.map((kalem) => (
                                                                <span
                                                                    key={`${item.aracId || item.plaka || "arac"}-${kalem.key}`}
                                                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${COMPANY_COST_BADGE_COLORS[kalem.key] || COMPANY_COST_BADGE_COLORS.diger}`}
                                                                >
                                                                    {kalem.label}: ₺{kalem.tutar.toLocaleString("tr-TR")}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 text-[11px] italic text-slate-400 text-right">Kayıt yok</div>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 text-center">
                                    Seçili dönem için araç maliyet verisi yok.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-2 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">Personel Bazlı Toplam Gider</CardTitle>
                            <p className="text-xs text-slate-500">
                                Toplam: ₺{driverReportTotal.toLocaleString("tr-TR")}
                            </p>
                        </CardHeader>
                        <CardContent className="px-5 pb-5 pt-1">
                            {sortedDriverCostReport.length > 0 ? (
                                <div className="space-y-2">
                                    {sortedDriverCostReport.map((item, index) => (
                                        (() => {
                                            const maliyetKalemleri = [
                                                { key: "yakit", label: "Yakıt", tutar: Number(item.yakit || 0) },
                                                { key: "ariza", label: "Arıza", tutar: Number(item.ariza || 0) },
                                                { key: "ceza", label: "Ceza", tutar: Number(item.ceza || 0) },
                                            ].filter((kalem) => kalem.tutar > 0);

                                            return (
                                                <div
                                                    key={`${item.soforId || item.kullaniciId || item.adSoyad || "personel"}-${index}`}
                                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-xs font-medium text-slate-700 truncate pr-2">
                                                            {item.adSoyad || "Personel"}
                                                        </p>
                                                        <p className="text-sm font-black text-rose-600 whitespace-nowrap">
                                                            ₺{Number(item.toplam || 0).toLocaleString("tr-TR")}
                                                        </p>
                                                    </div>
                                                    {maliyetKalemleri.length > 0 ? (
                                                        <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                                                            {maliyetKalemleri.map((kalem) => (
                                                                <span
                                                                    key={`${item.soforId || item.kullaniciId || item.adSoyad || "personel"}-${kalem.key}`}
                                                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${DRIVER_COST_BADGE_COLORS[kalem.key]}`}
                                                                >
                                                                    {kalem.label}: ₺{kalem.tutar.toLocaleString("tr-TR")}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 text-[11px] italic text-slate-400 text-right">Kayıt yok</div>
                                                    )}
                                                </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 text-center">
                                    Seçili dönem için personel maliyet verisi yok.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    </div>
                </div>
            )}

        </div>
    );
}
