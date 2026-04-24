"use client"

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { GaugeChart } from "@/components/ui/gauge-chart";

interface DashboardClientProps {
    initialData: DashboardData;
    isTechnicalPersonnel?: boolean;
    recentRecords?: any[];
    role?: string | null;
}

const ARIZA_ONCELIK_LABEL = {
    KRITIK: "Ağır",
    YUKSEK: "Ağır",
    ORTA: "Orta",
    DUSUK: "Hafif",
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
    { key: "ceza", label: "Ceza", color: "#EF4444" },
    { key: "kasko", label: "Kasko", color: "#6366F1" },
    { key: "trafik", label: "Trafik", color: "#06B6D4" },
    { key: "diger", label: "Diğer", color: "#94A3B8" },
] as const;

const COMPANY_COST_BADGE_COLORS: Record<string, string> = {
    yakit: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bakim: "bg-amber-50 text-amber-700 border-amber-200",
    muayene: "bg-sky-50 text-sky-700 border-sky-200",
    ceza: "bg-rose-50 text-rose-700 border-rose-200",
    kasko: "bg-indigo-50 text-indigo-700 border-indigo-200",
    trafik: "bg-cyan-50 text-cyan-700 border-cyan-200",
    diger: "bg-slate-50 text-slate-700 border-slate-200",
};

const DRIVER_COST_BADGE_COLORS: Record<string, string> = {
    yakit: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ceza: "bg-rose-50 text-rose-700 border-rose-200",
};

const DRIVER_CATEGORY_LEGEND = [
    { key: "yakit", label: "Yakıt", color: "#22C55E" },
    { key: "ceza", label: "Ceza", color: "#EF4444" },
] as const;

type ExpenseTrendMode = "GUNLUK" | "HAFTALIK" | "AYLIK";

const EXPENSE_TREND_OPTIONS: Array<{ value: ExpenseTrendMode; label: string }> = [
    { value: "GUNLUK", label: "Günlük" },
    { value: "HAFTALIK", label: "Haftalık" },
    { value: "AYLIK", label: "Aylık" },
];

function getFuelDisplayValue(row: Record<string, unknown> | null | undefined) {
    return Number(row?.yakitLitre ?? row?.yakit ?? 0);
}

function getCategoryDisplayValue(row: Record<string, unknown> | null | undefined, categoryKey: string) {
    if (categoryKey === "yakit" || categoryKey === "yakitLitre") return getFuelDisplayValue(row);
    return Number(row?.[categoryKey] || 0);
}

function getOtherCostDisplayValue(row: Record<string, unknown> | null | undefined) {
    return COST_CATEGORY_LEGEND
        .filter((category) => category.key !== "yakit")
        .reduce((sum, category) => sum + getCategoryDisplayValue(row, category.key), 0);
}

function formatCurrencyValue(value: number) {
    return `₺${Number(value || 0).toLocaleString("tr-TR")}`;
}

function formatLitreValue(value: number) {
    return `${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
}

function normalizeFuelConsumptionUnit(unit: unknown): "LITRE_PER_100_KM" | "LITRE_PER_HOUR" {
    return unit === "LITRE_PER_HOUR" ? "LITRE_PER_HOUR" : "LITRE_PER_100_KM";
}

function getFuelAverageUnitLabel(unit?: "LITRE_PER_100_KM" | "LITRE_PER_HOUR" | null) {
    return unit === "LITRE_PER_HOUR" ? "L/saat" : "L/100 km";
}

function formatFuelAverageValue(
    value: number,
    unit: "LITRE_PER_100_KM" | "LITRE_PER_HOUR" = "LITRE_PER_100_KM"
) {
    return `${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ${getFuelAverageUnitLabel(unit)}`;
}

function formatCategoryValue(categoryKey: string, value: number) {
    return categoryKey === "yakit" || categoryKey === "yakitLitre"
        ? formatLitreValue(value)
        : formatCurrencyValue(value);
}

function getGaugeColorForUsage(percentage: number) {
    if (percentage <= 85) return "#16A34A";
    if (percentage <= 100) return "#F59E0B";
    return "#DC2626";
}

function truncateAxisLabel(value: unknown, maxLength = 12) {
    const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    if (!raw) return "-";
    if (raw.length <= maxLength) return raw;
    return `${raw.slice(0, Math.max(1, maxLength - 3))}...`;
}

function formatDriverAxisLabel(value: unknown) {
    const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    if (!raw) return "-";

    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const firstName = truncateAxisLabel(parts[0], 10);
        const lastNameInitial = parts[parts.length - 1]?.charAt(0)?.toUpperCase() || "";
        const shortName = lastNameInitial ? `${firstName} ${lastNameInitial}.` : firstName;
        if (shortName.length <= 14) return shortName;
    }

    return truncateAxisLabel(raw, 14);
}

export default function DashboardClient({ initialData, isTechnicalPersonnel, recentRecords, role }: DashboardClientProps) {
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedSirketId = searchParams.get("sirket");
    const selectedYil = searchParams.get("yil");
    const selectedAy = searchParams.get("ay");
    const isAllMonthSelected = selectedAy?.trim().toLowerCase() === "all" || selectedAy?.trim().toLowerCase() === "__all__";
    const selectedKategori = searchParams.get("kategori");
    const apiParams = new URLSearchParams();
    if (selectedSirketId) apiParams.set("sirket", selectedSirketId);
    if (selectedYil) apiParams.set("yil", selectedYil);
    if (selectedAy) apiParams.set("ay", selectedAy);
    if (selectedKategori) apiParams.set("kategori", selectedKategori);
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
        weeklyExpenseTrend = [],
        vehicleCostReport = [],
        driverCostReport = [],
        companyCostReport = [],
        vehicleFuelAverageReport = [],
        driverFuelAverageReport = [],
    } = data || {} as any;

    const calendarCardRef = useRef<HTMLDivElement | null>(null);
    const [calendarCardHeight, setCalendarCardHeight] = React.useState<number | null>(null);
    const [fuelAverageMode, setFuelAverageMode] = useState<"ARAC" | "PERSONEL">("ARAC");
    const [expenseTrendMode, setExpenseTrendMode] = useState<ExpenseTrendMode>(isAllMonthSelected ? "AYLIK" : "GUNLUK");

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

    useEffect(() => {
        setExpenseTrendMode((current) => {
            if (isAllMonthSelected) return "AYLIK";
            if (current === "AYLIK" || current === "HAFTALIK" || current === "GUNLUK") return current;
            return "GUNLUK";
        });
    }, [isAllMonthSelected]);

    const yearlyPieData = useMemo(
        () =>
            COST_CATEGORY_LEGEND
                .map((category) => ({
                    key: category.key,
                    name: category.label,
                    color: category.color,
                    value: monthlyExpenseTrend.reduce(
                        (sum: number, row: any) => sum + getCategoryDisplayValue(row, category.key),
                        0
                    ),
                }))
                .filter((item) => item.value > 0),
        [monthlyExpenseTrend]
    );

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
        if (isAllMonthSelected) return yearlyPieData;
        if (!selectedMonthRow) return [];
        return COST_CATEGORY_LEGEND
            .map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: getCategoryDisplayValue(selectedMonthRow, category.key),
            }))
            .filter((item) => item.value > 0);
    }, [isAllMonthSelected, yearlyPieData, selectedMonthRow]);

    const dailyTotalData = useMemo(
        () =>
            dailyExpenseTrend
                .map((row: any) => ({
                    ...row,
                    displayToplam: COST_CATEGORY_LEGEND.reduce(
                        (sum: number, category) => sum + getCategoryDisplayValue(row, category.key),
                        0
                    ),
                }))
                .filter((row: any) => Number(row.displayToplam || 0) > 0),
        [dailyExpenseTrend]
    );
    const weeklyTotalData = useMemo(
        () =>
            weeklyExpenseTrend
                .map((row: any) => ({
                    ...row,
                    displayToplam: COST_CATEGORY_LEGEND.reduce(
                        (sum: number, category) => sum + getCategoryDisplayValue(row, category.key),
                        0
                    ),
                }))
                .filter((row: any) => Number(row.displayToplam || 0) > 0),
        [weeklyExpenseTrend]
    );
    const monthlyTotalData = useMemo(
        () =>
            monthlyExpenseTrend
                .map((row: any) => ({
                    ...row,
                    displayToplam: COST_CATEGORY_LEGEND.reduce(
                        (sum: number, category) => sum + getCategoryDisplayValue(row, category.key),
                        0
                    ),
                }))
                .filter((row: any) => Number(row.displayToplam || 0) > 0),
        [monthlyExpenseTrend]
    );

    const dailyStackCategories = useMemo(
        () =>
            COST_CATEGORY_LEGEND.filter((category) =>
                dailyExpenseTrend.some((row: any) => getCategoryDisplayValue(row, category.key) > 0)
            ),
        [dailyExpenseTrend]
    );
    const weeklyStackCategories = useMemo(
        () =>
            COST_CATEGORY_LEGEND.filter((category) =>
                weeklyExpenseTrend.some((row: any) => getCategoryDisplayValue(row, category.key) > 0)
            ),
        [weeklyExpenseTrend]
    );
    const monthlyStackCategories = useMemo(
        () =>
            COST_CATEGORY_LEGEND.filter((category) =>
                monthlyExpenseTrend.some((row: any) => getCategoryDisplayValue(row, category.key) > 0)
            ),
        [monthlyExpenseTrend]
    );

    const dailyCategorySummary = useMemo(
        () =>
            COST_CATEGORY_LEGEND.map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: dailyExpenseTrend.reduce(
                    (sum: number, row: any) => sum + getCategoryDisplayValue(row, category.key),
                    0
                ),
            })).filter((item) => item.value > 0),
        [dailyExpenseTrend]
    );
    const weeklyCategorySummary = useMemo(
        () =>
            COST_CATEGORY_LEGEND.map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: weeklyExpenseTrend.reduce(
                    (sum: number, row: any) => sum + getCategoryDisplayValue(row, category.key),
                    0
                ),
            })).filter((item) => item.value > 0),
        [weeklyExpenseTrend]
    );
    const monthlyTrendCategorySummary = useMemo(
        () =>
            COST_CATEGORY_LEGEND.map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: monthlyExpenseTrend.reduce(
                    (sum: number, row: any) => sum + getCategoryDisplayValue(row, category.key),
                    0
                ),
            })).filter((item) => item.value > 0),
        [monthlyExpenseTrend]
    );

    const yearlyFuelTotal = useMemo(
        () => yearlyPieData.find((item) => item.key === "yakit")?.value || 0,
        [yearlyPieData]
    );
    const yearlyOtherCostTotal = useMemo(
        () => yearlyPieData.filter((item) => item.key !== "yakit").reduce((sum, item) => sum + item.value, 0),
        [yearlyPieData]
    );
    const monthlyFuelTotal = useMemo(
        () => monthlyPieData.find((item) => item.key === "yakit")?.value || 0,
        [monthlyPieData]
    );
    const monthlyOtherCostTotal = useMemo(
        () => monthlyPieData.filter((item) => item.key !== "yakit").reduce((sum, item) => sum + item.value, 0),
        [monthlyPieData]
    );
    const dailyFuelTotal = useMemo(
        () => dailyCategorySummary.find((item) => item.key === "yakit")?.value || 0,
        [dailyCategorySummary]
    );
    const dailyOtherCostTotal = useMemo(
        () => dailyCategorySummary.filter((item) => item.key !== "yakit").reduce((sum, item) => sum + item.value, 0),
        [dailyCategorySummary]
    );
    const weeklyFuelTotal = useMemo(
        () => weeklyCategorySummary.find((item) => item.key === "yakit")?.value || 0,
        [weeklyCategorySummary]
    );
    const weeklyOtherCostTotal = useMemo(
        () => weeklyCategorySummary.filter((item) => item.key !== "yakit").reduce((sum, item) => sum + item.value, 0),
        [weeklyCategorySummary]
    );
    const monthlyTrendFuelTotal = useMemo(
        () => monthlyTrendCategorySummary.find((item) => item.key === "yakit")?.value || 0,
        [monthlyTrendCategorySummary]
    );
    const monthlyTrendOtherCostTotal = useMemo(
        () => monthlyTrendCategorySummary.filter((item) => item.key !== "yakit").reduce((sum, item) => sum + item.value, 0),
        [monthlyTrendCategorySummary]
    );
    const selectedExpenseTrendData = useMemo(() => {
        if (expenseTrendMode === "HAFTALIK") return weeklyTotalData;
        if (expenseTrendMode === "AYLIK") return monthlyTotalData;
        return dailyTotalData;
    }, [dailyTotalData, expenseTrendMode, monthlyTotalData, weeklyTotalData]);
    const selectedExpenseTrendCategories = useMemo(() => {
        if (expenseTrendMode === "HAFTALIK") return weeklyStackCategories;
        if (expenseTrendMode === "AYLIK") return monthlyStackCategories;
        return dailyStackCategories;
    }, [dailyStackCategories, expenseTrendMode, monthlyStackCategories, weeklyStackCategories]);
    const selectedExpenseTrendSummary = useMemo(() => {
        if (expenseTrendMode === "HAFTALIK") return weeklyCategorySummary;
        if (expenseTrendMode === "AYLIK") return monthlyTrendCategorySummary;
        return dailyCategorySummary;
    }, [dailyCategorySummary, expenseTrendMode, monthlyTrendCategorySummary, weeklyCategorySummary]);
    const selectedExpenseTrendFuelTotal = useMemo(() => {
        if (expenseTrendMode === "HAFTALIK") return weeklyFuelTotal;
        if (expenseTrendMode === "AYLIK") return monthlyTrendFuelTotal;
        return dailyFuelTotal;
    }, [dailyFuelTotal, expenseTrendMode, monthlyTrendFuelTotal, weeklyFuelTotal]);
    const selectedExpenseTrendOtherCostTotal = useMemo(() => {
        if (expenseTrendMode === "HAFTALIK") return weeklyOtherCostTotal;
        if (expenseTrendMode === "AYLIK") return monthlyTrendOtherCostTotal;
        return dailyOtherCostTotal;
    }, [dailyOtherCostTotal, expenseTrendMode, monthlyTrendOtherCostTotal, weeklyOtherCostTotal]);
    const selectedExpenseTrendLabel = useMemo(() => {
        if (expenseTrendMode === "HAFTALIK") return "Haftalık";
        if (expenseTrendMode === "AYLIK") return "Aylık";
        return "Günlük";
    }, [expenseTrendMode]);
    const selectedExpenseTrendEmptyMessage = useMemo(() => {
        if (expenseTrendMode === "HAFTALIK") return "Seçili ay için haftalık gider verisi yok.";
        if (expenseTrendMode === "AYLIK") return "Seçili dönem için aylık gider verisi yok.";
        return "Seçili ay için günlük gider verisi yok.";
    }, [expenseTrendMode]);
    const selectedExpenseTrendPeakByOtherCost = useMemo(() => {
        if (selectedExpenseTrendData.length === 0) return null;
        return selectedExpenseTrendData.reduce((peak: any, row: any) => {
            if (!peak) return row;
            return getOtherCostDisplayValue(row) > getOtherCostDisplayValue(peak) ? row : peak;
        }, null);
    }, [selectedExpenseTrendData]);
    const selectedExpenseTrendAverageFuel = useMemo(() => {
        if (selectedExpenseTrendData.length === 0) return 0;
        const total = selectedExpenseTrendData.reduce((sum: number, row: any) => sum + getFuelDisplayValue(row), 0);
        return total / selectedExpenseTrendData.length;
    }, [selectedExpenseTrendData]);
    const selectedExpenseTrendAverageOtherCost = useMemo(() => {
        if (selectedExpenseTrendData.length === 0) return 0;
        const total = selectedExpenseTrendData.reduce((sum: number, row: any) => sum + getOtherCostDisplayValue(row), 0);
        return total / selectedExpenseTrendData.length;
    }, [selectedExpenseTrendData]);
    const selectedExpenseTrendMaxBarSize = useMemo(() => {
        if (expenseTrendMode === "HAFTALIK") return 34;
        if (expenseTrendMode === "AYLIK") return 40;
        return 20;
    }, [expenseTrendMode]);
    const fleetUtilizationPercent = Number(metrics.verimlilikOrani || 0);
    const utilizationGaugeColor =
        fleetUtilizationPercent >= 85 ? "#16A34A" : fleetUtilizationPercent >= 70 ? "#F59E0B" : "#DC2626";

    const dashboardTotalExpense = Number(metrics.aylikToplamGider || 0);
    
    const dashboardFuelExpense = useMemo(
        () => companyCostReport.reduce((sum: number, row: any) => sum + Number(row?.yakit || 0), 0),
        [companyCostReport]
    );
    const dashboardServiceExpense = useMemo(
        () => companyCostReport.reduce((sum: number, row: any) => sum + Number(row?.bakim || 0), 0),
        [companyCostReport]
    );

    const fuelCostRatioPercent = dashboardTotalExpense > 0 ? (dashboardFuelExpense / dashboardTotalExpense) * 100 : 0;
    const fuelCostRatioGaugeColor = fuelCostRatioPercent > 75 ? "#DC2626" : fuelCostRatioPercent > 60 ? "#F59E0B" : "#16A34A";

    const serviceCostRatioPercent = dashboardTotalExpense > 0 ? (dashboardServiceExpense / dashboardTotalExpense) * 100 : 0;
    const serviceCostRatioGaugeColor = serviceCostRatioPercent > 25 ? "#DC2626" : serviceCostRatioPercent > 15 ? "#F59E0B" : "#16A34A";
    
    const tankOccupancyPercent = metrics.toplamTankKapasite > 0 
        ? (metrics.toplamTankMevcut / metrics.toplamTankKapasite) * 100 
        : 0;
    const tankGaugeColor = tankOccupancyPercent >= 20 ? "#16A34A" : tankOccupancyPercent >= 10 ? "#F59E0B" : "#DC2626";

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
    const vehicleTop10CostReport = useMemo(
        () => sortedVehicleCostReport.slice(0, 10),
        [sortedVehicleCostReport]
    );
    const sortedDriverCostReport = useMemo(
        () => [...driverCostReport].sort((a: any, b: any) => Number(b.toplam || 0) - Number(a.toplam || 0)),
        [driverCostReport]
    );
    const monthlyServiceCost = useMemo(
        () => vehicleCostReport.reduce((sum: number, row: any) => sum + Number(row?.bakim || 0), 0),
        [vehicleCostReport]
    );
    const monthlyServiceVehicleCount = useMemo(
        () => vehicleCostReport.filter((row: any) => Number(row?.bakim || 0) > 0).length,
        [vehicleCostReport]
    );
    const monthlyAverageServiceCost =
        monthlyServiceVehicleCount > 0 ? Math.round(monthlyServiceCost / monthlyServiceVehicleCount) : 0;
    const vehicleStackCategories = useMemo(
        () =>
            COST_CATEGORY_LEGEND.filter((category) =>
                vehicleTop10CostReport.some((row: any) => getCategoryDisplayValue(row, category.key) > 0)
            ),
        [vehicleTop10CostReport]
    );
    const vehicleReportTotal = useMemo(
        () => vehicleCostReport.reduce((sum: number, row: any) => sum + Number(row?.toplam || 0), 0),
        [vehicleCostReport]
    );
    const monthlyVehicleCostCount = useMemo(
        () => vehicleCostReport.filter((row: any) => Number(row?.toplam || 0) > 0).length,
        [vehicleCostReport]
    );
    const monthlyAverageVehicleCost =
        monthlyVehicleCostCount > 0 ? Math.round(vehicleReportTotal / monthlyVehicleCostCount) : 0;
    const vehicleTop10ReportTotal = useMemo(
        () => vehicleTop10CostReport.reduce((sum: number, row: any) => sum + Number(row?.toplam || 0), 0),
        [vehicleTop10CostReport]
    );
    const vehicleCategorySummary = useMemo(
        () =>
            COST_CATEGORY_LEGEND.map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: vehicleTop10CostReport.reduce(
                    (sum: number, row: any) => sum + getCategoryDisplayValue(row, category.key),
                    0
                ),
            })).filter((item) => item.value > 0),
        [vehicleTop10CostReport]
    );
    const vehicleFuelTotal = useMemo(
        () => vehicleCostReport.reduce((sum: number, row: any) => sum + getFuelDisplayValue(row), 0),
        [vehicleCostReport]
    );
    const vehicleTop10FuelTotal = useMemo(
        () => vehicleCategorySummary.find((item) => item.key === "yakit")?.value || 0,
        [vehicleCategorySummary]
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
    const monthlyDriverCostCount = useMemo(
        () => driverCostReport.filter((row: any) => Number(row?.toplam || 0) > 0).length,
        [driverCostReport]
    );
    const monthlyAverageDriverCost =
        monthlyDriverCostCount > 0 ? Math.round(driverReportTotal / monthlyDriverCostCount) : 0;
    const driverCategorySummary = useMemo(
        () =>
            DRIVER_CATEGORY_LEGEND.map((category) => ({
                key: category.key,
                name: category.label,
                color: category.color,
                value: driverTop10CostReport.reduce(
                    (sum: number, row: any) => sum + getCategoryDisplayValue(row, category.key),
                    0
                ),
            })),
        [driverTop10CostReport]
    );
    const driverTop10FuelTotal = useMemo(
        () => driverCategorySummary.find((item) => item.key === "yakit")?.value || 0,
        [driverCategorySummary]
    );
    const companyFuelTotal = useMemo(
        () => companyCostReport.reduce((sum: number, row: any) => sum + getFuelDisplayValue(row), 0),
        [companyCostReport]
    );
    const driverFuelTotal = useMemo(
        () => driverCostReport.reduce((sum: number, row: any) => sum + getFuelDisplayValue(row), 0),
        [driverCostReport]
    );
    const sortedVehicleFuelAverageReport = useMemo(
        () =>
            [...vehicleFuelAverageReport]
                .sort((a: any, b: any) => Number(b.averageLitresPer100Km || 0) - Number(a.averageLitresPer100Km || 0))
                .slice(0, 10),
        [vehicleFuelAverageReport]
    );
    const driverFuelAverageBenchmarkByUnit = useMemo(() => {
        const valuesByUnit = new Map<string, number[]>();
        for (const row of [...driverFuelAverageReport] as any[]) {
            const unit = normalizeFuelConsumptionUnit(row?.consumptionUnit);
            const value = Number(row?.averageLitresPer100Km || 0);
            if (!Number.isFinite(value) || value <= 0) continue;
            const list = valuesByUnit.get(unit) || [];
            list.push(value);
            valuesByUnit.set(unit, list);
        }
        const averagesByUnit = new Map<string, number>();
        for (const [unit, values] of valuesByUnit.entries()) {
            const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
            averagesByUnit.set(unit, average);
        }
        return averagesByUnit;
    }, [driverFuelAverageReport]);
    const driverFuelAverageReportWithBenchmark = useMemo(
        () =>
            [...driverFuelAverageReport].map((row: any) => {
                const unit = normalizeFuelConsumptionUnit(row?.consumptionUnit);
                const ownAverage = Number(row.averageLitresPer100Km || 0);
                const benchmark = Number(row.fleetAverageLitresPer100Km || driverFuelAverageBenchmarkByUnit.get(unit) || 0);
                const isAbove =
                    typeof row.isAboveFleetAverage === "boolean"
                        ? row.isAboveFleetAverage
                        : benchmark > 0 && ownAverage > benchmark;
                return {
                    ...row,
                    consumptionUnit: unit,
                    fleetAverageLitresPer100Km: benchmark,
                    isAboveFleetAverage: isAbove,
                };
            }),
        [driverFuelAverageBenchmarkByUnit, driverFuelAverageReport]
    );
    const selectedFuelAverageRows = useMemo(
        () =>
            fuelAverageMode === "ARAC"
                ? sortedVehicleFuelAverageReport
                : [...driverFuelAverageReportWithBenchmark]
                      .sort((a: any, b: any) => Number(b.averageLitresPer100Km || 0) - Number(a.averageLitresPer100Km || 0))
                      .slice(0, 10),
        [driverFuelAverageReportWithBenchmark, fuelAverageMode, sortedVehicleFuelAverageReport]
    );
    const driverAboveAverageRows = useMemo(
        () =>
            [...driverFuelAverageReportWithBenchmark]
                .filter((row: any) => Boolean(row.isAboveFleetAverage))
                .sort((a: any, b: any) => Number(b.averageLitresPer100Km || 0) - Number(a.averageLitresPer100Km || 0))
                .slice(0, 8),
        [driverFuelAverageReportWithBenchmark]
    );
    const driverAverageStatusById = useMemo(() => {
        const map = new Map<string, { isAbove: boolean; benchmark: number; average: number; consumptionUnit: "LITRE_PER_100_KM" | "LITRE_PER_HOUR" }>();
        for (const row of driverFuelAverageReportWithBenchmark as any[]) {
            const id = String(row?.soforId || "").trim();
            if (!id) continue;
            map.set(id, {
                isAbove: Boolean(row.isAboveFleetAverage),
                benchmark: Number(row.fleetAverageLitresPer100Km || 0),
                average: Number(row.averageLitresPer100Km || 0),
                consumptionUnit: normalizeFuelConsumptionUnit(row?.consumptionUnit),
            });
        }
        return map;
    }, [driverFuelAverageReportWithBenchmark]);
    const selectedFuelAverageSummary = useMemo(() => {
        const count = selectedFuelAverageRows.length;
        if (count === 0) return { count: 0, average: 0 };
        const total = selectedFuelAverageRows.reduce(
            (sum: number, row: any) => sum + Number(row.averageLitresPer100Km || 0),
            0
        );
        return { count, average: total / count };
    }, [selectedFuelAverageRows]);
    const selectedFuelAverageUnit = useMemo(() => {
        const units = Array.from(
            new Set(
                selectedFuelAverageRows
                    .map((row: any) => normalizeFuelConsumptionUnit(row?.consumptionUnit))
                    .filter(Boolean)
            )
        );
        return units.length === 1 ? normalizeFuelConsumptionUnit(units[0]) : null;
    }, [selectedFuelAverageRows]);
    const selectedFuelAverageSummaryText = useMemo(() => {
        if (selectedFuelAverageSummary.count <= 0) return "";
        if (!selectedFuelAverageUnit) {
            return `${Number(selectedFuelAverageSummary.average || 0).toLocaleString("tr-TR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 2,
            })} (karışık birim)`;
        }
        return formatFuelAverageValue(selectedFuelAverageSummary.average, selectedFuelAverageUnit);
    }, [selectedFuelAverageSummary.average, selectedFuelAverageSummary.count, selectedFuelAverageUnit]);
    const fuelAverageChartData = useMemo(() => {
        if (fuelAverageMode === "ARAC") {
            return selectedFuelAverageRows.map((item: any) => ({
                id: item.aracId,
                axisLabel: truncateAxisLabel(item.plaka || "-", 12),
                fullLabel: item.plaka || "-",
                detail: item.markaModel || "-",
                averageLitresPer100Km: Number(item.averageLitresPer100Km || 0),
                intervalCount: Number(item.intervalCount || 0),
                consumptionUnit: normalizeFuelConsumptionUnit(item?.consumptionUnit),
            }));
        }

        return selectedFuelAverageRows.map((item: any) => ({
            id: item.soforId,
            axisLabel: formatDriverAxisLabel(item.adSoyad || "-"),
            fullLabel: item.adSoyad || "Personel",
            detail: "Personel",
            averageLitresPer100Km: Number(item.averageLitresPer100Km || 0),
            intervalCount: Number(item.intervalCount || 0),
            consumptionUnit: normalizeFuelConsumptionUnit(item?.consumptionUnit),
            benchmarkAverageLitresPer100Km:
                Number(
                    item.fleetAverageLitresPer100Km ||
                        driverFuelAverageBenchmarkByUnit.get(normalizeFuelConsumptionUnit(item?.consumptionUnit)) ||
                        0
                ),
            benchmarkConsumptionUnit: normalizeFuelConsumptionUnit(item?.consumptionUnit),
            isAboveAverage: Boolean(item.isAboveFleetAverage),
        }));
    }, [driverFuelAverageBenchmarkByUnit, fuelAverageMode, selectedFuelAverageRows]);

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
            line: `Kaza • ${ARIZA_ONCELIK_LABEL[item.oncelik as keyof typeof ARIZA_ONCELIK_LABEL] || item.oncelik} • ${item.durum === "SERVISTE" ? "Onarımda" : "Bildirildi"}`,
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
            line: `Kaza • ${ARIZA_ONCELIK_LABEL[item.oncelik as keyof typeof ARIZA_ONCELIK_LABEL] || item.oncelik} • ${item.durum === "SERVISTE" ? "Onarımda" : "Bildirildi"}`,
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

    const buildScopedHref = (href: string) => {
        const [path, queryString = ""] = href.split("?");
        const params = new URLSearchParams(queryString);
        if (selectedSirketId && !params.has("sirket")) params.set("sirket", selectedSirketId);
        if (selectedYil && !params.has("yil")) params.set("yil", selectedYil);
        if (selectedAy && !params.has("ay")) params.set("ay", selectedAy);
        const query = params.toString();
        return query ? `${path}?${query}` : path;
    };

    const navigateWithScope = (href: string) => {
        router.push(buildScopedHref(href));
    };

    const navigateFuelAverageDetail = (index: number) => {
        const item = selectedFuelAverageRows[index];
        if (!item) return;

        if (fuelAverageMode === "ARAC") {
            const aracId = String(item?.aracId || "").trim();
            navigateWithScope(aracId ? `/dashboard/araclar/${aracId}` : "/dashboard/araclar");
            return;
        }

        const soforId = String(item?.soforId || "").trim();
        navigateWithScope(soforId ? `/dashboard/personel/${soforId}` : "/dashboard/personel");
    };

    const renderFuelAverageTick = (props: any) => {
        const { x = 0, y = 0, payload, index = -1 } = props;
        const item = selectedFuelAverageRows[index];
        const clickable =
            fuelAverageMode === "ARAC"
                ? Boolean(String(item?.aracId || "").trim())
                : Boolean(String(item?.soforId || "").trim());
        const isAboveAverage =
            fuelAverageMode === "PERSONEL" && Boolean(item?.isAboveFleetAverage || item?.isAboveAverage);

        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={-4}
                    y={0}
                    dy={4}
                    textAnchor="end"
                    fill={isAboveAverage ? "#B91C1C" : clickable ? "#3730A3" : "#0F172A"}
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: clickable ? "pointer" : "default",
                        textDecoration: clickable || isAboveAverage ? "underline" : "none",
                    }}
                    onClick={clickable ? () => navigateFuelAverageDetail(index) : undefined}
                >
                    {String(payload?.value || "-")}
                </text>
            </g>
        );
    };

    const renderOperationTrackingCard = () => (
        <Card
            className="shadow-none border border-[#E2E8F0] bg-white rounded-xl flex flex-col overflow-hidden"
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
                                    Acil evrak veya kaza kaydı yok.
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
                                    Yaklaşan evrak veya kaza takibi yok.
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
                    <Card className=" transition-shadow border-slate-200">
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

                    <Card className=" transition-shadow border-slate-200">
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

                    <Card className=" transition-shadow border-slate-200">
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
                    <Card className=" transition-shadow border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg text-rose-700">
                                <Wrench className="h-5 w-5" />
                                Servis Kaydı Ekle
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-slate-500 mb-6">Yeni bir periyodik bakım veya kaza kaydı oluşturun.</p>
                            <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold" asChild>
                                <Link href="/dashboard/servis-kayitlari?add=true">
                                    İşlem Başlat <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className=" transition-shadow border-slate-200">
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

                    <Card className=" transition-shadow border-slate-200">
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
                            Kazalı: <span className="font-bold text-slate-900">{metrics.arizaliArac}</span>
                        </span>
                    </div>
                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

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
                    className="shadow-none border border-[#E2E8F0] bg-white rounded-xl cursor-pointer transition-all duration-300 hover:border-amber-200 hover:-translate-y-1 hover:shadow-md"
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2 text-slate-500">
                            <p className="text-sm font-medium">Aylık Ortalama Araç Maliyeti</p>
                            <div className="p-1.5 bg-amber-50 rounded-md text-amber-600"><Truck size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">₺{monthlyAverageVehicleCost.toLocaleString("tr-TR")}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-2">
                            Maliyet kaydı bulunan {monthlyVehicleCostCount} araç üzerinden
                        </p>
                        <p className={`text-xs font-medium mt-1 ${getChangeClassName(metrics.aracMaliyetDegisimYuzdesi)}`}>
                            {formatChangeText(metrics.aracMaliyetDegisimYuzdesi)} {metrics.comparisonLabel}
                        </p>
                    </CardContent>
                </Card>

                <Card
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateWithScope("/dashboard/personel?status=PERSONEL")}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateWithScope("/dashboard/personel?status=PERSONEL");
                        }
                    }}
                    className="shadow-none border border-[#E2E8F0] bg-white rounded-xl cursor-pointer transition-all duration-300 hover:border-emerald-200 hover:-translate-y-1 hover:shadow-md"
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-500">Aylık Ortalama Personel Maliyeti</p>
                            <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600"><Users size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">₺{monthlyAverageDriverCost.toLocaleString("tr-TR")}</h3>
                        <p className="text-xs text-slate-500 font-medium mt-2">
                            Maliyet kaydı bulunan {monthlyDriverCostCount} personel üzerinden
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
                    className="shadow-none border border-[#E2E8F0] bg-white rounded-xl cursor-pointer transition-all duration-300 hover:border-indigo-200 hover:-translate-y-1 hover:shadow-md"
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-slate-500">Aylık Ortalama Yakıt Tüketimi</p>
                            <div className="p-1.5 bg-indigo-50 rounded-md text-indigo-600"><Fuel size={16} /></div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900">
                            {Number(metrics.ortalamaYakit || 0).toLocaleString("tr-TR", {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                            })} L/100 km
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-2">
                            Araçların tüketim ortalaması
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
                        onClick={() => navigateWithScope("/dashboard/servis-kayitlari")}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                navigateWithScope("/dashboard/servis-kayitlari");
                            }
                        }}
                        className="shadow-none border border-[#E2E8F0] bg-white rounded-xl cursor-pointer transition-all duration-300 hover:border-emerald-200 hover:-translate-y-1 hover:shadow-md"
                    >
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-sm font-medium text-slate-500">Aylık Ortalama Servis Maliyeti</p>
                                <div className="p-1.5 bg-emerald-50 rounded-md text-emerald-600"><Wrench size={16} /></div>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900">₺{monthlyAverageServiceCost.toLocaleString("tr-TR")}</h3>
                            <p className="text-xs text-slate-500 font-medium mt-2">
                                Servise giden {monthlyServiceVehicleCount} araç üzerinden
                            </p>
                            <p className={`text-xs font-medium mt-1 ${getChangeClassName(metrics.servisMaliyetDegisimYuzdesi)}`}>
                                {formatChangeText(metrics.servisMaliyetDegisimYuzdesi)} {metrics.comparisonLabel}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="shadow-none border border-slate-900 bg-slate-900 text-white rounded-xl flex flex-col justify-between overflow-hidden relative">
                    <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                        <Wallet size={120} />
                    </div>
                    <CardContent className="p-6 flex flex-col h-full justify-between relative z-10">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-slate-800 rounded-md text-emerald-400 border border-slate-700">
                                    <Wallet size={16} />
                                </div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Dönem Toplam Gideri</p>
                            </div>
                            <h3 className="text-4xl font-black text-white tracking-tight">
                                ₺{Number(metrics.aylikToplamGider || 0).toLocaleString("tr-TR")}
                            </h3>
                        </div>
                        <div className="mt-8">
                            <p className={`text-sm font-semibold flex items-center gap-1.5 ${metrics.giderDegisimYuzdesi < 0 ? "text-emerald-400" : metrics.giderDegisimYuzdesi > 0 ? "text-rose-400" : "text-slate-400"}`}>
                                <TrendingUp size={16} /> 
                                {formatChangeText(metrics.giderDegisimYuzdesi)} {metrics.comparisonLabel}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <GaugeChart
                    label="Filo Verimlilik Endeksi"
                    sublabel="Aktif / Toplam Araç Oranı"
                    value={fleetUtilizationPercent}
                    min={0}
                    max={100}
                    valueText={`${Math.round(fleetUtilizationPercent)}%`}
                    helperText={`${metrics.aktifArac || 0} araç aktif (Toplam: ${metrics.toplamArac || 0})`}
                    color={utilizationGaugeColor}
                />

                <GaugeChart
                    label="Yakıt Stok Durumu"
                    sublabel="Tankların Toplam Doluluk Oranı"
                    value={Math.min(100, Math.max(0, tankOccupancyPercent))}
                    min={0}
                    max={100}
                    valueText={`${tankOccupancyPercent.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                    helperText={`${Math.round(metrics.toplamTankMevcut || 0).toLocaleString("tr-TR")} L / ${Math.round(metrics.toplamTankKapasite || 0).toLocaleString("tr-TR")} L`}
                    color={tankGaugeColor}
                    icon={<Fuel size={32} />}
                    onClick={() => navigateWithScope("/dashboard/yakitlar")}
                />

                <GaugeChart
                    label="Yakıt Maliyet Payı"
                    sublabel="Dönem İçi Maliyet Yoğunluğu"
                    value={Math.min(100, Math.max(0, fuelCostRatioPercent))}
                    min={0}
                    max={100}
                    valueText={`${fuelCostRatioPercent.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                    helperText={`Yakıt Gideri: ${formatCurrencyValue(dashboardFuelExpense)}`}
                    color={fuelCostRatioGaugeColor}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] items-start gap-4">
                <div ref={calendarCardRef}>
                    <DeadlineCalendar events={calendarEvents} compact />
                </div>

                {renderOperationTrackingCard()}
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card className="shadow-none border border-[#E2E8F0] bg-white rounded-xl h-full">
                        <CardHeader className="pb-1 px-5 pt-5 min-h-[84px]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <CardTitle className="text-sm font-semibold text-slate-900">
                                        {isAllMonthSelected
                                            ? `Yıl Bazlı Kategori Dağılımı (${selectedYil || new Date().getFullYear()})`
                                            : `${selectedExpenseTrendLabel} Gider Trendi`}
                                    </CardTitle>
                                    <p className="text-xs text-slate-500">
                                        {isAllMonthSelected
                                            ? `Yakıt: ${formatLitreValue(yearlyFuelTotal)} • Diğer gider: ${formatCurrencyValue(yearlyOtherCostTotal)}`
                                            : `Yakıt: ${formatLitreValue(selectedExpenseTrendFuelTotal)} • Diğer gider: ${formatCurrencyValue(selectedExpenseTrendOtherCostTotal)}`}
                                    </p>
                                </div>

                                {!isAllMonthSelected ? (
                                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                                        {EXPENSE_TREND_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setExpenseTrendMode(option.value)}
                                                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                                                    expenseTrendMode === option.value
                                                        ? "bg-white text-slate-900 shadow-sm"
                                                        : "text-slate-500 hover:text-slate-700"
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-2 flex flex-col">
                            <div className="h-[260px]">
                                {isAllMonthSelected ? (
                                    yearlyPieData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart accessibilityLayer={false}>
                                                <Tooltip
                                                    cursor={false}
                                                    contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0" }}
                                                    formatter={(value, name, entry) => {
                                                        const payload =
                                                            entry && typeof entry === "object" && "payload" in entry
                                                                ? (entry as { payload?: Record<string, unknown> }).payload
                                                                : undefined;
                                                        const key = typeof payload?.key === "string" ? payload.key : "";
                                                        return [formatCategoryValue(key, Number(value ?? 0)), String(name)];
                                                    }}
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
                                ) : selectedExpenseTrendData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart accessibilityLayer={false} data={selectedExpenseTrendData} margin={{ top: 10, right: 10, left: 4, bottom: 4 }}>
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
                                                tickFormatter={(val) => Number(val).toLocaleString("tr-TR")}
                                            />
                                            <Tooltip
                                                cursor={false}
                                                contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0" }}
                                                content={({ active, payload, label }) => {
                                                    if (!active || !payload || payload.length === 0) return null;
                                                    const raw = payload[0]?.payload as { rangeLabel?: string } | undefined;
                                                    const fuelTotal = payload.reduce(
                                                        (sum, item) =>
                                                            (String(item.dataKey) === "yakit" || String(item.dataKey) === "yakitLitre")
                                                                ? sum + Number(item.value ?? 0)
                                                                : sum,
                                                        0
                                                    );
                                                    const otherTotal = payload.reduce(
                                                        (sum, item) =>
                                                            (String(item.dataKey) !== "yakit" && String(item.dataKey) !== "yakitLitre")
                                                                ? sum + Number(item.value ?? 0)
                                                                : sum,
                                                        0
                                                    );
                                                    const headerLabel =
                                                        expenseTrendMode === "GUNLUK"
                                                            ? `${String(label || "-")}. gün`
                                                            : expenseTrendMode === "HAFTALIK"
                                                                ? `${String(label || "-")} • ${raw?.rangeLabel || ""}`
                                                                : String(label || "-");

                                                    return (
                                                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                                                            <p className="text-xs font-semibold text-slate-900">{headerLabel}</p>
                                                            <div className="mt-1.5 space-y-1">
                                                                {payload.map((item) => (
                                                                    <div key={`${item.dataKey}`} className="flex items-center justify-between gap-3 text-xs">
                                                                        <span className="font-medium" style={{ color: item.color || "#334155" }}>
                                                                            {String(item.name || item.dataKey || "-")}
                                                                        </span>
                                                                        <span className="font-semibold text-slate-700">
                                                                            {formatCategoryValue(String(item.dataKey || ""), Number(item.value ?? 0))}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {(fuelTotal > 0 || otherTotal > 0) ? (
                                                                <div className="mt-2 border-t border-slate-200 pt-1.5 text-xs font-bold text-slate-900">
                                                                    {fuelTotal > 0 ? `Yakıt: ${formatLitreValue(fuelTotal)}` : null}
                                                                    {fuelTotal > 0 && otherTotal > 0 ? " • " : null}
                                                                    {otherTotal > 0 ? `Diğer: ${formatCurrencyValue(otherTotal)}` : null}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    );
                                                }}
                                            />
                                            {selectedExpenseTrendCategories.map((category, index) => (
                                                <Bar
                                                    key={`expense-trend-${expenseTrendMode}-${category.key}`}
                                                    dataKey={category.key === "yakit" ? "yakitLitre" : category.key}
                                                    name={category.label}
                                                    stackId={expenseTrendMode}
                                                    fill={category.color}
                                                    radius={index === selectedExpenseTrendCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                                    maxBarSize={selectedExpenseTrendMaxBarSize}
                                                />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                                        {selectedExpenseTrendEmptyMessage}
                                    </div>
                                )}
                            </div>
                            <div className="mt-2 min-h-[42px] flex flex-wrap justify-center gap-2 content-center">
                                {(isAllMonthSelected ? yearlyPieData : selectedExpenseTrendSummary).map((item) => (
                                    <div key={`legend-left-${item.key}`} className="inline-flex w-auto max-w-full rounded-md border border-slate-200 px-2 py-1.5 text-[11px] text-slate-600 items-center gap-2 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                            {item.name}
                                        </span>
                                        <span className="font-semibold text-slate-800">{formatCategoryValue(item.key, item.value)}</span>
                                    </div>
                                ))}
                            </div>
                            {!isAllMonthSelected ? (
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <p className="text-[11px] text-slate-500 font-medium">Ortalama Yakıt</p>
                                        <p className="text-sm font-bold text-slate-900">{formatLitreValue(selectedExpenseTrendAverageFuel)}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <p className="text-[11px] text-slate-500 font-medium">Ortalama Diğer Gider</p>
                                        <p className="text-sm font-bold text-slate-900">{formatCurrencyValue(selectedExpenseTrendAverageOtherCost)}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                        <p className="text-[11px] text-slate-500 font-medium">En Yoğun Dönem</p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {selectedExpenseTrendPeakByOtherCost
                                                ? `${selectedExpenseTrendPeakByOtherCost.name} • ${formatCurrencyValue(getOtherCostDisplayValue(selectedExpenseTrendPeakByOtherCost))}`
                                                : "-"}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card className="shadow-none border border-[#E2E8F0] bg-white rounded-xl h-full">
                        <CardHeader className="pb-1 px-5 pt-5 min-h-[84px]">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                Ay Bazlı Kategori Dağılımı
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                {isAllMonthSelected ? "Tümü" : (selectedMonthRow?.name || "-")} • Yakıt: {formatLitreValue(monthlyFuelTotal)} • Diğer gider: {formatCurrencyValue(monthlyOtherCostTotal)}
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
                                                formatter={(value, name, entry) => {
                                                    const payload =
                                                        entry && typeof entry === "object" && "payload" in entry
                                                            ? (entry as { payload?: Record<string, unknown> }).payload
                                                            : undefined;
                                                    const key = typeof payload?.key === "string" ? payload.key : "";
                                                    return [formatCategoryValue(key, Number(value ?? 0)), String(name)];
                                                }}
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
                                        <span className="font-semibold text-slate-800">{formatCategoryValue(item.key, item.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <Card className="shadow-none border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-1 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                Araç Bazlı Toplam Maliyet (Top 10)
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                Yakıt: {formatLitreValue(vehicleTop10FuelTotal)} • Diğer gider: {formatCurrencyValue(vehicleTop10ReportTotal)}
                            </p>
                        </CardHeader>
                        <CardContent className="px-2 pb-4 pt-2 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart accessibilityLayer={false} data={vehicleTop10CostReport} margin={{ top: 10, right: 20, left: 10, bottom: 46 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#F1F5F9" />
                                    <XAxis
                                        dataKey="plaka"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#0F172A', fontWeight: 600 }}
                                        interval={0}
                                        angle={-25}
                                        textAnchor="end"
                                        tickMargin={8}
                                        height={52}
                                        tickFormatter={(value) => truncateAxisLabel(value, 10)}
                                    />
                                    <YAxis
                                        type="number"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748B' }}
                                        tickFormatter={(val) => Number(val).toLocaleString("tr-TR")}
                                    />
                                    <Tooltip
                                        cursor={false}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                        content={({ active, payload, label }) => {
                                            if (!active || !payload || payload.length === 0) return null;
                                            const fuelTotal = payload.reduce(
                                                (sum, item) =>
                                                    (String(item.dataKey) === "yakit" || String(item.dataKey) === "yakitLitre")
                                                        ? sum + Number(item.value ?? 0)
                                                        : sum,
                                                0
                                            );
                                            const otherTotal = payload.reduce(
                                                (sum, item) =>
                                                    (String(item.dataKey) !== "yakit" && String(item.dataKey) !== "yakitLitre")
                                                        ? sum + Number(item.value ?? 0)
                                                        : sum,
                                                0
                                            );
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
                                                                    {formatCategoryValue(String(item.dataKey || ""), Number(item.value ?? 0))}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {(fuelTotal > 0 || otherTotal > 0) ? (
                                                        <div className="mt-2 border-t border-slate-200 pt-1.5 text-xs font-bold text-slate-900">
                                                            {fuelTotal > 0 ? `Yakıt: ${formatLitreValue(fuelTotal)}` : null}
                                                            {fuelTotal > 0 && otherTotal > 0 ? " • " : null}
                                                            {otherTotal > 0 ? `Diğer: ${formatCurrencyValue(otherTotal)}` : null}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        }}
                                    />
                                    {vehicleStackCategories.map((category, index) => (
                                        <Bar
                                            key={`vehicle-cost-${category.key}`}
                                            dataKey={category.key === "yakit" ? "yakitLitre" : category.key}
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
                                    <span className="font-semibold text-slate-800">{formatCategoryValue(item.key, item.value)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="shadow-none border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-1 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">
                                Personel Bazlı Maliyet (Top 10)
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                Yakıt: {formatLitreValue(driverTop10FuelTotal)} • Diğer gider: {formatCurrencyValue(driverTop10ReportTotal)}
                            </p>
                        </CardHeader>
                        <CardContent className="px-2 pb-4 pt-2 h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart accessibilityLayer={false} data={driverTop10CostReport} margin={{ top: 10, right: 20, left: 10, bottom: 72 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#F1F5F9" />
                                    <XAxis
                                        dataKey="adSoyad"
                                        type="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#0F172A', fontWeight: 600 }}
                                        interval={0}
                                        angle={-35}
                                        textAnchor="end"
                                        tickMargin={8}
                                        height={76}
                                        tickFormatter={formatDriverAxisLabel}
                                    />
                                    <YAxis
                                        type="number"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 12, fill: '#64748B' }}
                                        tickFormatter={(val) => Number(val).toLocaleString("tr-TR")}
                                    />
                                    <Tooltip
                                        cursor={false}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                                        formatter={(value, name, entry) => {
                                            const key =
                                                entry && typeof entry === "object" && "dataKey" in entry
                                                    ? String((entry as { dataKey?: unknown }).dataKey || "")
                                                    : "";
                                            return [formatCategoryValue(key, Number(value ?? 0)), String(name)];
                                        }}
                                    />
                                    <Bar dataKey="yakitLitre" name="Yakıt" stackId="sofor" fill="#22C55E" radius={[0, 0, 0, 0]} maxBarSize={42} />
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
                                    <span className="font-semibold text-slate-800">{formatCategoryValue(item.key, item.value)}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {shouldShowVehicleAndDriverCostLists && (
                <div className="space-y-4">
                    <Card className="shadow-none border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-2 px-5 pt-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <CardTitle className="text-sm font-semibold text-slate-900">
                                        Ortalama Yakıt Tüketimi
                                    </CardTitle>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {fuelAverageMode === "ARAC"
                                            ? `Araç bazlı tüketim ortalaması • ${selectedFuelAverageSummary.count} araç`
                                            : `Personel bazlı tüketim ortalaması • ${selectedFuelAverageSummary.count} personel`}
                                        {selectedFuelAverageSummary.count > 0
                                            ? ` • Toplam ortalama: ${selectedFuelAverageSummaryText}`
                                            : ""}
                                        {fuelAverageMode === "PERSONEL" && driverAboveAverageRows.length > 0
                                            ? ` • Ortalama üstü: ${driverAboveAverageRows.length} şoför`
                                            : ""}
                                    </p>
                                </div>

                                <div className="inline-flex items-center gap-2">
                                    <label htmlFor="fuel-average-mode" className="text-xs font-semibold text-slate-500">
                                        Görünüm
                                    </label>
                                    <select
                                        id="fuel-average-mode"
                                        value={fuelAverageMode}
                                        onChange={(event) =>
                                            setFuelAverageMode(event.target.value === "PERSONEL" ? "PERSONEL" : "ARAC")
                                        }
                                        className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-slate-400"
                                    >
                                        <option value="ARAC">Araç</option>
                                        <option value="PERSONEL">Personel</option>
                                    </select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-4 pt-2 h-[360px]">
                            {fuelAverageChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        accessibilityLayer={false}
                                        data={fuelAverageChartData}
                                        layout="vertical"
                                        margin={{ top: 6, right: 20, left: 2, bottom: 6 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                                        <XAxis
                                            type="number"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 12, fill: "#64748B" }}
                                            tickFormatter={(val) => Number(val).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="axisLabel"
                                            axisLine={false}
                                            tickLine={false}
                                            interval={0}
                                            tick={renderFuelAverageTick}
                                            width={125}
                                        />
                                        <Tooltip
                                            cursor={false}
                                            contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0" }}
                                            content={({ active, payload }) => {
                                                if (!active || !payload || payload.length === 0) return null;
                                                const raw = payload[0]?.payload as
                                                    | {
                                                          fullLabel?: string;
                                                          detail?: string;
                                                          averageLitresPer100Km?: number;
                                                          intervalCount?: number;
                                                          consumptionUnit?: "LITRE_PER_100_KM" | "LITRE_PER_HOUR";
                                                          benchmarkAverageLitresPer100Km?: number;
                                                          benchmarkConsumptionUnit?: "LITRE_PER_100_KM" | "LITRE_PER_HOUR";
                                                          isAboveAverage?: boolean;
                                                      }
                                                    | undefined;
                                                const avg = Number(raw?.averageLitresPer100Km || 0);
                                                const intervalCount = Number(raw?.intervalCount || 0);
                                                const benchmark = Number(raw?.benchmarkAverageLitresPer100Km || 0);
                                                const isAboveAverage = Boolean(raw?.isAboveAverage);
                                                const consumptionUnit = normalizeFuelConsumptionUnit(raw?.consumptionUnit);
                                                const benchmarkConsumptionUnit = normalizeFuelConsumptionUnit(
                                                    raw?.benchmarkConsumptionUnit || raw?.consumptionUnit
                                                );

                                                return (
                                                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                                                        <p className="text-xs font-semibold text-slate-900">{raw?.fullLabel || "-"}</p>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">{raw?.detail || "-"}</p>
                                                        <p className="text-xs font-bold text-slate-900 mt-2">
                                                            {formatFuelAverageValue(avg, consumptionUnit)}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500">
                                                            {intervalCount} dolum aralığı
                                                        </p>
                                                        {benchmark > 0 ? (
                                                            <p className="text-[11px] text-slate-500">
                                                                Filo ort: {formatFuelAverageValue(benchmark, benchmarkConsumptionUnit)}
                                                            </p>
                                                        ) : null}
                                                        {isAboveAverage ? (
                                                            <span className="mt-1 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                                                Ortalama Üstü
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Bar
                                            dataKey="averageLitresPer100Km"
                                            name="Ortalama Yakıt"
                                            fill={fuelAverageMode === "ARAC" ? "#4F46E5" : "#059669"}
                                            radius={[0, 4, 4, 0]}
                                            maxBarSize={22}
                                            cursor="pointer"
                                            onClick={(_, index) => navigateFuelAverageDetail(index)}
                                        >
                                            {fuelAverageMode === "PERSONEL"
                                                ? fuelAverageChartData.map((entry: any) => (
                                                      <Cell
                                                          key={`fuel-avg-person-${entry.id}`}
                                                          fill={entry.isAboveAverage ? "#DC2626" : "#059669"}
                                                      />
                                                  ))
                                                : null}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                                    Seçili dönem için ortalama yakıt verisi yok.
                                </div>
                            )}
                            {fuelAverageMode === "PERSONEL" ? (
                                <div className="mt-2 border-t border-slate-200 pt-2">
                                    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Ortalama Üstü Şoförler</p>
                                    {driverAboveAverageRows.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {driverAboveAverageRows.map((row: any) => (
                                                <Link
                                                    key={`above-driver-${row.soforId}`}
                                                    href={buildScopedHref(`/dashboard/personel/${row.soforId}`)}
                                                    className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100"
                                                >
                                                    {row.adSoyad}: {formatFuelAverageValue(
                                                        Number(row.averageLitresPer100Km || 0),
                                                        normalizeFuelConsumptionUnit(row?.consumptionUnit)
                                                    )}
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400">Ortalama üstü şoför bulunmuyor.</p>
                                    )}
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    {shouldShowCompanyCostReport && (
                        <Card className="shadow-none border border-[#E2E8F0] bg-white rounded-xl">
                            <CardHeader className="pb-2 px-5 pt-5">
                                <CardTitle className="text-sm font-semibold text-slate-900">Şirket Bazlı Aylık Gider</CardTitle>
                                <p className="text-xs text-slate-500">
                                    Yakıt: {formatLitreValue(companyFuelTotal)} • Diğer gider: {formatCurrencyValue(companyReportTotal)}
                                </p>
                            </CardHeader>
                            <CardContent className="px-5 pb-5 pt-1">
                                {sortedCompanyCostReport.length > 0 ? (
                                    <div className="space-y-2">
                                        {sortedCompanyCostReport.map((item, index) => (
                                            (() => {
                                                const maliyetKalemleri = [
                                                    { key: "bakim", label: "Servis", tutar: Number(item.bakim || 0) },
                                                    { key: "yakit", label: "Yakıt", tutar: getFuelDisplayValue(item) },
                                                    { key: "muayene", label: "Muayene", tutar: Number(item.muayene || 0) },
                                                    { key: "ceza", label: "Ceza", tutar: Number(item.ceza || 0) },
                                                    { key: "kasko", label: "Kasko", tutar: Number(item.kasko || 0) },
                                                    { key: "trafik", label: "Trafik", tutar: Number(item.trafik || 0) },
                                                    { key: "diger", label: "Diğer", tutar: Number(item.diger || 0) },
                                                ].filter((kalem) => kalem.tutar > 0);
                                                const companyHref = item.sirketId
                                                    ? buildScopedHref(`/dashboard/sirketler?sirket=${item.sirketId}`)
                                                    : buildScopedHref("/dashboard/sirketler");

                                                return (
                                                    <div
                                                        key={`${item.sirketId || "bagimsiz"}-${index}`}
                                                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <Link
                                                                href={companyHref}
                                                                className="text-xs font-medium text-slate-700 truncate pr-2 hover:text-indigo-700 hover:underline underline-offset-2"
                                                            >
                                                                {item.sirketAd}
                                                            </Link>
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
                                                                        {kalem.label}: {kalem.key === "yakit" ? formatLitreValue(kalem.tutar) : formatCurrencyValue(kalem.tutar)}
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
                    <Card className="shadow-none border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-2 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">Araç Bazlı Aylık Gider</CardTitle>
                            <p className="text-xs text-slate-500">
                                Yakıt: {formatLitreValue(vehicleFuelTotal)} • Diğer gider: {formatCurrencyValue(vehicleReportTotal)}
                            </p>
                        </CardHeader>
                        <CardContent className="px-5 pb-5 pt-1">
                            {sortedVehicleCostReport.length > 0 ? (
                                <div className="space-y-2">
                                    {sortedVehicleCostReport.map((item, index) => (
                                        (() => {
                                                const maliyetKalemleri = [
                                                    { key: "bakim", label: "Servis", tutar: Number(item.bakim || 0) },
                                                    { key: "yakit", label: "Yakıt", tutar: getFuelDisplayValue(item) },
                                                { key: "muayene", label: "Muayene", tutar: Number(item.muayene || 0) },
                                                { key: "ceza", label: "Ceza", tutar: Number(item.ceza || 0) },
                                                { key: "kasko", label: "Kasko", tutar: Number(item.kasko || 0) },
                                                { key: "trafik", label: "Trafik", tutar: Number(item.trafik || 0) },
                                                    { key: "diger", label: "Diğer", tutar: Number(item.diger || 0) },
                                                ].filter((kalem) => kalem.tutar > 0);
                                                const vehicleHref = item.aracId
                                                    ? buildScopedHref(`/dashboard/araclar/${item.aracId}`)
                                                    : buildScopedHref("/dashboard/araclar");

                                                return (
                                                    <div
                                                    key={`${item.aracId || item.plaka || "arac"}-${index}`}
                                                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <Link
                                                            href={vehicleHref}
                                                            className="text-xs font-medium text-slate-700 truncate pr-2 hover:text-indigo-700 hover:underline underline-offset-2"
                                                        >
                                                            {item.plaka || "Araç"}
                                                        </Link>
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
                                                                    {kalem.label}: {kalem.key === "yakit" ? formatLitreValue(kalem.tutar) : formatCurrencyValue(kalem.tutar)}
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

                    <Card className="shadow-none border border-[#E2E8F0] bg-white rounded-xl">
                        <CardHeader className="pb-2 px-5 pt-5">
                            <CardTitle className="text-sm font-semibold text-slate-900">Personel Bazlı Aylık Gider</CardTitle>
                            <p className="text-xs text-slate-500">
                                Yakıt: {formatLitreValue(driverFuelTotal)} • Diğer gider: {formatCurrencyValue(driverReportTotal)}
                            </p>
                        </CardHeader>
                        <CardContent className="px-5 pb-5 pt-1">
                            {sortedDriverCostReport.length > 0 ? (
                                <div className="space-y-2">
                                    {sortedDriverCostReport.map((item, index) => (
                                        (() => {
                                            const maliyetKalemleri = [
                                                { key: "yakit", label: "Yakıt", tutar: getFuelDisplayValue(item) },
                                                { key: "ceza", label: "Ceza", tutar: Number(item.ceza || 0) },
                                            ].filter((kalem) => kalem.tutar > 0);
                                            const personId = item.soforId || item.kullaniciId;
                                            const personHref = personId
                                                ? buildScopedHref(`/dashboard/personel/${personId}`)
                                                : buildScopedHref("/dashboard/personel");
                                            const driverFuelState = personId ? driverAverageStatusById.get(String(personId)) : null;

                                            return (
                                                <div
                                                    key={`${item.soforId || item.kullaniciId || item.adSoyad || "personel"}-${index}`}
                                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex min-w-0 items-center gap-1.5">
                                                            <Link
                                                                href={personHref}
                                                                className="text-xs font-medium text-slate-700 truncate pr-1 hover:text-indigo-700 hover:underline underline-offset-2"
                                                            >
                                                                {item.adSoyad || "Personel"}
                                                            </Link>
                                                            {driverFuelState?.isAbove ? (
                                                                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">
                                                                    Ortalama Üstü
                                                                </span>
                                                            ) : null}
                                                        </div>
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
                                                                    {kalem.label}: {kalem.key === "yakit" ? formatLitreValue(kalem.tutar) : formatCurrencyValue(kalem.tutar)}
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
