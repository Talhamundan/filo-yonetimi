"use client"
import { toast } from "sonner";

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, Fuel } from "lucide-react";
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

const EMPTY = {
    aracId: '',
    soforId: '',
    tarih: new Date().toISOString().slice(0, 16),
    litre: '',
    litreFiyati: '',
    km: '',
    istasyon: '',
    odemeYontemi: 'NAKIT'
};

function parseDecimal(value: string) {
    const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function parseKm(value: string) {
    const numeric = value.trim().replace(/[^\d]/g, "");
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

type AracOption = {
    id: string;
    plaka: string | null;
    marka?: string;
    model?: string;
    durum?: string | null;
    bulunduguIl?: string | null;
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
    const litre = parseDecimal(formData.litre);
    const litreFiyati = parseDecimal(formData.litreFiyati);
    const toplamTutar = litre * litreFiyati;
    const seciliArac = araclar.find((a) => a.id === formData.aracId);

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
                            label: `${personel.ad} ${personel.soyad}`,
                            searchText: `${personel.ad} ${personel.soyad}`,
                        })),
                    ]}
                />
                <p className="text-[11px] text-slate-500">
                    Şoför harici personel de seçilebilir. Admin seçimi yapılamaz.
                </p>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Alım Tarihi & Saati</label>
                <Input type="datetime-local" value={formData.tarih} onChange={e => setFormData({...formData, tarih: e.target.value})} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Litre</label>
                    <Input type="number" step="0.01" value={formData.litre} onChange={e => setFormData({...formData, litre: e.target.value})} placeholder="0.00" className="h-9" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Litre Fiyatı (₺)</label>
                    <Input type="number" step="0.01" value={formData.litreFiyati} onChange={e => setFormData({...formData, litreFiyati: e.target.value})} placeholder="0.00" className="h-9" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-500">Toplam Tutar (₺)</label>
                <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                    {Number.isFinite(toplamTutar) && toplamTutar > 0 ? toplamTutar.toFixed(2) : '—'}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Alım km/saat</label>
                    <Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})} placeholder="123456" className="h-9" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">İstasyon</label>
                    <Input value={formData.istasyon} onChange={e => setFormData({...formData, istasyon: e.target.value})} placeholder="Örn: Shell, BP" className="h-9" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Ödeme Şekli</label>
                <select
                    value={formData.odemeYontemi}
                    onChange={e => setFormData({...formData, odemeYontemi: e.target.value})}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    <option value="NAKIT">💵 Nakit</option>
                    <option value="TASIT_TANIMA">🚗 Taşıt Tanıma</option>
                </select>
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
        const litreFiyati = parseDecimal(formData.litreFiyati);
        const km = parseKm(formData.km);
        if (!Number.isFinite(litre) || !Number.isFinite(litreFiyati) || !Number.isFinite(km)) {
            setLoading(false);
            return toast.error("Geçersiz değer", { description: "Litre, litre fiyatı veya KM alanını kontrol edin." });
        }
        const tutar = litre * litreFiyati;
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
        const litreFiyati = parseDecimal(formData.litreFiyati);
        const km = parseKm(formData.km);
        if (!Number.isFinite(litre) || !Number.isFinite(litreFiyati) || !Number.isFinite(km)) {
            setLoading(false);
            return toast.error("Geçersiz değer", { description: "Litre, litre fiyatı veya KM alanını kontrol edin." });
        }
        const tutar = litre * litreFiyati;
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
        const tutar = row.tutar || 0;
        // Litre fiyatını geriye doğru hesapla: tutar / litre
        const litreFiyati = litre > 0 ? (tutar / litre) : 0;
        setFormData({
            aracId: row.arac.id,
            soforId: normalizeSoforId(row.soforId || row.kullanici?.id || row.arac.kullanici?.id),
            tarih: new Date(row.tarih).toISOString().slice(0, 16),
            litre: String(litre),
            litreFiyati: litreFiyati > 0 ? litreFiyati.toFixed(4) : '',
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
                    <p className="text-slate-500 text-sm mt-1">Filo genelindeki yakıt harcamalarını, litre ve maliyet bazlı takip edin.</p>
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
                                Araç, tarih, litre ve litre fiyatını girin. Toplam tutar otomatik hesaplanır.
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

            <DataTable
                columns={columnsWithActions as any}
                data={initialYakitlar}
                searchKey="arac_plaka"
                searchPlaceholder="Yakıt kaydı için araç plakası ara..."
                toolbarArrangement="report-right-scroll"
                serverFiltering={{
                    statusOptions: [
                        { value: "NAKIT", label: "Nakit" },
                        { value: "TASIT_TANIMA", label: "Taşıt Tanıma" },
                    ],
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
