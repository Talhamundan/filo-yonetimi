"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Mail, Phone, Building2, Briefcase, Car, ArrowLeft, Calendar, Plus, Pencil, Trash2, Fuel
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { FormFields, type PersonelFormData } from "../PersonelForm";
import { updatePersonel, deletePersonel } from "../actions";
import { useState } from "react";
import { toast } from "sonner";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { createZimmet, finalizeZimmet } from "../../zimmetler/actions";
import { AracLink } from "@/components/links/RecordLinks";
import { nowDateTimeLocal } from "@/lib/datetime-local";
import { getRoleLabel } from "@/lib/role-label";
import { formatAracOptionLabel } from "@/lib/arac-option-label";

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
    const [editOpen, setEditOpen] = useState(false);
    const [formData, setFormData] = useState<PersonelFormData>({
        ad: p.ad,
        soyad: p.soyad,
        telefon: p.telefon || '',
        rol: p.rol,
        sirketId: p.sirketId || '',
        calistigiKurum: p.calistigiKurum || p.sehir || '',
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
        bitisKm: p.arac?.guncelKm ? String(p.arac.guncelKm) : "",
        notlar: "",
    });

    const activeZimmet = React.useMemo(() => {
        const zimmetler = Array.isArray(p.zimmetler) ? p.zimmetler : [];
        return zimmetler.find((z: any) => !z.bitis && z.aracId === p.arac?.id) || zimmetler.find((z: any) => !z.bitis) || null;
    }, [p.arac?.id, p.zimmetler]);
    const personelYakitOrtalamasi = React.useMemo(() => {
        const raw = Number(p.ortalamaYakit100Km);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return raw;
    }, [p.ortalamaYakit100Km]);
    const personelYakitAralikSayisi = Number(p.ortalamaYakitIntervalSayisi || 0);
    const personelYakitReferansOrtalamasi = React.useMemo(() => {
        const raw = Number(p.yakitKarsilastirmaReferans100Km);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return raw;
    }, [p.yakitKarsilastirmaReferans100Km]);
    const personelOrtalamaUstuYakit = Boolean(p.ortalamaUstuYakit);

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
            router.push('/dashboard/personel');
        } else {
            toast.error(res.error || "Silme işlemi başarısız");
        }
        setLoading(false);
    };

    const resetIadeData = () => {
        setIadeData({
            bitis: nowDateTimeLocal(),
            bitisKm: p.arac?.guncelKm ? String(p.arac.guncelKm) : "",
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

    const formatDate = (date: string | Date | null | undefined) => 
        date ? format(new Date(date), "dd.MM.yyyy HH:mm", { locale: tr }) : '-';

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
                    onClick={() => router.push('/dashboard/personel')}
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
                                <div className="flex items-center gap-1.5"><Briefcase size={16} /> {p.sirket?.ad || 'Bağımsız'}</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5"><Building2 size={16} /> {p.calistigiKurum || p.sehir || 'Kurum Belirtilmemiş'}</div>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <div className="flex items-center gap-1.5">
                                    <Fuel size={16} />
                                    {personelYakitOrtalamasi !== null
                                        ? `${personelYakitOrtalamasi.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L/100 km`
                                        : "Yakıt ortalaması yok"}
                                    {personelYakitOrtalamasi !== null && personelYakitAralikSayisi > 0 ? (
                                        <span className="text-[11px] text-slate-400">({personelYakitAralikSayisi} aralık)</span>
                                    ) : null}
                                    {personelYakitReferansOrtalamasi !== null ? (
                                        <span className="text-[11px] text-slate-500">
                                            İş makinesi ort: {personelYakitReferansOrtalamasi.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L/100 km
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
                                                        ...atamayaUygunAraclar.map((arac) => ({
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
                                            <button onClick={handleAracAta} disabled={loading || atamayaUygunAraclar.length === 0} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
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
                                onClick={() => router.push(`/dashboard/araclar/${p.arac.id}`)}
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
                            Arıza Kayıtları
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.zimmetler && p.zimmetler.length > 0 ? (
                                        p.zimmetler.map((z: any) => (
                                            <TableRow key={z.id}>
                                                <TableCell 
                                                    className="font-bold text-indigo-600 cursor-pointer uppercase"
                                                    onClick={() => router.push(`/dashboard/araclar/${z.arac.id}`)}
                                                >
                                                    <div className="flex flex-col">
                                                        <AracLink aracId={z.arac.id} className="hover:underline">
                                                            {z.arac.plaka}
                                                        </AracLink>
                                                        {canAccessAllCompanies && z.arac.sirket?.ad ? (
                                                            <span className="text-[11px] font-semibold text-indigo-500 normal-case">{z.arac.sirket.ad}</span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatDate(z.baslangic)}</TableCell>
                                                <TableCell>{z.bitis ? formatDate(z.bitis) : <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">Aktif</Badge>}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">
                                                    {z.baslangicKm.toLocaleString()} km / {z.bitisKm ? `${z.bitisKm.toLocaleString()} km` : '-'}
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.cezalar && p.cezalar.length > 0 ? (
                                        p.cezalar.map((c: any) => (
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
                                                <TableCell className="text-right font-bold text-rose-600">₺{c.tutar.toLocaleString()}</TableCell>
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.arizalar && p.arizalar.length > 0 ? (
                                        p.arizalar.map((a: any) => (
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
                                                    ₺{Number(a.tutar || 0).toLocaleString("tr-TR")}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-slate-400 italic">
                                                Bu personele ait arıza kaydı bulunmuyor.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.bakimKayitlari && p.bakimKayitlari.length > 0 ? (
                                        p.bakimKayitlari.map((b: any) => (
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
                                                    ₺{Number(b.tutar || 0).toLocaleString("tr-TR")}
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
                                        <TableHead>Litre</TableHead>
                                        <TableHead>İstasyon</TableHead>
                                        <TableHead className="text-right">Tutar</TableHead>
                                        <TableHead className="text-right">Araç KM</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(p.yakitKayitlari && p.yakitKayitlari.length > 0) ? (
                                        p.yakitKayitlari.map((y: any) => (
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
                                                <TableCell>{y.litre} L</TableCell>
                                                <TableCell>{y.istasyon || '-'}</TableCell>
                                                <TableCell className="text-right font-bold">₺{y.tutar.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-mono text-xs">{y.km.toLocaleString()} km</TableCell>
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {p.arac?.masraflar && p.arac.masraflar.length > 0 ? (
                                        p.arac.masraflar.map((m: any) => (
                                            <TableRow key={m.id}>
                                                <TableCell>{formatDate(m.tarih)}</TableCell>
                                                <TableCell><Badge variant="outline">{m.tur}</Badge></TableCell>
                                                <TableCell className="text-slate-600">{m.aciklama || '-'}</TableCell>
                                                <TableCell className="text-right font-bold">₺{m.tutar.toLocaleString()}</TableCell>
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
                            </Table>
                        </Card>
                    </TabsContent>
                </Tabs>

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
