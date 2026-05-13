"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Mail, Phone, Building2, Briefcase, Car, ArrowLeft, Calendar, Plus, Pencil, Trash2, Fuel, MapPin
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { FormFields, type PersonelFormData } from "../PersonelForm";
import { updatePersonel, deletePersonel } from "../actions";
import { useState } from "react";
import { toast } from "sonner";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { useDashboardScopedHref } from "@/lib/use-dashboard-scoped-href";
import { createZimmet, finalizeZimmet, deleteZimmet } from "../../zimmetler/actions";
import { addBakim, updateBakim, deleteBakim } from "../../bakimlar/actions";
import { createYakit, updateYakit, deleteYakit } from "../../yakitlar/actions";
import { createMasraf, updateMasraf, deleteMasraf } from "../../masraflar/actions";
import { createCeza, updateCeza, deleteCeza } from "../../cezalar/actions";
import { deleteArizaKaydi, updateArizaKaydi } from "../../arizalar/actions";
import { AracLink } from "@/components/links/RecordLinks";
import { nowDateTimeLocal, toDateTimeLocalInput } from "@/lib/datetime-local";
import { getRoleLabel } from "@/lib/role-label";
import { formatAracOptionLabel } from "@/lib/arac-option-label";
import { RowActionButton } from "@/components/ui/row-action-button";
import { sortByTextValue } from "@/lib/sort-utils";
import { getFuelKmDelta, getZimmetKmDelta, sumBy } from "@/lib/detail-table-totals";

function formatNumber(value: unknown, fallback = "-") {
    if (value === null || value === undefined || value === "") return fallback;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue.toLocaleString("tr-TR") : fallback;
}

function formatCurrency(value: unknown, fallback = "₺0") {
    if (value === null || value === undefined || value === "") return fallback;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? `₺${numberValue.toLocaleString("tr-TR")}` : fallback;
}

function formatDate(value: unknown) {
    if (!value) return "-";
    const date = new Date(value as string | number | Date);
    return Number.isNaN(date.getTime()) ? "-" : format(date, "dd.MM.yyyy", { locale: tr });
}

function formatDecimal(value: unknown, fractionDigits = 1, fallback = "-") {
    if (value === null || value === undefined || value === "") return fallback;
    const numberValue = Number(value);
    return Number.isFinite(numberValue)
        ? numberValue.toLocaleString("tr-TR", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
        : fallback;
}

function formatKm(value: unknown) {
    return `${formatNumber(value, "0")} km`;
}

function formatLitres(value: unknown) {
    if (value === null || value === undefined || value === "") return "0 L";
    const numberValue = Number(value);
    return Number.isFinite(numberValue)
        ? `${numberValue.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} L`
        : "0 L";
}

export default function PersonelDetailClient({
    initialPersonel: p,
    sirketler,
    atamayaUygunAraclar
}: {
    initialPersonel: any,
    sirketler: any[],
    atamayaUygunAraclar: { id: string; plaka: string | null; marka: string; model: string; durum?: string | null; guncelKm: number; sirket?: { ad: string } | null }[]
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const scopedHref = useDashboardScopedHref();
    const resolveLatestFuelKmForArac = React.useCallback((aracId: string | null | undefined) => {
        if (!aracId) return null;
        const kayitlar = [
            ...(Array.isArray(p?.arac?.yakitlar) ? p.arac.yakitlar : []),
            ...(Array.isArray(p?.yakitKayitlari) ? p.yakitKayitlari : []),
        ];
        let latestKm: number | null = null;
        let latestTime = Number.NEGATIVE_INFINITY;
        for (const kayit of kayitlar) {
            const kayitAracId = kayit?.aracId || kayit?.arac?.id || null;
            if (kayitAracId !== aracId) continue;
            const km = Number(kayit?.km);
            if (!Number.isFinite(km) || km <= 0) continue;
            const timestamp = kayit?.tarih ? new Date(kayit.tarih).getTime() : Number.NEGATIVE_INFINITY;
            if (timestamp >= latestTime) {
                latestTime = timestamp;
                latestKm = Math.trunc(km);
            }
        }
        return latestKm;
    }, [p?.arac?.yakitlar, p?.yakitKayitlari]);
    const getDefaultIadeKm = React.useCallback(() => {
        const latestFuelKm = resolveLatestFuelKmForArac(p?.arac?.id);
        if (latestFuelKm !== null) return String(latestFuelKm);
        const guncelKm = Number(p?.arac?.guncelKm);
        return Number.isFinite(guncelKm) && guncelKm > 0 ? String(Math.trunc(guncelKm)) : "";
    }, [p?.arac?.guncelKm, p?.arac?.id, resolveLatestFuelKmForArac]);
    const [editOpen, setEditOpen] = useState(false);
    const [formData, setFormData] = useState<PersonelFormData>({
        ad: p.ad,
        soyad: p.soyad,
        telefon: p.telefon || '',
        rol: p.rol,
        sirketId: p.sirketId || '',
        calistigiKurum: p.calistigiKurum || p.sehir || '',
        santiye: p.santiye || p.arac?.bulunduguIl || '',
        tcNo: p.tcNo || ''
    });
    const [loading, setLoading] = useState(false);
    const [atamaOpen, setAtamaOpen] = useState(false);
    const [atamaData, setAtamaData] = useState({
        aracId: '',
        baslangic: nowDateTimeLocal(),
        baslangicKm: '',
        notlar: ''
    });
    const [iadeOpen, setIadeOpen] = useState(false);
    const [iadeData, setIadeData] = useState({
        bitis: nowDateTimeLocal(),
        bitisKm: getDefaultIadeKm(),
        notlar: "",
    });
    const [actionLoading, setActionLoading] = useState(false);

    // --- YAKIT ---
    const [yakitOpen, setYakitOpen] = useState(false);
    const [yakitEditRow, setYakitEditRow] = useState<any>(null);
    const [yakitData, setYakitData] = useState({
        tarih: nowDateTimeLocal(),
        litre: '',
        tutar: '',
        km: '',
        istasyon: '',
        odemeYontemi: 'NAKIT' as any,
        soforId: p.id,
    });

    // --- CEZA ---
    const [cezaOpen, setCezaOpen] = useState(false);
    const [cezaEditRow, setCezaEditRow] = useState<any>(null);
    const [cezaData, setCezaData] = useState({
        tarih: nowDateTimeLocal(),
        tutar: '',
        cezaMaddesi: '',
        aciklama: '',
        aracId: '',
        soforId: p.id,
    });

    // --- ARIZA ---
    const [arizaOpen, setArizaOpen] = useState(false);
    const [arizaEditRow, setArizaEditRow] = useState<any>(null);
    const [arizaData, setArizaData] = useState({
        bildirimTarihi: nowDateTimeLocal(),
        aciklama: '',
        oncelik: 'ORTA' as any,
        km: '',
        aracId: '',
        soforId: p.id,
    });

    // --- BAKIM ---
    const [bakimOpen, setBakimOpen] = useState(false);
    const [bakimEditRow, setBakimEditRow] = useState<any>(null);
    const [bakimData, setBakimData] = useState({
        bakimTarihi: nowDateTimeLocal(),
        tip: 'PERIYODIK' as any,
        servisAdi: '',
        yapilanIslemler: '',
        tutar: '',
        km: '',
        aracId: '',
        soforId: p.id,
    });

    // --- MASRAF ---
    const [masrafOpen, setMasrafOpen] = useState(false);
    const [masrafEditRow, setMasrafEditRow] = useState<any>(null);
    const [masrafData, setMasrafData] = useState({
        tarih: nowDateTimeLocal(),
        tur: 'DIGER' as any,
        tutar: '',
        aciklama: '',
        aracId: '',
    });

    const zimmetler = Array.isArray(p?.zimmetler) ? p.zimmetler : [];
    const cezalar = Array.isArray(p?.cezalar) ? p.cezalar : [];
    const arizalar = Array.isArray(p?.arizalar) ? p.arizalar : [];
    const bakimKayitlari = Array.isArray(p?.bakimKayitlari) ? p.bakimKayitlari : [];
    const yakitKayitlari = Array.isArray(p?.yakitKayitlari) ? p.yakitKayitlari : [];
    const masraflar = Array.isArray(p?.arac?.masraflar) ? p.arac.masraflar : [];
    const uygunAraclar = Array.isArray(atamayaUygunAraclar) ? atamayaUygunAraclar : [];

    const activeZimmet = React.useMemo(() => {
        return zimmetler.find((z: any) => !z.bitis && z.aracId === p.arac?.id) || zimmetler.find((z: any) => !z.bitis) || null;
    }, [p.arac?.id, zimmetler]);
    const personelYakitOrtalamasi = React.useMemo(() => {
        const raw = Number(p.ortalamaYakit100Km);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return raw;
    }, [p.ortalamaYakit100Km]);
    const personelYakitTuketimBirimiEtiketi = React.useMemo(
        () => (p.yakitTuketimBirimi === "LITRE_PER_HOUR" ? "L/saat" : "L/100 km"),
        [p.yakitTuketimBirimi]
    );
    const personelYakitAralikSayisi = Number(p.ortalamaYakitIntervalSayisi || 0);
    const personelYakitReferansOrtalamasi = React.useMemo(() => {
        const raw = Number(p.yakitKarsilastirmaReferans100Km);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return raw;
    }, [p.yakitKarsilastirmaReferans100Km]);
    const personelOrtalamaUstuYakit = Boolean(p.ortalamaUstuYakit);
    const personelTabloToplamlari = React.useMemo(() => ({
        zimmetKm: getZimmetKmDelta(zimmetler),
        cezaTutar: sumBy(cezalar, (kayit) => kayit.tutar),
        arizaTutar: sumBy(arizalar, (kayit) => kayit.tutar),
        servisTutar: sumBy(bakimKayitlari, (kayit) => kayit.tutar),
        yakitKm: getFuelKmDelta(yakitKayitlari),
        yakitLitre: sumBy(yakitKayitlari, (kayit) => kayit.litre),
        yakitTutar: sumBy(yakitKayitlari, (kayit) => kayit.tutar),
        masrafTutar: sumBy(masraflar, (kayit) => kayit.tutar),
    }), [arizalar, bakimKayitlari, cezalar, masraflar, yakitKayitlari, zimmetler]);

    const handleUpdate = async () => {
        setLoading(true);
        const res = await updatePersonel(p.id, formData);
        if (res.success) {
            toast.success("Personel bilgileri güncellendi");
            setEditOpen(false);
            router.refresh();
        } else {
            toast.error(res.error || "Güncelleme başarısız");
        }
        setLoading(false);
    };

    const handleDelete = async () => {
        const confirmed = await openConfirm({ title: "Personeli Sil", message: "Bu personeli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.", confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        setLoading(true);
        const res = await deletePersonel(p.id);
        if (res.success) {
            toast.success("Personel silindi");
            router.push(scopedHref('/dashboard/personel'));
        } else {
            toast.error(res.error || "Silme işlemi başarısız");
        }
        setLoading(false);
    };

    const resetIadeData = () => {
        setIadeData({
            bitis: nowDateTimeLocal(),
            bitisKm: getDefaultIadeKm(),
            notlar: activeZimmet?.notlar || "",
        });
    };

    const handleAraciBirak = async () => {
        if (!p.arac?.id) {
            toast.warning("Aktif araç bulunamadı.");
            return;
        }
        if (!activeZimmet?.id) {
            toast.warning("Aktif zimmet kaydı bulunamadı.");
            return;
        }
        if (!iadeData.bitis || !iadeData.bitisKm) {
            toast.warning("Eksik Bilgi", { description: "Teslim alma tarihi ve teslim alma KM zorunludur." });
            return;
        }

        setLoading(true);
        const res = await finalizeZimmet(activeZimmet.id, {
            bitis: iadeData.bitis,
            bitisKm: Number(iadeData.bitisKm),
            notlar: iadeData.notlar || null,
        });
        if (res.success) {
            toast.success("Araç başarıyla bırakıldı");
            setIadeOpen(false);
            resetIadeData();
            router.refresh();
        } else {
            toast.error(res.error || "İşlem başarısız");
        }
        setLoading(false);
    };

    const handleDeleteZimmet = async (rowId: string) => {
        const confirmed = await openConfirm({
            title: "Zimmet Kaydını Sil",
            message: "Bu zimmet kaydını silmek istediğinizden emin misiniz?",
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteZimmet(rowId);
        if (res.success) {
            toast.success("Zimmet kaydı silindi");
            router.refresh();
        } else {
            toast.error("Silme başarısız", { description: res.error });
        }
        setActionLoading(false);
    };

    const openYakitEdit = (row: any) => {
        setYakitData({
            tarih: toDateTimeLocalInput(row.tarih),
            litre: row.litre != null ? String(row.litre) : "",
            tutar: row.tutar != null ? String(row.tutar) : "",
            km: row.km != null ? String(row.km) : "",
            istasyon: row.istasyon || "",
            odemeYontemi: row.odemeYontemi,
            soforId: row.soforId || p.id,
        });
        setYakitEditRow(row);
        setYakitOpen(true);
    };

    const handleDeleteYakit = async (rowId: string) => {
        const confirmed = await openConfirm({
            title: "Yakıt Kaydını Sil",
            message: "Bu yakıt kaydını silmek istediğinizden emin misiniz?",
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteYakit(rowId);
        if (res.success) {
            toast.success("Yakıt kaydı silindi");
            router.refresh();
        } else {
            toast.error("Silme başarısız", { description: res.error });
        }
        setActionLoading(false);
    };

    const openCezaEdit = (row: any) => {
        setCezaData({
            tarih: toDateTimeLocalInput(row.tarih),
            tutar: row.tutar != null ? String(row.tutar) : "",
            cezaMaddesi: row.cezaMaddesi || "",
            aciklama: row.aciklama || "",
            aracId: row.aracId || "",
            soforId: row.soforId || p.id,
        });
        setCezaEditRow(row);
        setCezaOpen(true);
    };

    const handleDeleteCeza = async (rowId: string) => {
        const confirmed = await openConfirm({
            title: "Ceza Kaydını Sil",
            message: "Bu ceza kaydını silmek istediğinizden emin misiniz?",
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteCeza(rowId);
        if (res.success) {
            toast.success("Ceza kaydı silindi");
            router.refresh();
        } else {
            toast.error("Silme başarısız", { description: res.error });
        }
        setActionLoading(false);
    };

    const openArizaEdit = (row: any) => {
        setArizaData({
            bildirimTarihi: toDateTimeLocalInput(row.bildirimTarihi),
            aciklama: row.aciklama || "",
            oncelik: row.oncelik,
            km: row.km != null ? String(row.km) : "",
            aracId: row.aracId || "",
            soforId: row.soforId || p.id,
        });
        setArizaEditRow(row);
        setArizaOpen(true);
    };

    const handleDeleteAriza = async (rowId: string) => {
        const confirmed = await openConfirm({
            title: "Kaza Kaydını Sil",
            message: "Bu kaza kaydını silmek istediğinizden emin misiniz?",
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteArizaKaydi(rowId);
        if (res.success) {
            toast.success("Kaza kaydı silindi");
            router.refresh();
        } else {
            toast.error("Silme başarısız", { description: res.error });
        }
        setActionLoading(false);
    };

    const openBakimEdit = (row: any) => {
        setBakimData({
            bakimTarihi: toDateTimeLocalInput(row.bakimTarihi),
            tip: row.tip,
            servisAdi: row.servisAdi || "",
            yapilanIslemler: row.yapilanIslemler || "",
            tutar: row.tutar != null ? String(row.tutar) : "",
            km: row.km != null ? String(row.km) : "",
            aracId: row.aracId || "",
            soforId: row.soforId || p.id,
        });
        setBakimEditRow(row);
        setBakimOpen(true);
    };

    const handleDeleteBakim = async (rowId: string) => {
        const confirmed = await openConfirm({
            title: "Bakım Kaydını Sil",
            message: "Bu bakım kaydını silmek istediğinizden emin misiniz?",
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteBakim(rowId);
        if (res.success) {
            toast.success("Bakım kaydı silindi");
            router.refresh();
        } else {
            toast.error("Silme başarısız", { description: res.error });
        }
        setActionLoading(false);
    };

    const openMasrafEdit = (row: any) => {
        setMasrafData({
            tarih: toDateTimeLocalInput(row.tarih),
            tur: row.tur,
            tutar: row.tutar != null ? String(row.tutar) : "",
            aciklama: row.aciklama || "",
            aracId: row.aracId || "",
        });
        setMasrafEditRow(row);
        setMasrafOpen(true);
    };

    const handleDeleteMasraf = async (rowId: string) => {
        const confirmed = await openConfirm({
            title: "Masraf Kaydını Sil",
            message: "Bu masraf kaydını silmek istediğinizden emin misiniz?",
            confirmText: "Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        setActionLoading(true);
        const res = await deleteMasraf(rowId);
        if (res.success) {
            toast.success("Masraf kaydı silindi");
            router.refresh();
        } else {
            toast.error("Silme başarısız", { description: res.error });
        }
        setActionLoading(false);
    };

    const handleAtamaAracChange = (aracId: string) => {
        const seciliArac = atamayaUygunAraclar.find((arac) => arac.id === aracId);
        setAtamaData((prev) => ({
            ...prev,
            aracId,
            baslangicKm: seciliArac ? String(seciliArac.guncelKm || 0) : prev.baslangicKm
        }));
    };

    const handleAracAta = async () => {
        if (!atamaData.aracId) {
            toast.warning("Araç Seçilmedi", { description: "Lütfen atamak için bir araç seçin." });
            return;
        }

        setLoading(true);
        const res = await createZimmet({
            aracId: atamaData.aracId,
            kullaniciId: p.id,
            baslangic: atamaData.baslangic,
            baslangicKm: Number(atamaData.baslangicKm || 0),
            notlar: atamaData.notlar || undefined
        });

        if (res.success) {
            toast.success("Araç ataması yapıldı");
            setAtamaOpen(false);
            setAtamaData({
                aracId: '',
                baslangic: nowDateTimeLocal(),
                baslangicKm: '',
                notlar: ''
            });
            router.refresh();
        } else {
            toast.error(res.error || "Araç ataması başarısız");
        }
        setLoading(false);
    };

    const getRoleBadge = (rol: string) => {
        switch (rol) {
            case 'ADMIN': return <Badge className="bg-red-100 text-red-800 border-0">Admin</Badge>;
            case 'YETKILI': return <Badge className="bg-indigo-100 text-indigo-800 border-0">Yetkili</Badge>;
            case 'TEKNIK': return <Badge className="bg-emerald-100 text-emerald-800 border-0">Teknik</Badge>;
            case 'PERSONEL': return <Badge className="bg-amber-100 text-amber-800 border-0">{getRoleLabel(rol)}</Badge>;
            default: return <Badge variant="outline">{getRoleLabel(rol)}</Badge>;
        }
    };

    return (
        <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
        {confirmModal}
            <main className="flex-1 p-6 md:p-8 xl:p-12 min-w-0 max-w-[1400px] mx-auto">
                <button
                    onClick={() => router.push(scopedHref('/dashboard/personel'))}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium text-sm mb-6 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Personel Listesine Dön
                </button>

                <div className="mb-4 flex justify-end gap-2">
                    <button
                        onClick={() => setEditOpen(true)}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                    >
                        <Pencil size={15} />
                        Personeli Düzenle
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 shadow-sm transition-colors hover:bg-rose-100 disabled:opacity-50"
                    >
                        <Trash2 size={15} />
                        Personeli Sil
                    </button>
                </div>

                {/* Personel Header Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 lg:p-8 mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-6">
                        <div className="h-20 w-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-100 uppercase">
                            {p.ad?.charAt(0)}{p.soyad?.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <h1 className="text-3xl font-bold text-slate-900">{p.ad} {p.soyad}</h1>
                                {getRoleBadge(p.rol)}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500 mt-2 mb-4">
                                <div className="flex items-center gap-1.5"><Briefcase size={16} /> {p.sirket?.ad || 'Firma Belirtilmemiş'}</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5"><Building2 size={16} /> {p.calistigiKurum || p.sehir || 'Kurum Belirtilmemiş'}</div>
                                <div className="flex items-center gap-1.5"><MapPin size={16} /> {p.santiye || 'Şantiye Belirtilmemiş'}</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5">
                                    <Fuel size={16} />
                                    {personelYakitOrtalamasi !== null
                                        ? `${formatDecimal(personelYakitOrtalamasi, 1)} ${personelYakitTuketimBirimiEtiketi}`
                                        : "Yakıt ortalaması yok"}
                                    {personelYakitOrtalamasi !== null && personelYakitAralikSayisi > 0 ? (
                                        <span className="text-[11px] text-slate-400">({personelYakitAralikSayisi} aralık)</span>
                                    ) : null}
                                    {personelYakitReferansOrtalamasi !== null ? (
                                        <span className="text-[11px] text-slate-500">
                                            Filo ort: {formatDecimal(personelYakitReferansOrtalamasi, 1)} {personelYakitTuketimBirimiEtiketi}
                                        </span>
                                    ) : null}
                                    {personelOrtalamaUstuYakit ? (
                                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                            Ortalama Üstü
                                        </span>
                                    ) : null}
                                </div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">TC: {p.tcNo || 'Belirtilmemiş'}</div>
                            </div>

                        </div>
                    </div>

                    <div className="flex flex-col gap-3">

                        <div className="bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl p-5 min-w-[320px]">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zimmetli Araç</p>
                            {p.arac && (
                                <Dialog
                                    open={iadeOpen}
                                    onOpenChange={(open) => {
                                        setIadeOpen(open);
                                        if (open) {
                                            resetIadeData();
                                        }
                                    }}
                                >
                                    <DialogTrigger asChild>
                                        <button
                                            disabled={loading}
                                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded transition-colors disabled:opacity-50"
                                        >
                                            ARACI BIRAK
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent >
                                        <DialogHeader>
                                            <DialogTitle>Zimmeti Sonlandır</DialogTitle>
                                            <DialogDescription>
                                                {p.arac?.plaka} aracını {p.ad} {p.soyad} üzerinden teslim alın.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">Teslim Alma Tarihi</label>
                                                    <Input type="datetime-local" value={iadeData.bitis} onChange={e => setIadeData({ ...iadeData, bitis: e.target.value })} className="h-9" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">Teslim Alma KM</label>
                                                    <Input type="number" value={iadeData.bitisKm} onChange={e => setIadeData({ ...iadeData, bitisKm: e.target.value })} className="h-9" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Not</label>
                                                <Input value={iadeData.notlar} onChange={e => setIadeData({ ...iadeData, notlar: e.target.value })} className="h-9" placeholder="Opsiyonel not" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <button onClick={handleAraciBirak} disabled={loading} className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                                {loading ? "Sonlandırılıyor..." : "Zimmeti Sonlandır"}
                                            </button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            {!p.arac && (
                                <Dialog open={atamaOpen} onOpenChange={setAtamaOpen}>
                                    <DialogTrigger asChild>
                                        <button
                                            className="text-[10px] font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                            disabled={loading}
                                        >
                                            <Plus size={12} /> ARAÇ ATA
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent >
                                        <DialogHeader>
                                            <DialogTitle>Personel Araca Ata</DialogTitle>
                                            <DialogDescription>
                                                {p.ad} {p.soyad} için araç seçerek zimmet oluşturun.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Araç <span className="text-red-500">*</span></label>
                                                <SearchableSelect
                                                    value={atamaData.aracId}
                                                    onValueChange={handleAtamaAracChange}
                                                    placeholder="Araç seçiniz..."
                                                    searchPlaceholder="Plaka / araç ara..."
                                                    options={[
                                                        { value: "", label: "Araç seçiniz..." },
                                                        ...uygunAraclar.map((arac) => ({
                                                            value: arac.id,
                                                            label: formatAracOptionLabel(arac),
                                                            searchText: [arac.plaka, arac.marka, arac.model].filter(Boolean).join(" "),
                                                        })),
                                                    ]}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">Teslim Tarihi</label>
                                                    <Input type="datetime-local" value={atamaData.baslangic} onChange={e => setAtamaData({ ...atamaData, baslangic: e.target.value })} className="h-9" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium">Teslim KM</label>
                                                    <Input type="number" value={atamaData.baslangicKm} onChange={e => setAtamaData({ ...atamaData, baslangicKm: e.target.value })} className="h-9" />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium">Not</label>
                                                <Input value={atamaData.notlar} onChange={e => setAtamaData({ ...atamaData, notlar: e.target.value })} className="h-9" placeholder="Opsiyonel not" />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <button onClick={handleAracAta} disabled={loading || uygunAraclar.length === 0} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                                {loading ? "Atanıyor..." : "Araç Ata"}
                                            </button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                        {p.arac ? (
                            <div 
                                className="flex items-center gap-3 cursor-pointer group"
                                onClick={() => router.push(scopedHref(`/dashboard/araclar/${p.arac.id}`))}
                            >
                                <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                                    <Car size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors uppercase">{p.arac.plaka}</span>
                                    <span className="text-xs font-semibold text-slate-500 mt-0.5">{p.arac.marka} {p.arac.model}</span>
                                    {canAccessAllCompanies && p.arac.sirket?.ad ? (
                                        <span className="text-xs font-semibold text-indigo-600 mt-0.5">{p.arac.sirket.ad}</span>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400 text-sm italic font-medium">
                                <Car size={18} />
                                Zimmetli araç bulunmuyor.
                            </div>
                        )}
                    </div>
                </div>
            </div>

                <Tabs defaultValue="iletisim" className="w-full">
                    <TabsList className="flex h-auto gap-2 bg-transparent border-b border-slate-200 w-full rounded-none pb-2 mb-6">
                        <TabsTrigger value="iletisim" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            İletişim & Detaylar
                        </TabsTrigger>
                        <TabsTrigger value="zimmetGecmisi" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Araç Zimmet Geçmişi
                        </TabsTrigger>
                        <TabsTrigger value="cezalar" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Cezalar
                        </TabsTrigger>
                        <TabsTrigger value="arizalar" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Kaza Kayıtları
                        </TabsTrigger>
                        <TabsTrigger value="servisler" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Servis Kayıtları
                        </TabsTrigger>
                        <TabsTrigger value="yakit" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Yakıt Harcamaları
                        </TabsTrigger>
                        <TabsTrigger value="masraflar" className="px-4 py-2 rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                            Masraflar
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="iletisim">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <Card>
                                <CardHeader className="bg-slate-50 py-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Phone size={16} className="text-indigo-600" /> İletişim Bilgileri
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Giriş Adı</p>
                                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <Mail size={14} className="text-slate-400" /> {p.hesap?.kullaniciAdi || "Tanımlı değil"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Telefon Numarası</p>
                                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <Phone size={14} className="text-slate-400" /> {p.telefon || 'Belirtilmemiş'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="bg-slate-50 py-3">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Calendar size={16} className="text-indigo-600" /> Kayıt Bilgileri
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Sisteme Giriş</p>
                                        <p className="text-sm font-semibold text-slate-800">{formatDate(p.olusturmaTarihi)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Son Güncelleme</p>
                                        <p className="text-sm font-semibold text-slate-800">{formatDate(p.guncellemeTarihi)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="zimmetGecmisi">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Araç Plaka</TableHead>
                                        <TableHead>Alış Tarihi</TableHead>
                                        <TableHead>Bitiş Tarihi</TableHead>
                                        <TableHead className="text-right">KM Bilgisi (Alış / Veriş)</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {zimmetler.length > 0 ? (
                                        zimmetler.map((z: any) => (
                                            <TableRow key={z.id}>
                                                <TableCell 
                                                    className="font-bold text-indigo-600 cursor-pointer uppercase"
                                                    onClick={() => z.arac?.id && router.push(scopedHref(`/dashboard/araclar/${z.arac.id}`))}
                                                >
                                                    <div className="flex flex-col">
                                                        <AracLink aracId={z.arac?.id} className="hover:underline">
                                                            {z.arac?.plaka || "-"}
                                                        </AracLink>
                                                        {canAccessAllCompanies && z.arac?.sirket?.ad ? (
                                                            <span className="text-[11px] font-semibold text-indigo-500 normal-case">{z.arac.sirket.ad}</span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatDate(z.baslangic)}</TableCell>
                                                <TableCell>{z.bitis ? formatDate(z.bitis) : <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">Aktif</Badge>}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">
                                                    {formatKm(z.baslangicKm)} / {z.bitisKm != null ? formatKm(z.bitisKm) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <RowActionButton variant="delete" onClick={() => handleDeleteZimmet(z.id)} disabled={actionLoading} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                                                Geçmiş zimmet kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                {zimmetler.length > 0 ? (
                                    <TableFooter className="bg-slate-50/90">
                                        <TableRow>
                                            <TableCell colSpan={3} className="font-bold text-slate-900">Toplam</TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">{formatKm(personelTabloToplamlari.zimmetKm)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                ) : null}
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="cezalar">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Araç Plaka</TableHead>
                                        <TableHead>Ceza Maddesi</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cezalar.length > 0 ? (
                                        cezalar.map((c: any) => (
                                            <TableRow key={c.id}>
                                                <TableCell>{formatDate(c.tarih)}</TableCell>
                                                <TableCell className="font-mono font-bold">
                                                    <div className="flex flex-col">
                                                        <AracLink aracId={c.arac?.id} className="hover:text-indigo-600 hover:underline">
                                                            {c.arac?.plaka}
                                                        </AracLink>
                                                        {canAccessAllCompanies && c.arac?.sirket?.ad ? (
                                                            <span className="text-[11px] font-semibold text-indigo-500 normal-case">{c.arac.sirket.ad}</span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600">{c.cezaMaddesi || c.aciklama || '-'}</TableCell>
                                                <TableCell className="text-right font-bold text-rose-600">{formatCurrency(c.tutar)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <RowActionButton variant="edit" onClick={() => openCezaEdit(c)} disabled={actionLoading} />
                                                        <RowActionButton variant="delete" onClick={() => handleDeleteCeza(c.id)} disabled={actionLoading} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                                                Ceza kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                {cezalar.length > 0 ? (
                                    <TableFooter className="bg-slate-50/90">
                                        <TableRow>
                                            <TableCell colSpan={3} className="font-bold text-slate-900">Toplam</TableCell>
                                            <TableCell className="text-right font-bold text-rose-600">{formatCurrency(personelTabloToplamlari.cezaTutar)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                ) : null}
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="arizalar">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Bildirim Tarihi</TableHead>
                                        <TableHead>Araç Plaka</TableHead>
                                        <TableHead>Öncelik</TableHead>
                                        <TableHead>Durum</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {arizalar.length > 0 ? (
                                        arizalar.map((a: any) => (
                                            <TableRow key={a.id}>
                                                <TableCell>{formatDate(a.bildirimTarihi)}</TableCell>
                                                <TableCell className="font-mono font-bold">
                                                    <div className="flex flex-col">
                                                        <AracLink aracId={a.arac?.id} className="hover:text-indigo-600 hover:underline">
                                                            {a.arac?.plaka || "-"}
                                                        </AracLink>
                                                        {canAccessAllCompanies && a.arac?.sirket?.ad ? (
                                                            <span className="text-[11px] font-semibold text-indigo-500 normal-case">{a.arac.sirket.ad}</span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {a.oncelik === "DUSUK" ? (
                                                        <Badge className="bg-slate-100 text-slate-700 border-0 shadow-none">Düşük</Badge>
                                                    ) : a.oncelik === "ORTA" ? (
                                                        <Badge className="bg-blue-100 text-blue-700 border-0 shadow-none">Orta</Badge>
                                                    ) : (
                                                        <Badge className="bg-orange-100 text-orange-700 border-0 shadow-none">Yüksek</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {a.durum === "ACIK" ? (
                                                        <Badge className="bg-rose-100 text-rose-700 border-0 shadow-none">Açık</Badge>
                                                    ) : a.durum === "SERVISTE" ? (
                                                        <Badge className="bg-amber-100 text-amber-700 border-0 shadow-none">Serviste</Badge>
                                                    ) : a.durum === "TAMAMLANDI" ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 border-0 shadow-none">Tamamlandı</Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-100 text-slate-700 border-0 shadow-none">İptal</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-600 max-w-[260px] truncate" title={a.aciklama || "-"}>
                                                    {a.aciklama || "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">
                                                    {formatCurrency(a.tutar)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <RowActionButton variant="edit" onClick={() => openArizaEdit(a)} disabled={actionLoading} />
                                                        <RowActionButton variant="delete" onClick={() => handleDeleteAriza(a.id)} disabled={actionLoading} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">
                                                Bu personele ait kaza kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                {arizalar.length > 0 ? (
                                    <TableFooter className="bg-slate-50/90">
                                        <TableRow>
                                            <TableCell colSpan={5} className="font-bold text-slate-900">Toplam</TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">{formatCurrency(personelTabloToplamlari.arizaTutar)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                ) : null}
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="servisler">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Araç Plaka</TableHead>
                                        <TableHead>Arıza Şikayet</TableHead>
                                        <TableHead>Yapılan İşlem</TableHead>
                                        <TableHead>Değişen Parça</TableHead>
                                        <TableHead>İşlem Yapan Firma</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bakimKayitlari.length > 0 ? (
                                        bakimKayitlari.map((b: any) => (
                                            <TableRow key={b.id}>
                                                <TableCell>{formatDate(b.bakimTarihi)}</TableCell>
                                                <TableCell className="font-mono font-bold">
                                                    <div className="flex flex-col">
                                                        <AracLink aracId={b.arac?.id} className="hover:text-indigo-600 hover:underline">
                                                            {b.arac?.plaka || "-"}
                                                        </AracLink>
                                                        {canAccessAllCompanies && b.arac?.sirket?.ad ? (
                                                            <span className="text-[11px] font-semibold text-indigo-500 normal-case">{b.arac.sirket.ad}</span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-700 max-w-[220px] truncate" title={b.arizaSikayet || ""}>{b.arizaSikayet || "-"}</TableCell>
                                                <TableCell className="text-slate-700 max-w-[220px] truncate" title={b.yapilanIslemler || ""}>{b.yapilanIslemler || "-"}</TableCell>
                                                <TableCell className="text-slate-700 max-w-[220px] truncate" title={b.degisenParca || ""}>{b.degisenParca || "-"}</TableCell>
                                                <TableCell className="text-slate-700">{b.islemYapanFirma || b.servisAdi || "-"}</TableCell>
                                                <TableCell className="text-right font-bold text-slate-900">
                                                    {formatCurrency(b.tutar)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <RowActionButton variant="edit" onClick={() => openBakimEdit(b)} disabled={actionLoading} />
                                                        <RowActionButton variant="delete" onClick={() => handleDeleteBakim(b.id)} disabled={actionLoading} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic">
                                                Bu personele ait servis kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                {bakimKayitlari.length > 0 ? (
                                    <TableFooter className="bg-slate-50/90">
                                        <TableRow>
                                            <TableCell colSpan={6} className="font-bold text-slate-900">Toplam</TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">{formatCurrency(personelTabloToplamlari.servisTutar)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                ) : null}
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="yakit">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Araç Plaka</TableHead>
                                        <TableHead>İstasyon</TableHead>
                                        <TableHead className="text-right">Araç KM</TableHead>
                                        <TableHead>Litre</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {yakitKayitlari.length > 0 ? (
                                        yakitKayitlari.map((y: any) => (
                                            <TableRow key={y.id}>
                                                <TableCell>{formatDate(y.tarih)}</TableCell>
                                                <TableCell className="font-mono font-bold">
                                                    <div className="flex flex-col">
                                                        <AracLink aracId={y.arac?.id} className="hover:text-indigo-600 hover:underline">
                                                            {y.arac?.plaka || "-"}
                                                        </AracLink>
                                                        {canAccessAllCompanies && y.arac?.sirket?.ad ? (
                                                            <span className="text-[11px] font-semibold text-indigo-500 normal-case">{y.arac.sirket.ad}</span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{y.istasyon || '-'}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{formatKm(y.km)}</TableCell>
                                                <TableCell>{formatLitres(y.litre)}</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(y.tutar)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <RowActionButton variant="edit" onClick={() => openYakitEdit(y)} disabled={actionLoading} />
                                                        <RowActionButton variant="delete" onClick={() => handleDeleteYakit(y.id)} disabled={actionLoading} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">
                                                Bu personele atanmış yakıt kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                {yakitKayitlari.length > 0 ? (
                                    <TableFooter className="bg-slate-50/90">
                                        <TableRow>
                                            <TableCell colSpan={3} className="font-bold text-slate-900">Toplam</TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">{formatKm(personelTabloToplamlari.yakitKm)}</TableCell>
                                            <TableCell className="font-bold text-slate-900">{formatLitres(personelTabloToplamlari.yakitLitre)}</TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">{formatCurrency(personelTabloToplamlari.yakitTutar)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                ) : null}
                            </Table>
                        </Card>
                    </TabsContent>

                    <TabsContent value="masraflar">
                        <Card className="overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {masraflar.length > 0 ? (
                                        masraflar.map((m: any) => (
                                            <TableRow key={m.id}>
                                                <TableCell>{formatDate(m.tarih)}</TableCell>
                                                <TableCell><Badge variant="outline">{m.tur}</Badge></TableCell>
                                                <TableCell className="text-slate-600">{m.aciklama || '-'}</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(m.tutar)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <RowActionButton variant="edit" onClick={() => openMasrafEdit(m)} disabled={actionLoading} />
                                                        <RowActionButton variant="delete" onClick={() => handleDeleteMasraf(m.id)} disabled={actionLoading} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">
                                                Mevcut araç üzerinde masraf kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                {masraflar.length > 0 ? (
                                    <TableFooter className="bg-slate-50/90">
                                        <TableRow>
                                            <TableCell colSpan={3} className="font-bold text-slate-900">Toplam</TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">{formatCurrency(personelTabloToplamlari.masrafTutar)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                ) : null}
                            </Table>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Dialog open={yakitOpen} onOpenChange={setYakitOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yakıt Kaydını Düzenle</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Tarih</label>
                                <Input
                                    type="datetime-local"
                                    className="col-span-3"
                                    value={yakitData.tarih}
                                    onChange={(e) => setYakitData({ ...yakitData, tarih: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Litre</label>
                                <Input
                                    type="number"
                                    className="col-span-3"
                                    value={yakitData.litre}
                                    onChange={(e) => setYakitData({ ...yakitData, litre: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Tutar (₺)</label>
                                <Input
                                    type="number"
                                    className="col-span-3"
                                    value={yakitData.tutar}
                                    onChange={(e) => setYakitData({ ...yakitData, tutar: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Araç KM</label>
                                <Input
                                    type="number"
                                    className="col-span-3"
                                    value={yakitData.km}
                                    onChange={(e) => setYakitData({ ...yakitData, km: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">İstasyon</label>
                                <Input
                                    className="col-span-3"
                                    value={yakitData.istasyon}
                                    onChange={(e) => setYakitData({ ...yakitData, istasyon: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <button
                                onClick={async () => {
                                    if (!yakitEditRow) return;
                                    setActionLoading(true);
                                    const res = await updateYakit(yakitEditRow.id, {
                                        tarih: yakitData.tarih,
                                        litre: Number(yakitData.litre),
                                        tutar: Number(yakitData.tutar),
                                        km: yakitData.km ? Number(yakitData.km) : null,
                                        istasyon: yakitData.istasyon,
                                        odemeYontemi: yakitData.odemeYontemi,
                                        soforId: yakitData.soforId,
                                    });
                                    if (res.success) {
                                        toast.success("Yakıt kaydı güncellendi");
                                        setYakitOpen(false);
                                        router.refresh();
                                    } else {
                                        toast.error("Hata", { description: res.error });
                                    }
                                    setActionLoading(false);
                                }}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {actionLoading ? "Kaydediliyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={arizaOpen} onOpenChange={setArizaOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Kaza Kaydını Düzenle</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Bildirim Tarihi</label>
                                <Input
                                    type="datetime-local"
                                    className="col-span-3"
                                    value={arizaData.bildirimTarihi}
                                    onChange={(e) => setArizaData({ ...arizaData, bildirimTarihi: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Açıklama</label>
                                <Input
                                    className="col-span-3"
                                    value={arizaData.aciklama}
                                    onChange={(e) => setArizaData({ ...arizaData, aciklama: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Öncelik</label>
                                <select
                                    className="col-span-3 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                                    value={arizaData.oncelik}
                                    onChange={(e) => setArizaData({ ...arizaData, oncelik: e.target.value as any })}
                                >
                                    <option value="DUSUK">Düşük</option>
                                    <option value="ORTA">Orta</option>
                                    <option value="YUKSEK">Yüksek</option>
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <button
                                onClick={async () => {
                                    if (!arizaEditRow) return;
                                    setActionLoading(true);
                                    const res = await updateArizaKaydi(arizaEditRow.id, {
                                        bildirimTarihi: new Date(arizaData.bildirimTarihi),
                                        aciklama: arizaData.aciklama,
                                        oncelik: arizaData.oncelik,
                                        km: Number(arizaData.km),
                                        soforId: arizaData.soforId,
                                    });
                                    if (res.success) {
                                        toast.success("Kaza kaydı güncellendi");
                                        setArizaOpen(false);
                                        router.refresh();
                                    } else {
                                        toast.error("Hata", { description: res.error });
                                    }
                                    setActionLoading(false);
                                }}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {actionLoading ? "Kaydediliyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={cezaOpen} onOpenChange={setCezaOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Ceza Kaydını Düzenle</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Tarih</label>
                                <Input
                                    type="datetime-local"
                                    className="col-span-3"
                                    value={cezaData.tarih}
                                    onChange={(e) => setCezaData({ ...cezaData, tarih: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Tutar (₺)</label>
                                <Input
                                    type="number"
                                    className="col-span-3"
                                    value={cezaData.tutar}
                                    onChange={(e) => setCezaData({ ...cezaData, tutar: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Ceza Maddesi</label>
                                <Input
                                    className="col-span-3"
                                    value={cezaData.cezaMaddesi}
                                    onChange={(e) => setCezaData({ ...cezaData, cezaMaddesi: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Açıklama</label>
                                <Input
                                    className="col-span-3"
                                    value={cezaData.aciklama}
                                    onChange={(e) => setCezaData({ ...cezaData, aciklama: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <button
                                onClick={async () => {
                                    if (!cezaEditRow) return;
                                    setActionLoading(true);
                                    const res = await updateCeza(cezaEditRow.id, {
                                        tarih: new Date(cezaData.tarih),
                                        tutar: Number(cezaData.tutar),
                                        cezaMaddesi: cezaData.cezaMaddesi,
                                        aciklama: cezaData.aciklama,
                                        aracId: cezaData.aracId,
                                        soforId: cezaData.soforId,
                                    });
                                    if (res.success) {
                                        toast.success("Ceza kaydı güncellendi");
                                        setCezaOpen(false);
                                        router.refresh();
                                    } else {
                                        toast.error("Hata", { description: res.error });
                                    }
                                    setActionLoading(false);
                                }}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {actionLoading ? "Kaydediliyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={bakimOpen} onOpenChange={setBakimOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Bakım Kaydını Düzenle</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Tarih</label>
                                <Input
                                    type="datetime-local"
                                    className="col-span-3"
                                    value={bakimData.bakimTarihi}
                                    onChange={(e) => setBakimData({ ...bakimData, bakimTarihi: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Servis Adı</label>
                                <Input
                                    className="col-span-3"
                                    value={bakimData.servisAdi}
                                    onChange={(e) => setBakimData({ ...bakimData, servisAdi: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Tutar (₺)</label>
                                <Input
                                    type="number"
                                    className="col-span-3"
                                    value={bakimData.tutar}
                                    onChange={(e) => setBakimData({ ...bakimData, tutar: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Araç KM</label>
                                <Input
                                    type="number"
                                    className="col-span-3"
                                    value={bakimData.km}
                                    onChange={(e) => setBakimData({ ...bakimData, km: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <button
                                onClick={async () => {
                                    if (!bakimEditRow) return;
                                    setActionLoading(true);
                                    const res = await updateBakim(bakimEditRow.id, {
                                        bakimTarihi: new Date(bakimData.bakimTarihi),
                                        tur: bakimData.tip,
                                        servisAdi: bakimData.servisAdi,
                                        yapilanIslemler: bakimData.yapilanIslemler,
                                        tutar: Number(bakimData.tutar),
                                        yapilanKm: Number(bakimData.km),
                                        aracId: bakimData.aracId,
                                        soforId: bakimData.soforId,
                                    });
                                    if (res.success) {
                                        toast.success("Bakım kaydı güncellendi");
                                        setBakimOpen(false);
                                        router.refresh();
                                    } else {
                                        toast.error("Hata", { description: res.error });
                                    }
                                    setActionLoading(false);
                                }}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {actionLoading ? "Kaydediliyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={masrafOpen} onOpenChange={setMasrafOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Masraf Kaydını Düzenle</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Tarih</label>
                                <Input
                                    type="datetime-local"
                                    className="col-span-3"
                                    value={masrafData.tarih}
                                    onChange={(e) => setMasrafData({ ...masrafData, tarih: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Tutar (₺)</label>
                                <Input
                                    type="number"
                                    className="col-span-3"
                                    value={masrafData.tutar}
                                    onChange={(e) => setMasrafData({ ...masrafData, tutar: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <label className="text-right text-sm">Açıklama</label>
                                <Input
                                    className="col-span-3"
                                    value={masrafData.aciklama}
                                    onChange={(e) => setMasrafData({ ...masrafData, aciklama: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <button
                                onClick={async () => {
                                    if (!masrafEditRow) return;
                                    setActionLoading(true);
                                    const res = await updateMasraf(masrafEditRow.id, {
                                        tarih: new Date(masrafData.tarih),
                                        tur: masrafData.tur,
                                        tutar: Number(masrafData.tutar),
                                        aciklama: masrafData.aciklama,
                                        aracId: masrafData.aracId,
                                    });
                                    if (res.success) {
                                        toast.success("Masraf kaydı güncellendi");
                                        setMasrafOpen(false);
                                        router.refresh();
                                    } else {
                                        toast.error("Hata", { description: res.error });
                                    }
                                    setActionLoading(false);
                                }}
                                disabled={actionLoading}
                                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                                {actionLoading ? "Kaydediliyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Personeli Düzenle</DialogTitle>
                            <DialogDescription>{p.ad} {p.soyad} kişisinin bilgilerini güncelleyin.</DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} sirketler={sirketler} />
                        <DialogFooter>
                            <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Güncelleniyor...' : 'Güncelle'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
