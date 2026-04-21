"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Car, Building2, User } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CitySelect } from "@/components/ui/city-select";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, AracRow } from "./columns";
import { createArac, updateArac, deleteArac } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { sortByTextValue } from "@/lib/sort-utils";
import { RowActionButton } from "@/components/ui/row-action-button";
import { KIRALIK_SIRKET_ADI, KIRALIK_SIRKET_OPTION_VALUE, isKiralikSirketName } from "@/lib/ruhsat-sahibi";
import { useDashboardScopedHref } from "@/lib/use-dashboard-scoped-href";

const forceUppercase = (value: string) => value.toLocaleUpperCase("tr-TR");
const toDateTimeLocalInput = (value?: Date | string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const EMPTY = {
    plaka: '',
    marka: '',
    model: '',
    yil: new Date().getFullYear(),
    muayeneGecerlilikTarihi: '',
    bulunduguIl: 'ISTANBUL',
    guncelKm: 0,
    bedel: '',
    aciklama: '',
    calistigiKurum: '',
    sirketId: '',
    disFirmaId: '',
    kullaniciId: '',
    ruhsatSeriNo: '',
    saseNo: '',
    motorNo: '',
    kategori: 'BINEK'
};

const FormFields = ({
    formData,
    setFormData,
    sirketler,
    disFirmalar,
    kullanicilar,
    kullaniciFirmaOptions,
    showInitialMuayeneField = false,
    allowIndependentOption = true,
}: {
    formData: any,
    setFormData: any,
    sirketler: { id: string; ad: string; bulunduguIl?: string }[],
    disFirmalar: Array<{ id: string; ad: string; tur: string }>,
    kullanicilar: Array<{ id: string; adSoyad: string; sirketId?: string | null; sirketAd?: string | null }>,
    kullaniciFirmaOptions: string[],
    showInitialMuayeneField?: boolean,
    allowIndependentOption?: boolean,
}) => {
    const hasKiralikSirket = React.useMemo(
        () => sirketler.some((sirket) => isKiralikSirketName(sirket.ad)),
        [sirketler]
    );

    const searchParams = useSearchParams();
    const disFirmaIdParam = searchParams.get("disFirmaId");
    const isExternalMode = Boolean(disFirmaIdParam);
    const firmaOptions = React.useMemo(() => {
        const options = [...kullaniciFirmaOptions];
        const currentFirma = typeof formData.calistigiKurum === "string" ? formData.calistigiKurum.trim() : "";
        if (currentFirma && !options.some((item) => item.localeCompare(currentFirma, "tr-TR", { sensitivity: "base" }) === 0)) {
            options.push(currentFirma);
        }
        return sortByTextValue(options, (item) => item);
    }, [formData.calistigiKurum, kullaniciFirmaOptions]);

    return (
    <div className="grid grid-cols-2 gap-3 py-2">
        <div className="col-span-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Temel Bilgiler</p>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
                <Car size={14} className="text-slate-400" />
                Plaka <span className="text-rose-500">*</span>
            </label>
            <Input value={formData.plaka} onChange={e => setFormData({...formData, plaka: forceUppercase(e.target.value)})} placeholder="34 ABC 123" className="h-9 font-mono uppercase" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Marka <span className="text-rose-500">*</span></label>
            <Input value={formData.marka} onChange={e => setFormData({...formData, marka: forceUppercase(e.target.value)})} placeholder="RENAULT" className="h-9 uppercase" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Model <span className="text-rose-500">*</span></label>
            <Input value={formData.model} onChange={e => setFormData({...formData, model: forceUppercase(e.target.value)})} placeholder="MEGANE" className="h-9 uppercase" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Model Yılı <span className="text-rose-500">*</span></label>
            <Input type="number" value={formData.yil} onChange={e => setFormData({...formData, yil: parseInt(e.target.value)})} className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Güncel KM <span className="text-rose-500">*</span></label>
            <Input type="number" value={formData.guncelKm} onChange={e => setFormData({...formData, guncelKm: parseInt(e.target.value)})} className="h-9" />
        </div>
        {showInitialMuayeneField && (
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Muayene Geçerlilik</label>
                <Input type="datetime-local" value={formData.muayeneGecerlilikTarihi} onChange={e => setFormData({ ...formData, muayeneGecerlilikTarihi: e.target.value })} className="h-9" />
            </div>
        )}
        <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium">Şase No</label>
            <Input value={formData.saseNo} onChange={e => setFormData({...formData, saseNo: forceUppercase(e.target.value)})} className="h-9 uppercase" placeholder="Opsiyonel" />
        </div>
        <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium">Motor No</label>
            <Input value={formData.motorNo} onChange={e => setFormData({...formData, motorNo: forceUppercase(e.target.value)})} className="h-9 uppercase" placeholder="Opsiyonel" />
        </div>

        <div className="col-span-2 pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Organizasyon & Zimmet</p>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                Ruhsat Sahibi Firma
            </label>
            <select 
                value={formData.sirketId} 
                onChange={e => {
                    const nextSirketId = e.target.value;
                    const selectedSirket = sirketler.find((s) => s.id === nextSirketId);
                    setFormData({
                        ...formData,
                        sirketId: nextSirketId,
                        bulunduguIl: selectedSirket?.bulunduguIl || formData.bulunduguIl
                    });
                }}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                {allowIndependentOption ? <option value="">Şirket Seçiniz (Bağımsız)</option> : <option value="" disabled>Şirket Seçiniz</option>}
                {allowIndependentOption && !hasKiralikSirket && !isExternalMode && <option value={KIRALIK_SIRKET_OPTION_VALUE}>{KIRALIK_SIRKET_ADI}</option>}
                {sirketler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
        </div>
        {!isExternalMode ? null : (
            <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 size={14} className="text-slate-400" />
                    Dış Firma
                </label>
                <select
                    value={formData.disFirmaId}
                    onChange={e => setFormData({ ...formData, disFirmaId: e.target.value })}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    <option value="">Dış firma yok</option>
                    {disFirmalar.map((firma) => (
                        <option key={firma.id} value={firma.id}>
                            {firma.ad} ({firma.tur === "KIRALIK" ? "Kiralık" : "Taşeron"})
                        </option>
                    ))}
                </select>
            </div>
        )}
        <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                Kullanıcı Firma
            </label>
            <select
                value={formData.calistigiKurum}
                onChange={e => setFormData({ ...formData, calistigiKurum: e.target.value })}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="">Kullanıcı Firma Seçiniz</option>
                {firmaOptions.map((firma) => <option key={firma} value={firma}>{firma}</option>)}
            </select>
        </div>
        <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
                <User size={14} className="text-slate-400" />
                Zimmetli Kullanıcı (Atama)
            </label>
            <SearchableSelect
                value={formData.kullaniciId} 
                onValueChange={(value) => {
                    const selectedKullanici = kullanicilar.find((u) => u.id === value);
                    setFormData({
                        ...formData,
                        kullaniciId: value,
                        calistigiKurum: selectedKullanici?.sirketAd || formData.calistigiKurum,
                    });
                }}
                placeholder="Kullanıcı Seçiniz (Atanmamış)"
                searchPlaceholder="Personel ara..."
                options={[
                    { value: "", label: "Kullanıcı Seçiniz (Atanmamış)" },
                    ...kullanicilar.map((u) => ({
                        value: u.id,
                        label: `${u.adSoyad}${u.sirketAd ? ` - ${u.sirketAd}` : ""}`,
                        searchText: `${u.adSoyad} ${u.sirketAd || ""}`,
                    })),
                ]}
            />
        </div>

        <div className="col-span-2 pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Operasyonel Detaylar</p>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Bulunduğu Şantiye</label>
            <CitySelect
                value={formData.bulunduguIl}
                onValueChange={value => setFormData({ ...formData, bulunduguIl: value })}
            />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Araç Kategorisi</label>
            <select 
                value={formData.kategori} 
                onChange={e => setFormData({...formData, kategori: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="BINEK">Binek Araç</option>
                <option value="SANTIYE">İş Makinesi</option>
            </select>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Bedel</label>
            <Input type="number" value={formData.bedel} onChange={e => setFormData({ ...formData, bedel: e.target.value })} className="h-9" placeholder="₺" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Ruhsat Seri No</label>
            <Input value={formData.ruhsatSeriNo} onChange={e => setFormData({...formData, ruhsatSeriNo: e.target.value})} className="h-9" placeholder="Örn: AA 123456" />
        </div>
        <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium">Açıklama</label>
            <textarea
                value={formData.aciklama}
                onChange={e => setFormData({ ...formData, aciklama: e.target.value })}
                placeholder="Araç hakkında ek bilgiler..."
                rows={2}
                className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
        </div>
    </div>
    );
};

export default function AraclarClient({ 
    initialAraclar, 
    sirketler, 
    disFirmalar,
    kullanicilar,
    role
}: { 
    initialAraclar: AracRow[], 
    sirketler: { id: string, ad: string, bulunduguIl: string }[],
    disFirmalar: Array<{ id: string; ad: string; tur: string }>,
    kullanicilar: Array<{ id: string; adSoyad: string; sirketId?: string | null; sirketAd?: string | null }>,
    role?: string | null
}) {
    const isTeknik = role === "TEKNIK";
    const isAdminUser = role === "ADMIN";
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies, canAssignIndependentRecords } = useDashboardScope();
    const searchParams = useSearchParams();
    const scopedHref = useDashboardScopedHref();
    const scopedSirketId = searchParams.get("sirket")?.trim() || "";
    const defaultCreateSirketId = React.useMemo(() => {
        if (scopedSirketId && sirketler.some((s) => s.id === scopedSirketId)) {
            return scopedSirketId;
        }
        if (sirketler.length === 1) {
            return sirketler[0]?.id || "";
        }
        if (!canAssignIndependentRecords && sirketler.length > 1) {
            return sirketler[0]?.id || "";
        }
        return "";
    }, [canAssignIndependentRecords, scopedSirketId, sirketler]);
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<AracRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY, sirketId: defaultCreateSirketId });
    const [loading, setLoading] = useState(false);
    const sortedKullanicilar = useMemo(() => sortByTextValue(kullanicilar, (u) => u.adSoyad), [kullanicilar]);
    const kullaniciFirmaOptions = useMemo(() => {
        const options = Array.from(
            new Set(
                sirketler
                    .map((sirket) => (sirket.ad || "").trim())
                    .filter((ad) => ad.length > 0)
            )
        );
        if (!options.some((option) => option.toLocaleLowerCase("tr-TR") === "özel")) {
            options.push("Özel");
        }
        return options.sort((a, b) => a.localeCompare(b, "tr-TR"));
    }, [sirketler]);
    const editFormKullanicilar = useMemo(() => {
        if (!editRow?.kullanici?.id) {
            return sortedKullanicilar;
        }

        const alreadyExists = sortedKullanicilar.some((k) => k.id === editRow.kullanici?.id);
        if (alreadyExists) {
            return sortedKullanicilar;
        }

        const mevcutKullanici = {
            id: editRow.kullanici.id,
            adSoyad: `${editRow.kullanici.ad || ""} ${editRow.kullanici.soyad || ""}`.trim(),
            sirketId: editRow.kullanici.sirket?.id || null,
            sirketAd: editRow.kullanici.sirket?.ad || null,
        };

        return sortByTextValue([...sortedKullanicilar, mevcutKullanici], (u) => u.adSoyad);
    }, [editRow, sortedKullanicilar]);

    const handleCreate = async () => {
        if (!formData.plaka || !formData.marka) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Plaka ve Marka alanlarını doldurun." });
        }
        setLoading(true);
        const res = await createArac(formData);
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY, sirketId: defaultCreateSirketId });
            toast.success("Araç Kaydedildi", { description: "Yeni araç envantere başarıyla eklendi." });
            router.refresh();
        } else {
            toast.error("Kayıt Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow) {
            toast.warning("Güncelleme başlatılamadı", { description: "Düzenlenecek araç bilgisi bulunamadı." });
            return;
        }
        if (!formData.plaka || !formData.marka) {
            toast.warning("Eksik Bilgi", { description: "Lütfen Plaka ve Marka alanlarını doldurun." });
            return;
        }
        if (loading) return;

        setLoading(true);
        try {
            const res = await updateArac(editRow.id, formData);
            if (res?.success) {
                setEditRow(null);
                toast.success("Güncelleme Başarılı", { description: "Araç bilgileri başarıyla güncellendi." });
                if (res.info) {
                    toast.info(res.info);
                }
                router.refresh();
            } else {
                toast.error("Güncelleme Hatası", { description: res?.error || "Araç güncellenemedi." });
            }
        } catch (error) {
            toast.error("Güncelleme Hatası", {
                description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (arac: AracRow) => {
        const { id, plaka, kullanici } = arac;
        if (kullanici?.id) {
            const soforAdSoyad = `${kullanici.ad} ${kullanici.soyad}`.trim();
            const goDetail = await openConfirm({
                title: "Araç Aktif Kullanımda",
                message: `${plaka} plakalı araç şu anda ${soforAdSoyad} kullanımında. Silmeden önce şoförü araçtan ayırmalısınız. Araç detayına gitmek ister misiniz?`,
                confirmText: "Detaya Git",
                cancelText: "Vazgeç",
                variant: "warning",
            });
            if (goDetail) {
                router.push(scopedHref(`/dashboard/araclar/${id}`));
            }
            return;
        }

        const confirmed = await openConfirm({
            title: "Aracı Sil",
            message: `${plaka} plakalı aracı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
            confirmText: "Evet, Sil",
            variant: "danger"
        });
        if (!confirmed) return;
        const res = await deleteArac(id);
        if (res.success) {
            toast.success("Araç Silindi", { description: "Araç kaydı sistemden kalıcı olarak kaldırıldı." });
            router.refresh();
        } else {
            if ((res as any).code === "AKTIF_KULLANIM") {
                toast.warning("Araç Silinemedi", { description: res.error });
            } else {
                toast.error("Silme İşlemi Başarısız", { description: res.error });
            }
        }
    };

    const openEdit = (row: AracRow) => {
        setFormData({
            plaka: forceUppercase(row.plaka || ''),
            marka: forceUppercase(row.marka),
            model: forceUppercase(row.model),
            yil: row.yil,
            muayeneGecerlilikTarihi: toDateTimeLocalInput(row.muayene?.[0]?.gecerlilikTarihi as any),
            bulunduguIl: row.bulunduguIl,
            guncelKm: row.guncelKm,
            bedel: row.bedel === null || row.bedel === undefined ? '' : String(row.bedel),
            aciklama: (row as any).aciklama || '',
            calistigiKurum: (row as any).calistigiKurum || row.kullanici?.sirket?.ad || '',
            sirketId: row.sirket?.id || (row as any).sirketId || '',
            disFirmaId: row.disFirma?.id || (row as any).disFirmaId || '',
            kullaniciId: (row as any).kullaniciId || row.kullanici?.id || '',
            ruhsatSeriNo: (row as any).ruhsatSeriNo || '',
            saseNo: (row as any).saseNo || '',
            motorNo: (row as any).motorNo || '',
            kategori: row.kategori || 'BINEK'
        });
        setEditRow(row);
    };


    const columnsWithActions = [
        ...getColumns(canAccessAllCompanies, isTeknik, isAdminUser),
        {
            id: 'actions',
            header: 'İşlemler',
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <RowActionButton
                        variant="edit"
                        onClick={(e) => { e.stopPropagation(); openEdit(row.original); }} 
                    />
                    <RowActionButton
                        variant="delete"
                        onClick={(e) => { e.stopPropagation(); handleDelete(row.original as AracRow); }} 
                    />
                </div>
            )
        }
    ];

    return (
        <div className="w-full min-w-0 max-w-[1400px] mx-auto p-6 md:p-8 xl:p-10">
        {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Araç Envanteri</h2>
                    <p className="text-slate-500 text-sm mt-1">Sistemdeki tüm araçların detaylı listesi. Durumlarını, güncel KM ve şoför bilgilerini buradan yönetin.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Dialog
                        open={createOpen}
                        onOpenChange={(open) => {
                            setCreateOpen(open);
                            if (!open) {
                                setFormData({ ...EMPTY, sirketId: defaultCreateSirketId });
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <button className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                                <Plus size={16} />
                                Yeni Araç Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[88vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Araç Kaydı Oluştur</DialogTitle>
                                <DialogDescription>
                                    Filoya yeni bir araç eklemek için temel bilgileri girin.
                                </DialogDescription>
                            </DialogHeader>
                            <FormFields
                                formData={formData}
                                setFormData={setFormData}
                                sirketler={sirketler}
                                disFirmalar={disFirmalar}
                                kullanicilar={sortedKullanicilar}
                                kullaniciFirmaOptions={kullaniciFirmaOptions}
                                showInitialMuayeneField={true}
                                allowIndependentOption={canAssignIndependentRecords}
                            />
                            <DialogFooter>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={loading}
                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>
 
            <Dialog open={!!editRow} onOpenChange={(o) => {
                if (!o) {
                    setEditRow(null);
                    setFormData({ ...EMPTY, sirketId: defaultCreateSirketId });
                }
            }}>
                <DialogContent className="max-h-[88vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Araç Bilgilerini Güncelle</DialogTitle>
                        <DialogDescription>
                             "{editRow?.plaka}" plakalı aracın kayıtlı bilgilerini düzenleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <FormFields
                        formData={formData}
                        setFormData={setFormData}
                        sirketler={sirketler}
                        disFirmalar={disFirmalar}
                        kullanicilar={editFormKullanicilar}
                        kullaniciFirmaOptions={kullaniciFirmaOptions}
                        showInitialMuayeneField={true}
                        allowIndependentOption={canAssignIndependentRecords}
                    />
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={loading}
                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions as any}
                data={initialAraclar}
                searchKey="plaka"
                searchPlaceholder="Plaka / Şase No ara..."
                serverFiltering={{
                    statusOptions: [
                        { value: "AKTIF", label: "Aktif" },
                        { value: "BOSTA", label: "Boşta" },
                        { value: "SERVISTE", label: "Serviste" },
                        { value: "YEDEK", label: "Yedek" },
                        { value: "ARIZALI", label: "Arızalı" },
                    ],
                    typeOptions: [
                        { value: "BINEK", label: "Binek" },
                        { value: "SANTIYE", label: "İş Makinesi" },
                    ],
                }}
                toolbarArrangement="report-right-scroll"
                tableClassName="min-w-[1960px]"
                onRowClick={(row) => router.push(scopedHref(`/dashboard/araclar/${row.id}`))}
                excelEntity="arac"
            />
        </div>
    );
}
