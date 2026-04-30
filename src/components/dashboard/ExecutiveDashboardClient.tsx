"use client";

import React, { useMemo } from "react";
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    CalendarClock,
    Car,
    CircleGauge,
    Fuel,
    Landmark,
    ShieldAlert,
    TrendingUp,
    Truck,
    Wallet,
} from "lucide-react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RiskStatus = "Normal" | "Dikkat" | "Kritik";

type KpiItem = {
    title: string;
    value: string;
    description: string;
    change: number;
    icon: React.ElementType;
};

type VehicleCostRow = {
    plate: string;
    status: string;
    company: string;
    fuelCost: number;
    fuelLitre: number;
    km: number;
    average: number;
    monthlyCost: number;
    risk: RiskStatus;
};

const fuelTrend = [
    { month: "Kas", cost: 1250000, litre: 31900, average: 8.1 },
    { month: "Ara", cost: 1325000, litre: 33400, average: 8.4 },
    { month: "Oca", cost: 1410000, litre: 35150, average: 8.7 },
    { month: "Şub", cost: 1395000, litre: 34300, average: 8.5 },
    { month: "Mar", cost: 1520000, litre: 36600, average: 9.1 },
    { month: "Nis", cost: 1680000, litre: 39200, average: 9.4 },
];

const topFuelVehicles = [
    { plate: "16 BFA 042", litre: 4920, cost: 219000 },
    { plate: "16 BR 118", litre: 4380, cost: 194000 },
    { plate: "16 BKS 771", litre: 3920, cost: 176000 },
    { plate: "16 BRT 905", litre: 3510, cost: 158000 },
    { plate: "16 FLY 016", litre: 3180, cost: 143000 },
];

const vehicleCostRows: VehicleCostRow[] = [
    { plate: "16 BFA 042", status: "Aktif", company: "Bera İnşaat", fuelCost: 219000, fuelLitre: 4920, km: 18320, average: 26.9, monthlyCost: 286000, risk: "Kritik" },
    { plate: "16 BR 118", status: "Aktif", company: "Bera Beton", fuelCost: 194000, fuelLitre: 4380, km: 17110, average: 25.6, monthlyCost: 247500, risk: "Dikkat" },
    { plate: "16 BKS 771", status: "Serviste", company: "Bera İnşaat", fuelCost: 176000, fuelLitre: 3920, km: 15680, average: 25.0, monthlyCost: 232000, risk: "Dikkat" },
    { plate: "16 BRT 905", status: "Aktif", company: "Saha Operasyon", fuelCost: 158000, fuelLitre: 3510, km: 14800, average: 23.7, monthlyCost: 198000, risk: "Normal" },
    { plate: "16 FLY 016", status: "Aktif", company: "Bera Lojistik", fuelCost: 143000, fuelLitre: 3180, km: 13920, average: 22.8, monthlyCost: 181000, risk: "Normal" },
    { plate: "16 BYK 224", status: "Yedek", company: "Bera Beton", fuelCost: 92000, fuelLitre: 2050, km: 8900, average: 23.0, monthlyCost: 128000, risk: "Normal" },
];

const criticalItems = [
    { type: "Muayene", plate: "16 BFA 042", date: "03 May 2026", days: 4, severity: "Kritik" as RiskStatus },
    { type: "Trafik Sigortası", plate: "16 BR 118", date: "07 May 2026", days: 8, severity: "Kritik" as RiskStatus },
    { type: "Kasko", plate: "16 BKS 771", date: "12 May 2026", days: 13, severity: "Dikkat" as RiskStatus },
    { type: "Periyodik Bakım", plate: "16 BRT 905", date: "15 May 2026", days: 16, severity: "Dikkat" as RiskStatus },
    { type: "Ceza/Borç", plate: "16 BYK 224", date: "18 May 2026", days: 19, severity: "Dikkat" as RiskStatus },
    { type: "Muayene", plate: "16 FLY 016", date: "24 May 2026", days: 25, severity: "Normal" as RiskStatus },
    { type: "Bakım", plate: "16 BHD 310", date: "27 May 2026", days: 28, severity: "Normal" as RiskStatus },
    { type: "Trafik Sigortası", plate: "16 BRS 612", date: "31 May 2026", days: 32, severity: "Normal" as RiskStatus },
    { type: "Kasko", plate: "16 BKR 044", date: "04 Haz 2026", days: 36, severity: "Normal" as RiskStatus },
    { type: "Bakım", plate: "16 BTM 803", date: "09 Haz 2026", days: 41, severity: "Normal" as RiskStatus },
];

// TODO: Bu mock tank verisi ikinci adımda YakitTank ve YakitTankHareket tablolarından beslenecek.
const tankRows = [
    { name: "Ana Depo 1", capacity: 40000, current: 28600, estimatedDays: 18, averagePrice: 42.7 },
    { name: "Ana Depo 2", capacity: 40000, current: 21750, estimatedDays: 13, averagePrice: 43.1 },
];

const kpis: KpiItem[] = [
    { title: "Toplam Araç Sayısı", value: "126", description: "Filo envanterindeki kayıtlı araç", change: 3.2, icon: Truck },
    { title: "Aktif Araç Sayısı", value: "108", description: "Operasyonda kullanılan araç", change: 1.8, icon: Car },
    { title: "Bu Ay Yakıt Tutarı", value: "₺1,68M", description: "Nisan 2026 yakıt harcaması", change: 10.5, icon: Wallet },
    { title: "Bu Ay Yakıt Litresi", value: "39.200 L", description: "Toplam tüketilen yakıt", change: 7.1, icon: Fuel },
    { title: "Ort. Yakıt Tüketimi", value: "9,4 L/100", description: "Filonun ortalama tüketimi", change: 4.3, icon: CircleGauge },
    { title: "Yaklaşan Kritik İşlem", value: "18", description: "45 gün içinde takip gerektiren işlem", change: -6.4, icon: CalendarClock },
    { title: "Tahmini Toplam Gider", value: "₺2,42M", description: "Yakıt, bakım, ceza ve operasyon", change: 8.6, icon: Landmark },
    { title: "Araç Başına Gider", value: "₺19.200", description: "Bu ay araç başına ortalama", change: 5.2, icon: BarChart3 },
];

function formatCurrency(value: number) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value);
}

function riskClass(risk: RiskStatus) {
    if (risk === "Kritik") return "border-rose-200 bg-rose-50 text-rose-700";
    if (risk === "Dikkat") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function KpiCard({ item }: { item: KpiItem }) {
    const Icon = item.icon;
    const positive = item.change >= 0;
    return (
        <Card className="border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{item.title}</p>
                        <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                        <Icon size={18} />
                    </div>
                </div>
                <p className="mt-3 min-h-9 text-sm leading-5 text-slate-500">{item.description}</p>
                <div className={cn("mt-4 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold", positive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>
                    {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(item.change).toLocaleString("tr-TR")}%
                    <span className="font-medium text-slate-500">önceki aya göre</span>
                </div>
            </CardContent>
        </Card>
    );
}

function ExecutiveTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
            <p className="mb-1 font-semibold text-slate-900">{label}</p>
            {payload.map((item: any) => (
                <p key={item.dataKey} className="text-slate-600">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}: {item.dataKey === "cost" ? formatCurrency(item.value) : formatNumber(item.value)}
                </p>
            ))}
        </div>
    );
}

export default function ExecutiveDashboardClient() {
    const totalFuelCost = fuelTrend[fuelTrend.length - 1]?.cost || 0;
    const abnormalVehicles = vehicleCostRows.filter((row) => row.average > 25);
    const highestCostVehicle = [...vehicleCostRows].sort((a, b) => b.monthlyCost - a.monthlyCost)[0];
    const highestRiskVehicle = vehicleCostRows.find((row) => row.risk === "Kritik") || highestCostVehicle;
    const averageConsumption = fuelTrend[fuelTrend.length - 1]?.average || 0;
    const criticalCount = criticalItems.filter((item) => item.severity !== "Normal").length;

    const executiveInsights = useMemo(
        () => [
            `Bu ay yakıt maliyeti geçen aya göre %10,5 arttı ve ${formatCurrency(totalFuelCost)} seviyesine çıktı.`,
            `${abnormalVehicles.length} araç normalin üzerinde yakıt tüketiyor; ilk kontrol ${abnormalVehicles[0]?.plate || "listede yok"} için önerilir.`,
            `${criticalCount} aracın sigorta, kasko, muayene veya bakım süresi yaklaşıyor.`,
            `En yüksek maliyetli araç: ${highestCostVehicle.plate} (${formatCurrency(highestCostVehicle.monthlyCost)}).`,
            `En riskli araç: ${highestRiskVehicle.plate}; risk durumu ${highestRiskVehicle.risk}.`,
        ],
        [abnormalVehicles, criticalCount, highestCostVehicle, highestRiskVehicle, totalFuelCost]
    );

    return (
        <main className="min-h-screen bg-[#F6F8FB] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
                <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_34px_rgba(15,23,42,0.06)] lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">CEO Dashboard</Badge>
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Mock veri</Badge>
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950 lg:text-3xl">Filo Operasyon ve Maliyet Karar Merkezi</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                            Yönetim ekibi için filo karlılığı, yakıt maliyeti, operasyonel risk ve kritik takiplerin tek bakışta izlenebileceği ana ekran.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                        <div className="min-w-24">
                            <p className="text-xs text-slate-500">Dönem</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">Nisan 2026</p>
                        </div>
                        <div className="min-w-24 border-x border-slate-200 px-3">
                            <p className="text-xs text-slate-500">Filo Sağlığı</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-700">%86</p>
                        </div>
                        <div className="min-w-24">
                            <p className="text-xs text-slate-500">Risk</p>
                            <p className="mt-1 text-sm font-semibold text-amber-700">Orta</p>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpis.map((item) => (
                        <KpiCard key={item.title} item={item} />
                    ))}
                </section>

                <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <Card className="border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                        <CardHeader className="px-5 pt-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <CardTitle className="text-base font-semibold text-slate-950">Yönetici Özeti</CardTitle>
                                    <p className="mt-1 text-sm text-slate-500">Rule-based içgörü alanı. AI entegrasyonu sonraki adımda bağlanacak.</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700">
                                    <TrendingUp size={18} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-5 pb-5">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                {executiveInsights.map((insight, index) => (
                                    <div key={insight} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-xs font-semibold text-slate-700 shadow-sm">{index + 1}</span>
                                        <p className="text-sm leading-6 text-slate-700">{insight}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-[#E2E8F0] bg-slate-950 text-white shadow-[0_8px_28px_rgba(15,23,42,0.08)]">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-slate-300">Ortalama L/100 km</p>
                                    <p className="mt-2 text-4xl font-semibold">{averageConsumption.toLocaleString("tr-TR")}</p>
                                </div>
                                <CircleGauge className="text-blue-200" size={28} />
                            </div>
                            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-blue-300" style={{ width: `${Math.min(averageConsumption * 8, 100)}%` }} />
                            </div>
                            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-start gap-3">
                                    <ShieldAlert className="mt-0.5 text-amber-300" size={18} />
                                    <div>
                                        <p className="text-sm font-semibold">Normal dışı tüketim uyarısı</p>
                                        <p className="mt-1 text-sm leading-5 text-slate-300">
                                            {abnormalVehicles.length} araç eşik üstünde. Şantiye ve ağır vasıta kullanım rotaları ayrıca incelenmeli.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                    <Card className="xl:col-span-2 border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                        <CardHeader className="px-5 pt-5">
                            <CardTitle className="text-base font-semibold text-slate-950">Yakıt Analizi</CardTitle>
                            <p className="text-sm text-slate-500">Aylık yakıt maliyeti, litre trendi ve tüketim ortalaması</p>
                        </CardHeader>
                        <CardContent className="px-3 pb-5">
                            <div className="h-[330px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={fuelTrend} margin={{ top: 16, right: 18, left: 6, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                                        <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(value) => `₺${Number(value) / 1000000}M`} />
                                        <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(value) => `${Number(value) / 1000}K L`} />
                                        <Tooltip content={<ExecutiveTooltip />} />
                                        <Bar yAxisId="left" dataKey="cost" name="Yakıt maliyeti" fill="#1D4ED8" radius={[8, 8, 0, 0]} barSize={34} />
                                        <Line yAxisId="right" type="monotone" dataKey="litre" name="Litre" stroke="#0F766E" strokeWidth={3} dot={{ r: 4, fill: "#0F766E" }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                        <CardHeader className="px-5 pt-5">
                            <CardTitle className="text-base font-semibold text-slate-950">En Çok Yakıt Tüketen 5 Araç</CardTitle>
                            <p className="text-sm text-slate-500">Litre bazlı aylık sıralama</p>
                        </CardHeader>
                        <CardContent className="px-5 pb-5">
                            <div className="space-y-4">
                                {topFuelVehicles.map((item, index) => {
                                    const max = topFuelVehicles[0]?.litre || 1;
                                    return (
                                        <div key={item.plate}>
                                            <div className="mb-1 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-700">{index + 1}</span>
                                                    <span className="text-sm font-semibold text-slate-900">{item.plate}</span>
                                                </div>
                                                <span className="text-sm text-slate-600">{formatNumber(item.litre)} L</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                <div className="h-full rounded-full bg-blue-700" style={{ width: `${(item.litre / max) * 100}%` }} />
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">{formatCurrency(item.cost)} yakıt maliyeti</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.82fr]">
                    <Card className="border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                        <CardHeader className="px-5 pt-5">
                            <CardTitle className="text-base font-semibold text-slate-950">Araç Karlılık / Maliyet Tablosu</CardTitle>
                            <p className="text-sm text-slate-500">Mock maliyet görünümü. Gerçek hesaplar ikinci adımda Prisma servislerine bağlanacak.</p>
                        </CardHeader>
                        <CardContent className="px-5 pb-5">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                                        <TableHead>Plaka</TableHead>
                                        <TableHead>Araç Durumu</TableHead>
                                        <TableHead>Kullanıcı Firma</TableHead>
                                        <TableHead className="text-right">Yakıt Tutarı</TableHead>
                                        <TableHead className="text-right">Litre</TableHead>
                                        <TableHead className="text-right">KM</TableHead>
                                        <TableHead className="text-right">L/100 KM</TableHead>
                                        <TableHead className="text-right">Aylık Gider</TableHead>
                                        <TableHead>Risk</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vehicleCostRows.map((row) => (
                                        <TableRow key={row.plate}>
                                            <TableCell className="font-semibold text-slate-900">{row.plate}</TableCell>
                                            <TableCell>{row.status}</TableCell>
                                            <TableCell>{row.company}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.fuelCost)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(row.fuelLitre)}</TableCell>
                                            <TableCell className="text-right">{formatNumber(row.km)}</TableCell>
                                            <TableCell className="text-right">{row.average.toLocaleString("tr-TR")}</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(row.monthlyCost)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("rounded-md", riskClass(row.risk))}>{row.risk}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <Card className="border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                        <CardHeader className="px-5 pt-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base font-semibold text-slate-950">Yaklaşan Kritik İşlemler</CardTitle>
                                    <p className="text-sm text-slate-500">En yakın 10 takip kalemi</p>
                                </div>
                                <AlertTriangle className="text-amber-600" size={20} />
                            </div>
                        </CardHeader>
                        <CardContent className="px-5 pb-5">
                            <div className="space-y-2">
                                {criticalItems.map((item) => (
                                    <div key={`${item.type}-${item.plate}-${item.date}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">{item.type} · {item.plate}</p>
                                            <p className="text-xs text-slate-500">{item.date} · {item.days} gün kaldı</p>
                                        </div>
                                        <Badge variant="outline" className={cn("rounded-md", riskClass(item.severity))}>{item.severity}</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                    <Card className="border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                        <CardHeader className="px-5 pt-5">
                            <CardTitle className="text-base font-semibold text-slate-950">Tank / Depo Göstergesi</CardTitle>
                            <p className="text-sm text-slate-500">2 adet 40.000 litrelik yakıt tankı için operasyon görünümü</p>
                        </CardHeader>
                        <CardContent className="px-5 pb-5">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {tankRows.map((tank) => {
                                    const fillRate = Math.round((tank.current / tank.capacity) * 100);
                                    return (
                                        <div key={tank.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{tank.name}</p>
                                                    <p className="text-xs text-slate-500">Kapasite: {formatNumber(tank.capacity)} L</p>
                                                </div>
                                                <Fuel className="text-blue-700" size={19} />
                                            </div>
                                            <div className="mt-4 flex items-end justify-between">
                                                <p className="text-2xl font-semibold text-slate-950">{formatNumber(tank.current)} L</p>
                                                <p className="text-sm font-semibold text-blue-700">%{fillRate}</p>
                                            </div>
                                            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
                                                <div className="h-full rounded-full bg-blue-700" style={{ width: `${fillRate}%` }} />
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <p className="text-xs text-slate-500">Tahmini kalan gün</p>
                                                    <p className="mt-1 font-semibold text-slate-900">{tank.estimatedDays} gün</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500">Ortalama alış</p>
                                                    <p className="mt-1 font-semibold text-slate-900">{formatCurrency(tank.averagePrice)}/L</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-xs text-slate-500">Tanktaki yakıt maliyeti</p>
                                                    <p className="mt-1 font-semibold text-slate-900">{formatCurrency(tank.current * tank.averagePrice)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-[#E2E8F0] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
                        <CardHeader className="px-5 pt-5">
                            <CardTitle className="text-base font-semibold text-slate-950">Aylık Litre Trend Grafiği</CardTitle>
                            <p className="text-sm text-slate-500">Litre ve ortalama tüketim birlikte izlenir</p>
                        </CardHeader>
                        <CardContent className="px-3 pb-5">
                            <div className="h-[275px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={fuelTrend} margin={{ top: 16, right: 16, left: 6, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="litreGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#0F766E" stopOpacity={0.24} />
                                                <stop offset="95%" stopColor="#0F766E" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(value) => `${Number(value) / 1000}K`} />
                                        <Tooltip content={<ExecutiveTooltip />} />
                                        <Area type="monotone" dataKey="litre" name="Yakıt litresi" stroke="#0F766E" strokeWidth={3} fill="url(#litreGradient)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </main>
    );
}
