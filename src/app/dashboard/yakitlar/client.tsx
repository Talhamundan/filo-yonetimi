"use client"
import { toast } from "sonner";

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, Fuel, Gauge, Wallet, Droplets } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, YakitRow } from "./columns";
import { useRouter, useSearchParams } from "next/navigation";
import { createYakit, updateYakit, deleteYakit } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { RowActionButton } from "@/components/ui/row-action-button";
import { formatAracOptionLabel } from "@/lib/arac-option-label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getPersonelOptionLabel, getPersonelOptionSearchText } from "@/lib/personel-display";

const EMPTY = {
    aracId: '',
    soforId: '',
    tarih: new Date().toISOString().slice(0, 16),
    litre: '',
    km: '',
    istasyon: '',
    odemeYontemi: 'NAKIT'
};

const YAKIT_CIKISI_OPTIONS = ["Mithra", "Binlik Bidon"] as const;

const TANK_DEPO_KAPASITE = 40000;
const TANK_GOSTERGE_TASLAK = [
    {
        id: "tank1",
        ad: "Ana Tank 1",
        kapasiteLitre: TANK_DEPO_KAPASITE,
        mevcutLitre: 30250,
        birimMaliyet: 38.42,
        dagitimHatti: "Mithra / Binlik beslemesi",
    },
    {
        id: "tank2",
        ad: "Ana Tank 2",
        kapasiteLitre: TANK_DEPO_KAPASITE,
        mevcutLitre: 18600,
        birimMaliyet: 38.42,
        dagitimHatti: "Mithra / Binlik beslemesi",
    },
] as const;

function formatLitre(value: number) {
    return `${Math.round(value).toLocaleString("tr-TR")} L`;
}

function formatPara(value: number) {
    return `₺${Math.round(value).toLocaleString("tr-TR")}`;
}

function getTankSeviye(dolulukOrani: number) {
    if (dolulukOrani < 20) {
        return {
            etiket: "Kritik Seviye",
            badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
            topBorderClass: "border-t-2 border-t-rose-300",
            barClass: "bg-[#0B6E4F]",
        };
    }
    if (dolulukOrani < 40) {
        return {
            etiket: "Düşük Seviye",
            badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
            topBorderClass: "border-t-2 border-t-amber-300",
            barClass: "bg-[#0B6E4F]",
        };
    }
    return {
        etiket: "Normal Seviye",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
        topBorderClass: "border-t-2 border-t-emerald-300",
        barClass: "bg-[#0B6E4F]",
    };
}

function parseDecimal(value: string) {
    const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function parseKm(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = trimmed.replace(/[^\d]/g, "");
    const parsed = Number(numeric || trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

type AracOption = {
    id: string;
    plaka: string | null;
    marka?: string;
    model?: string;
    durum?: string | null;
    bulunduguIl?: string | null;
    calistigiKurum?: string | null;
    sirketAd?: string | null;
    kullaniciId?: string | null;
    kullanici?: { id: string; ad: string; soyad: string } | null;
    aktifSoforId?: string | null;
    aktifSofor?: { id: string; ad: string; soyad: string } | null;
    aktifSoforAdSoyad?: string | null;
};

type PersonelOption = {
    id: string;
    ad: string;
    soyad: string;
    rol?: string | null;
    sirketAd?: string | null;
    calistigiKurum?: string | null;
};

const FormFields = ({
    formData,
    setFormData,
    araclar,
    personeller,
    onAracChange,
}: {
    formData: any,
    setFormData: any,
    araclar: AracOption[],
    personeller: PersonelOption[],
    onAracChange: (aracId: string) => void,
}) => {
    const seciliArac = araclar.find((a) => a.id === formData.aracId);
    const seciliPersonel = personeller.find((personel) => personel.id === formData.soforId);
    const bagliSirket = seciliArac?.sirketAd?.trim() || "-";
    const calistigiKurum =
        seciliArac?.calistigiKurum?.trim() ||
        seciliPersonel?.calistigiKurum?.trim() ||
        seciliPersonel?.sirketAd?.trim() ||
        "-";
    const alindigiYerOptions = React.useMemo(() => {
        const current = typeof formData.istasyon === "string" ? formData.istasyon.trim() : "";
        if (!current) return [...YAKIT_CIKISI_OPTIONS];
        const exists = YAKIT_CIKISI_OPTIONS.some((item) => item.localeCompare(current, "tr-TR", { sensitivity: "base" }) === 0);
        return exists ? [...YAKIT_CIKISI_OPTIONS] : [...YAKIT_CIKISI_OPTIONS, current];
    }, [formData.istasyon]);

    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Araç (Plaka) <span className="text-red-500">*</span></label>
                <SearchableSelect
                    value={formData.aracId} 
                    onValueChange={onAracChange}
                    placeholder="Seçiniz..."
                    searchPlaceholder="Plaka / araç ara..."
                    options={[
                        { value: "", label: "Seçiniz..." },
                        ...araclar.map((a) => ({
                            value: a.id,
                            label: formatAracOptionLabel(a),
                            searchText: [a.plaka, a.marka, a.model].filter(Boolean).join(" "),
                        })),
                    ]}
                />
                <SelectedAracInfo arac={seciliArac} />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Yakıtı Alan Personel</label>
                <SearchableSelect
                    value={formData.soforId}
                    onValueChange={(value) => setFormData({ ...formData, soforId: value })}
                    placeholder="Seçilmedi"
                    searchPlaceholder="Personel ara..."
                    options={[
                        { value: "", label: "Seçilmedi" },
                        ...personeller.map((personel) => ({
                            value: personel.id,
                            label: getPersonelOptionLabel(personel),
                            searchText: getPersonelOptionSearchText(personel),
                        })),
                    ]}
                />
                <p className="text-[11px] text-slate-500">
                    Şoför harici personel de seçilebilir. Admin seçimi yapılamaz.
                </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Bağlı Şirket</label>
                    <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700">
                        {bagliSirket}
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Çalıştığı Kurum</label>
                    <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700">
                        {calistigiKurum}
                    </div>
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Alım Tarihi & Saati</label>
                <Input type="datetime-local" value={formData.tarih} onChange={e => setFormData({...formData, tarih: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Alınan Litre</label>
                <Input type="number" step="0.01" value={formData.litre} onChange={e => setFormData({...formData, litre: e.target.value})} placeholder="0.00" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">KM/Saat (Opsiyonel)</label>
                    <Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})} placeholder="123456" className="h-9" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Yakıt Çıkışı</label>
                    <select
                        value={formData.istasyon}
                        onChange={(e) => setFormData({ ...formData, istasyon: e.target.value })}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="">Seçiniz...</option>
                        {alindigiYerOptions.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default function YakitlarClient({
    initialYakitlar,
    araclar,
    personeller,
}: {
    initialYakitlar: YakitRow[],
    araclar: AracOption[],
    personeller: PersonelOption[],
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<YakitRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);
    const searchParams = useSearchParams();
    const shouldOpenCreate = searchParams.get("add") === "true";
    const personelIdSet = React.useMemo(() => new Set(personeller.map((personel) => personel.id)), [personeller]);
    const normalizeSoforId = (soforId?: string | null) => (soforId && personelIdSet.has(soforId) ? soforId : "");
    const tankGosterge = React.useMemo(() => {
        const tanklar = TANK_GOSTERGE_TASLAK.map((tank) => {
            const dolulukOrani = tank.kapasiteLitre > 0 ? (tank.mevcutLitre / tank.kapasiteLitre) * 100 : 0;
            return {
                ...tank,
                dolulukOrani,
                stokDegeri: tank.mevcutLitre * tank.birimMaliyet,
            };
        });
        const toplamKapasite = tanklar.reduce((sum, tank) => sum + tank.kapasiteLitre, 0);
        const toplamStok = tanklar.reduce((sum, tank) => sum + tank.mevcutLitre, 0);
        const toplamDeger = tanklar.reduce((sum, tank) => sum + tank.stokDegeri, 0);
        const agirlikliMaliyet = toplamStok > 0 ? toplamDeger / toplamStok : 0;

        let kademeliBaslangic = 0;
        const yerlesim = tanklar.map((tank) => {
            const baslangicOrani = toplamKapasite > 0 ? (kademeliBaslangic / toplamKapasite) * 100 : 0;
            const genislikOrani = toplamKapasite > 0 ? (tank.mevcutLitre / toplamKapasite) * 100 : 0;
            kademeliBaslangic += tank.kapasiteLitre;
            return {
                ...tank,
                baslangicOrani,
                genislikOrani,
            };
        });

        return {
            tanklar: yerlesim,
            toplamKapasite,
            toplamStok,
            toplamDeger,
            agirlikliMaliyet,
            genelDolulukOrani: toplamKapasite > 0 ? (toplamStok / toplamKapasite) * 100 : 0,
        };
    }, []);
    const son30GunYakitCikisi = React.useMemo(
        () => initialYakitlar.reduce((sum, row) => sum + Number(row?.litre || 0), 0),
        [initialYakitlar]
    );
    const son7GunYakitCikisi = React.useMemo(() => {
        const now = Date.now();
        const yediGunOncesi = now - 7 * 24 * 60 * 60 * 1000;
        return initialYakitlar.reduce((sum, row) => {
            const tarih = new Date(row?.tarih as any).getTime();
            if (!Number.isFinite(tarih) || tarih < yediGunOncesi) return sum;
            return sum + Number(row?.litre || 0);
        }, 0);
    }, [initialYakitlar]);
    const mithraCikisLitre = React.useMemo(
        () =>
            initialYakitlar.reduce((sum, row) => {
                const istasyon = String(row?.istasyon || "").trim().toLocaleLowerCase("tr-TR");
                if (istasyon !== "mithra") return sum;
                return sum + Number(row?.litre || 0);
            }, 0),
        [initialYakitlar]
    );
    const binlikCikisLitre = React.useMemo(
        () =>
            initialYakitlar.reduce((sum, row) => {
                const istasyon = String(row?.istasyon || "").trim().toLocaleLowerCase("tr-TR");
                if (istasyon !== "binlik bidon") return sum;
                return sum + Number(row?.litre || 0);
            }, 0),
        [initialYakitlar]
    );
    const sonGuncelleme = React.useMemo(() => {
        const latest = initialYakitlar[0];
        if (!latest?.tarih) return "-";
        const d = new Date(latest.tarih as any);
        if (Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }, [initialYakitlar]);
    const tahminiKalanGun = React.useMemo(() => {
        if (son30GunYakitCikisi <= 0) return null;
        const gunlukOrtalama = son30GunYakitCikisi / 30;
        if (gunlukOrtalama <= 0) return null;
        return Math.max(1, Math.round(tankGosterge.toplamStok / gunlukOrtalama));
    }, [son30GunYakitCikisi, tankGosterge.toplamStok]);

    useEffect(() => {
        if (shouldOpenCreate) {
            setCreateOpen(true);
            // URL'den parametreyi temizle (isteğe bağlı, ama kullanıcı sayfada kalırsa tekrar açılmasın diye iyi olur)
            const params = new URLSearchParams(searchParams.toString());
            params.delete("add");
            const query = params.toString();
            router.replace(`/dashboard/yakitlar${query ? `?${query}` : ""}`, { scroll: false });
        }
    }, [shouldOpenCreate, router, searchParams]);

    const handleAracSelection = (aracId: string) => {
        const seciliArac = araclar.find((arac) => arac.id === aracId);
        setFormData((prev) => ({
            ...prev,
            aracId,
            soforId: normalizeSoforId(seciliArac?.aktifSoforId || seciliArac?.kullaniciId),
        }));
    };

    const handleCreate = async () => {
        if (!formData.aracId) {
            return toast.warning("Araç Seçilmedi", { description: "Lütfen yakıt alımı için bir araç seçin." });
        }
        setLoading(true);
        const litre = parseDecimal(formData.litre);
        const km = parseKm(formData.km);
        const isKmInvalid = km !== null && !Number.isFinite(km);
        if (!Number.isFinite(litre) || isKmInvalid) {
            setLoading(false);
            return toast.error("Geçersiz değer", { description: "Litre veya KM alanını kontrol edin." });
        }
        const tutar = 0;
        const res = await createYakit({
            ...formData,
            litre,
            tutar,
            km,
            soforId: formData.soforId || null,
            odemeYontemi: formData.odemeYontemi
        });
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Yakıt Kaydı Eklendi", { description: "Araç yakıt alımı başarıyla kaydedildi." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) {
            toast.error("Güncelleme Hatası", { description: "Güncellenecek yakıt kaydı veya araç bilgisi eksik." });
            return;
        }
        setLoading(true);
        const litre = parseDecimal(formData.litre);
        const km = parseKm(formData.km);
        const isKmInvalid = km !== null && !Number.isFinite(km);
        if (!Number.isFinite(litre) || isKmInvalid) {
            setLoading(false);
            return toast.error("Geçersiz değer", { description: "Litre veya KM alanını kontrol edin." });
        }
        const tutar = 0;
        const res = await updateYakit(editRow.id, {
            ...formData,
            litre,
            tutar,
            km,
            soforId: formData.soforId || null,
            odemeYontemi: formData.odemeYontemi
        });
        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Yakıt alım kaydı güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, plaka: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${plaka} plakalı aracın yakıt kaydını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteYakit(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Yakıt alım kaydı sistemden kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: YakitRow) => {
        const litre = row.litre || 0;
        setFormData({
            aracId: row.arac.id,
            soforId: normalizeSoforId(row.soforId || row.kullanici?.id || row.arac.kullanici?.id),
            tarih: new Date(row.tarih).toISOString().slice(0, 16),
            litre: String(litre),
            km: String(row.km),
            istasyon: row.istasyon || '',
            odemeYontemi: row.odemeYontemi || 'NAKIT'
        });
        setEditRow(row);
    };


    const columnsWithActions = [
        ...getColumns(canAccessAllCompanies),
        {
            id: 'actions',
            header: 'İşlemler',
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <RowActionButton variant="edit" onClick={() => openEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original.id, row.original.arac.plaka)} />
                </div>
            )
        },
    ];

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
        {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                         <Fuel className="text-rose-600" /> Yakıt Alım Kayıtları
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Yakıt hareketlerini araç, personel ve kurum bazlı takip edin.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yakıt Alımı Gir
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yakıt Alım Bilgisi</DialogTitle>
                            <DialogDescription>
                                Yeni yakıt kaydını tablo alanlarıyla uyumlu şekilde girin.
                            </DialogDescription>
                        </DialogHeader>
                        <FormFields
                            formData={formData}
                            setFormData={setFormData}
                            araclar={araclar}
                            personeller={personeller}
                            onAracChange={handleAracSelection}
                        />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <section className="mb-4">
                <div className="relative rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
                    <span className="absolute right-3 top-3 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-amber-800 shadow-sm">
                        Demo Görsel
                    </span>
                    <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                        <div>
                            <h3 className="text-sm md:text-base font-semibold text-slate-900">Yakıt Stok Özeti</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">Son güncelleme: {sonGuncelleme}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mb-3">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[11px] text-slate-500">Toplam Stok</p>
                            <p className="text-base md:text-lg font-bold text-slate-900 tabular-nums">{formatLitre(tankGosterge.toplamStok)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[11px] text-slate-500 inline-flex items-center gap-1"><Gauge size={12} /> Genel Doluluk</p>
                            <p className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
                                %{tankGosterge.genelDolulukOrani.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[11px] text-slate-500 inline-flex items-center gap-1"><Wallet size={12} /> Ortalama Maliyet</p>
                            <p className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
                                ₺{tankGosterge.agirlikliMaliyet.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                            <p className="text-[11px] text-slate-500 inline-flex items-center gap-1"><Droplets size={12} /> Tahmini Yeterlilik</p>
                            <p className="text-base md:text-lg font-bold text-slate-900 tabular-nums">{tahminiKalanGun ? `${tahminiKalanGun} gün` : "-"}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                        {tankGosterge.tanklar.map((tank) => {
                            const seviye = getTankSeviye(tank.dolulukOrani);
                            return (
                                <div key={tank.id} className={`rounded-lg border border-slate-200 bg-white px-3 py-3 ${seviye.topBorderClass}`}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <p className="text-sm font-semibold text-slate-900">{tank.ad}</p>
                                        <span className="text-xs font-bold text-slate-900 tabular-nums">
                                            %{tank.dolulukOrani.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                        </span>
                                    </div>
                                    <div className="h-3.5 rounded-full bg-slate-200 border border-slate-300 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${seviye.barClass} shadow-[inset_0_-1px_0_rgba(255,255,255,0.25)]`}
                                            style={{ width: `${Math.max(0, Math.min(100, tank.dolulukOrani))}%` }}
                                        />
                                    </div>
                                    <p className="mt-2 text-sm font-semibold text-slate-900 tabular-nums">
                                        {formatLitre(tank.mevcutLitre)}
                                        <span className="text-slate-500 font-medium"> / {formatLitre(tank.kapasiteLitre)}</span>
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 tabular-nums">
                                            ₺{tank.birimMaliyet.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L
                                        </span>
                                        <span>Son dolum: {sonGuncelleme}</span>
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${seviye.badgeClass}`}>
                                            {seviye.etiket}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <summary className="cursor-pointer select-none text-[12px] font-semibold text-slate-700">
                            Detayı Göster
                        </summary>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 text-[11px]">
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="text-slate-500">Stok Değeri</p>
                                <p className="font-semibold text-slate-900 tabular-nums">{formatPara(tankGosterge.toplamDeger)}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="text-slate-500">Son 7 Gün Tüketim</p>
                                <p className="font-semibold text-slate-900 tabular-nums">{formatLitre(son7GunYakitCikisi)}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="text-slate-500">Mithra Çıkışı</p>
                                <p className="font-semibold text-slate-900 tabular-nums">{formatLitre(mithraCikisLitre)}</p>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <p className="text-slate-500">Binlik Çıkışı</p>
                                <p className="font-semibold text-slate-900 tabular-nums">{formatLitre(binlikCikisLitre)}</p>
                            </div>
                        </div>
                    </details>
                </div>
            </section>

            <DataTable
                columns={columnsWithActions as any}
                data={initialYakitlar}
                searchKey="arac_plaka"
                searchPlaceholder="Yakıt kaydı için araç plakası ara..."
                toolbarArrangement="report-right-scroll"
                serverFiltering={{
                    showDateRange: true,
                }}
                excelEntity="yakit"
            />

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Yakıt Kaydını Düzenle</DialogTitle>
                        <DialogDescription>&quot;{editRow?.arac.plaka}&quot; plakalı aracın yakıt alım bilgisini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields
                        formData={formData}
                        setFormData={setFormData}
                        araclar={araclar}
                        personeller={personeller}
                        onAracChange={handleAracSelection}
                    />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
