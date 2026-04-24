"use client";

import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Fuel, Plus, Truck, User, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import { getColumns as getYakitColumns, type YakitRow } from "../yakitlar/columns";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    createKiralikArac,
    createKiralikPersonel,
    deleteKiralikArac,
    deleteKiralikPersonel,
    updateKiralikArac,
    updateKiralikPersonel,
} from "./actions";

type SirketOption = { id: string; ad: string };
type DisFirmaOption = { id: string; ad: string; tur?: "KIRALIK" | "TASERON" | null };

type KiralikPersonelRow = {
    id: string;
    adSoyad: string;
    ad: string;
    soyad: string;
    telefon: string;
    sirketId: string;
    sirketAd: string;
    disFirmaId: string;
    disFirmaAd: string;
    zimmetliArac: string;
};

type KiralikAracRow = {
    id: string;
    plaka: string;
    sirketId: string;
    sirketAd: string;
    disFirmaId: string;
    disFirmaAd: string;
    soforId: string;
    soforAdSoyad: string;
    yakitToplamLitre?: number;
    ortalamaYakit100Km?: number | null;
    ortalamaYakitIntervalSayisi?: number;
    yakitTuketimBirimi?: "LITRE_PER_100_KM" | "LITRE_PER_HOUR";
};

type KiralikMiniDashboardData = {
    selectedYil: number;
    selectedAy: number | string | null;
    toplamArac: number;
    toplamPersonel: number;
    toplamYakitLitre: number;
    toplamYakitTutari: number;
    toplamBakimTutari: number;
    toplamMasrafTutari: number;
    toplamCezaTutari: number;
    toplamGiderTutari: number;
    fuelByVehicle: Array<{
        aracId: string;
        plaka: string;
        disFirmaAd: string;
        yakitLitre: number;
        yakitTutari: number;
    }>;
    expenseByVehicle: Array<{
        aracId: string;
        plaka: string;
        disFirmaAd: string;
        toplamTutar: number;
        yakitTutar: number;
        bakimTutar: number;
        masrafTutar: number;
        cezaTutar: number;
    }>;
    expenseByDisFirma: Array<{
        disFirmaAd: string;
        toplamTutar: number;
    }>;
};

type KiralikAracForm = {
    plaka: string;
    sirketId: string;
    disFirmaId: string;
    kullaniciId: string;
};

type KiralikPersonelForm = {
    ad: string;
    soyad: string;
    telefon: string;
    sirketId: string;
    disFirmaId: string;
};

const EMPTY_ARAC_FORM: KiralikAracForm = {
    plaka: "",
    sirketId: "",
    disFirmaId: "",
    kullaniciId: "",
};

const EMPTY_PERSONEL_FORM: KiralikPersonelForm = {
    ad: "",
    soyad: "",
    telefon: "",
    sirketId: "",
    disFirmaId: "",
};

function normalizeText(value: string) {
    return value.toLocaleUpperCase("tr-TR").trim();
}

function normalizePlateInput(value: string) {
    return value.replace(/\s+/g, "").toLocaleUpperCase("tr-TR").trim();
}

function formatDecimal(value: number, fractionDigits = 2) {
    return value.toLocaleString("tr-TR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

function formatCurrency(value: number) {
    return `₺${Math.round(value || 0).toLocaleString("tr-TR")}`;
}

function formatLitre(value: number) {
    return `${Number(value || 0).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
}

function getFuelAverageUnitLabel(unit?: "LITRE_PER_100_KM" | "LITRE_PER_HOUR" | null) {
    return unit === "LITRE_PER_HOUR" ? "L/saat" : "L/100 km";
}

function formatPeriodLabel(selectedYil: number, selectedAy: number | string | null) {
    const rawMonth = typeof selectedAy === "string" ? selectedAy.trim().toLowerCase() : selectedAy;
    if (rawMonth === "all" || rawMonth === "__all__") {
        return `${selectedYil} yılı (tüm aylar)`;
    }
    const month = Number(selectedAy);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        return `${selectedYil}`;
    }
    const monthNames = [
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık",
    ];
    return `${monthNames[month - 1]} ${selectedYil}`;
}

export default function KiraliklarClient({
    araclar,
    personeller,
    sirketler,
    disFirmalar,
    miniDashboard,
    kiralikYakitlar,
}: {
    araclar: KiralikAracRow[];
    personeller: KiralikPersonelRow[];
    sirketler: SirketOption[];
    disFirmalar: DisFirmaOption[];
    miniDashboard: KiralikMiniDashboardData;
    kiralikYakitlar: YakitRow[];
}) {
    const router = useRouter();
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();

    const [aracCreateOpen, setAracCreateOpen] = React.useState(false);
    const [personelCreateOpen, setPersonelCreateOpen] = React.useState(false);
    const [editingArac, setEditingArac] = React.useState<KiralikAracRow | null>(null);
    const [editingPersonel, setEditingPersonel] = React.useState<KiralikPersonelRow | null>(null);
    const [aracForm, setAracForm] = React.useState<KiralikAracForm>(EMPTY_ARAC_FORM);
    const [personelForm, setPersonelForm] = React.useState<KiralikPersonelForm>(EMPTY_PERSONEL_FORM);
    const [savingArac, setSavingArac] = React.useState(false);
    const [savingPersonel, setSavingPersonel] = React.useState(false);
    const periodLabel = React.useMemo(
        () => formatPeriodLabel(miniDashboard.selectedYil, miniDashboard.selectedAy),
        [miniDashboard.selectedAy, miniDashboard.selectedYil]
    );
    const expenseCategoryData = React.useMemo(
        () => [
            { key: "yakit", name: "Yakıt", value: miniDashboard.toplamYakitTutari, color: "#16A34A" },
            { key: "bakim", name: "Bakım", value: miniDashboard.toplamBakimTutari, color: "#F59E0B" },
            { key: "masraf", name: "Masraf", value: miniDashboard.toplamMasrafTutari, color: "#0EA5E9" },
            { key: "ceza", name: "Ceza", value: miniDashboard.toplamCezaTutari, color: "#EF4444" },
        ].filter((item) => Number(item.value || 0) > 0),
        [
            miniDashboard.toplamBakimTutari,
            miniDashboard.toplamCezaTutari,
            miniDashboard.toplamMasrafTutari,
            miniDashboard.toplamYakitTutari,
        ]
    );

    const sortedPersoneller = React.useMemo(
        () => [...personeller].sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, "tr-TR")),
        [personeller]
    );
    const kiralikYakitColumns = React.useMemo(() => getYakitColumns(canAccessAllCompanies), [canAccessAllCompanies]);

    const aracColumns = React.useMemo<ColumnDef<KiralikAracRow>[]>(
        () => [
            {
                accessorKey: "sirketAd",
                header: "Çalıştığı Firmamız",
            },
            {
                accessorKey: "disFirmaAd",
                header: "Dış Firma",
            },
            {
                accessorKey: "plaka",
                header: "Plaka",
                cell: ({ row }) => (
                    <Link
                        href={`/dashboard/kiraliklar/${row.original.id}`}
                        className="font-mono font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {row.original.plaka || "-"}
                    </Link>
                ),
            },
            {
                accessorKey: "soforAdSoyad",
                header: "Şoför",
            },
            {
                accessorKey: "ortalamaYakit100Km",
                header: "Ortalama Yakıt",
                cell: ({ row }) => {
                    const litre100 = row.original.ortalamaYakit100Km;
                    const intervalSayisi = row.original.ortalamaYakitIntervalSayisi || 0;
                    const toplamLitre = row.original.yakitToplamLitre || 0;
                    const unitLabel = getFuelAverageUnitLabel(row.original.yakitTuketimBirimi);

                    if (litre100 == null || intervalSayisi <= 0) {
                        return toplamLitre > 0
                            ? <span className="text-slate-400 italic text-xs">Yetersiz veri</span>
                            : <span className="text-slate-400 italic text-xs">-</span>;
                    }

                    return (
                        <div className="min-w-[140px]">
                            <div className="text-sm font-semibold text-slate-800">{formatDecimal(litre100)} {unitLabel}</div>
                            <div className="text-[11px] text-slate-400">{intervalSayisi} dolum aralığı</div>
                        </div>
                    );
                },
            },
            {
                id: "actions",
                header: "İşlemler",
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <RowActionButton
                            variant="edit"
                            onClick={(event) => {
                                event.stopPropagation();
                                setEditingArac(row.original);
                                setAracForm({
                                    plaka: row.original.plaka,
                                    sirketId: row.original.sirketId,
                                    disFirmaId: row.original.disFirmaId,
                                    kullaniciId: row.original.soforId || "",
                                });
                            }}
                        />
                        <RowActionButton
                            variant="delete"
                            onClick={async (event) => {
                                event.stopPropagation();
                                const confirmed = await openConfirm({
                                    title: "Kiralık Aracı Sil",
                                    message: `${row.original.plaka} plakalı kiralık aracı silmek istiyor musunuz?`,
                                    confirmText: "Evet, Sil",
                                    variant: "danger",
                                });
                                if (!confirmed) return;

                                const result = await deleteKiralikArac(row.original.id);
                                if (!result.success) {
                                    toast.error("Araç silinemedi", { description: result.error });
                                    return;
                                }
                                toast.success("Kiralık araç silindi.");
                                router.refresh();
                            }}
                        />
                    </div>
                ),
            },
        ],
        [openConfirm, router]
    );

    const personelColumns = React.useMemo<ColumnDef<KiralikPersonelRow>[]>(
        () => [
            {
                accessorKey: "adSoyad",
                header: "Personel",
            },
            {
                accessorKey: "sirketAd",
                header: "Çalıştığı Firmamız",
            },
            {
                accessorKey: "disFirmaAd",
                header: "Dış Firma",
            },
            {
                accessorKey: "telefon",
                header: "Telefon",
            },
            {
                accessorKey: "zimmetliArac",
                header: "Zimmetli Araç",
                cell: ({ row }) => <span className="font-mono">{row.original.zimmetliArac || "-"}</span>,
            },
            {
                id: "actions",
                header: "İşlemler",
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <RowActionButton
                            variant="edit"
                            onClick={(event) => {
                                event.stopPropagation();
                                setEditingPersonel(row.original);
                                setPersonelForm({
                                    ad: row.original.ad,
                                    soyad: row.original.soyad,
                                    telefon: row.original.telefon === "-" ? "" : row.original.telefon,
                                    sirketId: row.original.sirketId,
                                    disFirmaId: row.original.disFirmaId,
                                });
                            }}
                        />
                        <RowActionButton
                            variant="delete"
                            onClick={async (event) => {
                                event.stopPropagation();
                                const confirmed = await openConfirm({
                                    title: "Kiralık Personeli Sil",
                                    message: `${row.original.adSoyad} kaydını silmek istiyor musunuz?`,
                                    confirmText: "Evet, Sil",
                                    variant: "danger",
                                });
                                if (!confirmed) return;

                                const result = await deleteKiralikPersonel(row.original.id);
                                if (!result.success) {
                                    toast.error("Personel silinemedi", { description: result.error });
                                    return;
                                }
                                toast.success("Kiralık personel silindi.");
                                router.refresh();
                            }}
                        />
                    </div>
                ),
            },
        ],
        [openConfirm, router]
    );

    const handleCreateArac = async () => {
        if (!aracForm.plaka.trim() || !aracForm.sirketId || !aracForm.disFirmaId) {
            toast.warning("Plaka, çalıştığı firmamız ve dış firma zorunludur.");
            return;
        }
        setSavingArac(true);
        const result = await createKiralikArac(aracForm);
        setSavingArac(false);
        if (!result.success) {
            toast.error("Kiralık araç eklenemedi", { description: result.error });
            return;
        }
        setAracCreateOpen(false);
        setAracForm(EMPTY_ARAC_FORM);
        toast.success("Kiralık araç eklendi.");
        router.refresh();
    };

    const handleUpdateArac = async () => {
        if (!editingArac) return;
        if (!aracForm.plaka.trim() || !aracForm.sirketId || !aracForm.disFirmaId) {
            toast.warning("Plaka, çalıştığı firmamız ve dış firma zorunludur.");
            return;
        }

        setSavingArac(true);
        const result = await updateKiralikArac(editingArac.id, aracForm);
        setSavingArac(false);
        if (!result.success) {
            toast.error("Kiralık araç güncellenemedi", { description: result.error });
            return;
        }
        setEditingArac(null);
        setAracForm(EMPTY_ARAC_FORM);
        toast.success("Kiralık araç güncellendi.");
        router.refresh();
    };

    const handleCreatePersonel = async () => {
        if (!personelForm.ad.trim() || !personelForm.soyad.trim() || !personelForm.sirketId || !personelForm.disFirmaId) {
            toast.warning("Ad, soyad, çalıştığı firmamız ve dış firma zorunludur.");
            return;
        }
        setSavingPersonel(true);
        const result = await createKiralikPersonel(personelForm);
        setSavingPersonel(false);
        if (!result.success) {
            toast.error("Kiralık personel eklenemedi", { description: result.error });
            return;
        }
        setPersonelCreateOpen(false);
        setPersonelForm(EMPTY_PERSONEL_FORM);
        toast.success("Kiralık personel eklendi.");
        router.refresh();
    };

    const handleUpdatePersonel = async () => {
        if (!editingPersonel) return;
        if (!personelForm.ad.trim() || !personelForm.soyad.trim() || !personelForm.sirketId || !personelForm.disFirmaId) {
            toast.warning("Ad, soyad, çalıştığı firmamız ve dış firma zorunludur.");
            return;
        }

        setSavingPersonel(true);
        const result = await updateKiralikPersonel(editingPersonel.id, personelForm);
        setSavingPersonel(false);
        if (!result.success) {
            toast.error("Kiralık personel güncellenemedi", { description: result.error });
            return;
        }
        setEditingPersonel(null);
        setPersonelForm(EMPTY_PERSONEL_FORM);
        toast.success("Kiralık personel güncellendi.");
        router.refresh();
    };

    return (
        <div className="mx-auto max-w-[1400px] space-y-6 p-6 md:p-8 xl:p-10">
            {confirmModal}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Kiralık Araçlar ve Personeller</h2>
                <p className="mt-1 text-sm text-slate-500">
                    Kiralık araç giderlerini hakedişten düşebilmek için araç ve personeli tek ekrandan yönetin.
                </p>
            </div>

            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-slate-900">Kiralık Mini Dashboard</h3>
                    <p className="text-sm text-slate-500">Seçili dönem: {periodLabel}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniMetricCard title="Kiralık Araç" value={String(miniDashboard.toplamArac)} subValue="aktif kayıt" icon={<Truck size={16} />} />
                    <MiniMetricCard title="Kiralık Personel" value={String(miniDashboard.toplamPersonel)} subValue="aktif kayıt" icon={<Users size={16} />} />
                    <MiniMetricCard title="Toplam Gider" value={formatCurrency(miniDashboard.toplamGiderTutari)} subValue="yakıt + bakım + masraf + ceza" icon={<Wallet size={16} />} />
                    <MiniMetricCard title="Yakıt Tüketimi" value={formatLitre(miniDashboard.toplamYakitLitre)} subValue={`Yakıt maliyeti: ${formatCurrency(miniDashboard.toplamYakitTutari)}`} icon={<Fuel size={16} />} />
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">Araç Bazlı Yakıt (L)</p>
                        <p className="text-xs text-slate-500 mt-0.5">En yüksek tüketimli araçlar</p>
                        <div className="mt-3 h-[280px]">
                            {miniDashboard.fuelByVehicle.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={miniDashboard.fuelByVehicle} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="plaka" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            cursor={{ fill: "#F8FAFC" }}
                                            formatter={(value) => formatLitre(Number(value || 0))}
                                            labelFormatter={(label) => `Plaka: ${label}`}
                                        />
                                        <Bar dataKey="yakitLitre" name="Yakıt (L)" fill="#16A34A" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 flex items-center justify-center">
                                    Seçili dönemde yakıt verisi yok.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">Harcama Dağılımı</p>
                        <p className="text-xs text-slate-500 mt-0.5">Kategori bazlı toplam gider</p>
                        <div className="mt-3 h-[280px]">
                            {expenseCategoryData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={expenseCategoryData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="48%"
                                            innerRadius={56}
                                            outerRadius={90}
                                            paddingAngle={2}
                                        >
                                            {expenseCategoryData.map((entry) => (
                                                <Cell key={`expense-cat-${entry.key}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 flex items-center justify-center">
                                    Harcama verisi yok.
                                </div>
                            )}
                        </div>
                        {expenseCategoryData.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                                {expenseCategoryData.map((item) => (
                                    <span
                                        key={`expense-legend-${item.key}`}
                                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700"
                                    >
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        {item.name}: <span className="font-semibold">{formatCurrency(item.value)}</span>
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-semibold text-slate-900">Dış Firma Bazlı Gider</p>
                        <p className="text-xs text-slate-500 mt-0.5">Toplam harcamaya göre ilk firmalar</p>
                        <div className="mt-3 h-[280px]">
                            {miniDashboard.expenseByDisFirma.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={miniDashboard.expenseByDisFirma}
                                        layout="vertical"
                                        margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 11, fill: "#64748B" }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(value) => `₺${Number(value || 0).toLocaleString("tr-TR")}`}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="disFirmaAd"
                                            width={120}
                                            tick={{ fontSize: 11, fill: "#64748B" }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip formatter={(value) => formatCurrency(Number(value || 0))} />
                                        <Bar dataKey="toplamTutar" name="Toplam Gider" fill="#4F46E5" radius={[0, 6, 6, 0]} maxBarSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 flex items-center justify-center">
                                    Dış firma gider verisi yok.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section id="kiralik-yakit-listesi" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Kiralık Araç Yakıt Kayıtları</h3>
                    <p className="text-sm text-slate-500">
                        Yakıt ekranındaki tablo yapısının kiralık araçlara filtrelenmiş görünümü.
                    </p>
                </div>
                <DataTable
                    columns={kiralikYakitColumns as any}
                    data={kiralikYakitlar}
                    searchKey="arac_plaka"
                    searchPlaceholder="Plaka / personel / istasyon ara..."
                    toolbarArrangement="report-right-scroll"
                    tableClassName="w-full min-w-0"
                />
            </section>

            <section id="kiralik-arac-listesi" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Kiralık Araç Listesi</h3>
                        <p className="text-sm text-slate-500">Alanlar: Çalıştığı firmamız, dış firma, plaka, şoför, ortalama yakıt.</p>
                    </div>
                    <Dialog
                        open={aracCreateOpen}
                        onOpenChange={(open) => {
                            setAracCreateOpen(open);
                            if (!open) setAracForm(EMPTY_ARAC_FORM);
                        }}
                    >
                        <DialogTrigger asChild>
                            <button className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                                <Plus size={16} />
                                Kiralık Araç Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Yeni Kiralık Araç</DialogTitle>
                                <DialogDescription>Yalnızca takip için gerekli temel bilgileri girin.</DialogDescription>
                            </DialogHeader>
                            <KiralikAracFormFields
                                form={aracForm}
                                setForm={setAracForm}
                                sirketler={sirketler}
                                disFirmalar={disFirmalar}
                                personeller={sortedPersoneller}
                            />
                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={handleCreateArac}
                                    disabled={savingArac}
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {savingArac ? "Kaydediliyor..." : "Kaydet"}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <DataTable
                    columns={aracColumns}
                    data={araclar}
                    searchKey="plaka"
                    searchPlaceholder="Plaka ara..."
                    excelEntity="kiralikArac"
                    tableClassName="w-full min-w-0"
                />
            </section>

            <section id="kiralik-personel-listesi" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">Kiralık Personel Listesi</h3>
                        <p className="text-sm text-slate-500">Kiralık şoför/personel kayıtlarını buradan ekleyip yönetin.</p>
                    </div>
                    <Dialog
                        open={personelCreateOpen}
                        onOpenChange={(open) => {
                            setPersonelCreateOpen(open);
                            if (!open) setPersonelForm(EMPTY_PERSONEL_FORM);
                        }}
                    >
                        <DialogTrigger asChild>
                            <button className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                                <Plus size={16} />
                                Kiralık Personel Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Yeni Kiralık Personel</DialogTitle>
                                <DialogDescription>Kiralık personel kaydını hızlıca oluşturun.</DialogDescription>
                            </DialogHeader>
                            <KiralikPersonelFormFields form={personelForm} setForm={setPersonelForm} sirketler={sirketler} disFirmalar={disFirmalar} />
                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={handleCreatePersonel}
                                    disabled={savingPersonel}
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {savingPersonel ? "Kaydediliyor..." : "Kaydet"}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                <DataTable
                    columns={personelColumns}
                    data={personeller}
                    searchKey="adSoyad"
                    searchPlaceholder="Personel ara..."
                    excelEntity="kiralikPersonel"
                    tableClassName="w-full min-w-0"
                />
            </section>

            <Dialog open={Boolean(editingArac)} onOpenChange={(open) => !open && setEditingArac(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kiralık Araç Düzenle</DialogTitle>
                        <DialogDescription>{editingArac?.plaka} kaydını güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <KiralikAracFormFields
                        form={aracForm}
                        setForm={setAracForm}
                        sirketler={sirketler}
                        disFirmalar={disFirmalar}
                        personeller={sortedPersoneller}
                    />
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={handleUpdateArac}
                            disabled={savingArac}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {savingArac ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editingPersonel)} onOpenChange={(open) => !open && setEditingPersonel(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kiralık Personel Düzenle</DialogTitle>
                        <DialogDescription>{editingPersonel?.adSoyad} kaydını güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <KiralikPersonelFormFields form={personelForm} setForm={setPersonelForm} sirketler={sirketler} disFirmalar={disFirmalar} />
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={handleUpdatePersonel}
                            disabled={savingPersonel}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {savingPersonel ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MiniMetricCard({
    title,
    value,
    subValue,
    icon,
}: {
    title: string;
    value: string;
    subValue: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                    {icon}
                </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{subValue}</p>
        </div>
    );
}

function KiralikAracFormFields({
    form,
    setForm,
    sirketler,
    disFirmalar,
    personeller,
}: {
    form: KiralikAracForm;
    setForm: React.Dispatch<React.SetStateAction<KiralikAracForm>>;
    sirketler: SirketOption[];
    disFirmalar: DisFirmaOption[];
    personeller: KiralikPersonelRow[];
}) {
    const filteredDriverOptions = React.useMemo(() => {
        if (!form.disFirmaId) return personeller;
        return personeller.filter((personel) => personel.disFirmaId === form.disFirmaId);
    }, [form.disFirmaId, personeller]);

    return (
        <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                    <Truck size={14} className="text-slate-400" /> Plaka <span className="text-rose-500">*</span>
                </label>
                <Input
                    value={form.plaka}
                    onChange={(event) => setForm((prev) => ({ ...prev, plaka: normalizePlateInput(event.target.value) }))}
                    placeholder="16ABC123"
                    className="h-9 font-mono uppercase"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                        <Building2 size={14} className="text-slate-400" />
                        Çalıştığı Firmamız <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={form.sirketId}
                        onChange={(event) => setForm((prev) => ({ ...prev, sirketId: event.target.value }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Şirket seçiniz</option>
                        {sirketler.map((sirket) => (
                            <option key={sirket.id} value={sirket.id}>
                                {sirket.ad}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-medium">
                        <Building2 size={14} className="text-slate-400" />
                        Dış Firma <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={form.disFirmaId}
                        onChange={(event) => setForm((prev) => ({ ...prev, disFirmaId: event.target.value, kullaniciId: "" }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Firma seçiniz</option>
                        {disFirmalar.map((firma) => (
                            <option key={firma.id} value={firma.id}>
                                {firma.ad}{firma.tur ? ` (${firma.tur === "TASERON" ? "Taşeron" : "Kiralık"})` : ""}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium">
                    <User size={14} className="text-slate-400" />
                    Şoför
                </label>
                <select
                    value={form.kullaniciId}
                    onChange={(event) => setForm((prev) => ({ ...prev, kullaniciId: event.target.value }))}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    <option value="">Şoför atama (boş)</option>
                    {filteredDriverOptions.map((personel) => (
                        <option key={personel.id} value={personel.id}>
                            {personel.adSoyad}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function KiralikPersonelFormFields({
    form,
    setForm,
    sirketler,
    disFirmalar,
}: {
    form: KiralikPersonelForm;
    setForm: React.Dispatch<React.SetStateAction<KiralikPersonelForm>>;
    sirketler: SirketOption[];
    disFirmalar: DisFirmaOption[];
}) {
    return (
        <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Ad <span className="text-rose-500">*</span>
                    </label>
                    <Input
                        value={form.ad}
                        onChange={(event) => setForm((prev) => ({ ...prev, ad: normalizeText(event.target.value) }))}
                        className="h-9 uppercase"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Soyad <span className="text-rose-500">*</span>
                    </label>
                    <Input
                        value={form.soyad}
                        onChange={(event) => setForm((prev) => ({ ...prev, soyad: normalizeText(event.target.value) }))}
                        className="h-9 uppercase"
                    />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Telefon</label>
                <Input
                    value={form.telefon}
                    onChange={(event) => setForm((prev) => ({ ...prev, telefon: event.target.value.trim() }))}
                    className="h-9"
                    placeholder="05xx xxx xx xx"
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Çalıştığı Firmamız <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={form.sirketId}
                        onChange={(event) => setForm((prev) => ({ ...prev, sirketId: event.target.value }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Şirket seçiniz</option>
                        {sirketler.map((sirket) => (
                            <option key={sirket.id} value={sirket.id}>
                                {sirket.ad}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                        Dış Firma <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={form.disFirmaId}
                        onChange={(event) => setForm((prev) => ({ ...prev, disFirmaId: event.target.value }))}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Firma seçiniz</option>
                        {disFirmalar.map((firma) => (
                            <option key={firma.id} value={firma.id}>
                                {firma.ad}{firma.tur ? ` (${firma.tur === "TASERON" ? "Taşeron" : "Kiralık"})` : ""}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
