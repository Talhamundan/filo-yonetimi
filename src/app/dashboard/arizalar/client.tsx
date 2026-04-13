"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Plus, TriangleAlert, Wrench, XCircle } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { SearchableSelect } from "@/components/ui/searchable-select";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { ArizaRow, getColumns } from "./columns";
import { RowActionButton } from "@/components/ui/row-action-button";
import { formatAracOptionLabel } from "@/lib/arac-option-label";
import { getPersonelOptionLabel, getPersonelOptionSearchText } from "@/lib/personel-display";
import {
    createArizaKaydi,
    deleteArizaKaydi,
    iptalEtArizaKaydi,
    seviseGonderArizaKaydi,
    tamamlaArizaKaydi,
    updateArizaKaydi,
} from "./actions";

type AracOption = {
    id: string;
    plaka: string | null;
    marka?: string | null;
    model?: string | null;
    bulunduguIl?: string | null;
    guncelKm?: number | null;
    durum?: string | null;
    kullaniciId?: string | null;
    aktifSoforId?: string | null;
    aktifSofor?: {
        id: string;
        ad: string;
        soyad: string;
    } | null;
    kullanici?: {
        id: string;
        ad: string;
        soyad: string;
    } | null;
};

type PersonelOption = {
    id: string;
    ad: string;
    soyad: string;
    rol?: string | null;
    sirketAd?: string | null;
    calistigiKurum?: string | null;
};

const EMPTY_FORM = {
    aracId: "",
    soforId: "",
    aciklama: "",
    oncelik: "ORTA" as "DUSUK" | "ORTA" | "YUKSEK",
    km: "",
    servisAdi: "",
    yapilanIslemler: "",
    tutar: "",
    bildirimTarihi: new Date().toISOString().slice(0, 16),
};

const EMPTY_COMPLETE_FORM = {
    servisAdi: "",
    yapilanIslemler: "",
    tutar: "",
    km: "",
    createBakim: true,
};

export default function ArizalarClient({
    initialData,
    araclar,
    personeller,
}: {
    initialData: ArizaRow[];
    araclar: AracOption[];
    personeller: PersonelOption[];
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();

    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<ArizaRow | null>(null);
    const [completeRow, setCompleteRow] = useState<ArizaRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [completeForm, setCompleteForm] = useState({ ...EMPTY_COMPLETE_FORM });
    const [loading, setLoading] = useState(false);

    const selectedArac = araclar.find((arac) => arac.id === formData.aracId);
    const selectedCompleteArac = completeRow ? araclar.find((arac) => arac.id === completeRow.arac.id) : null;
    const personelIdSet = React.useMemo(() => new Set(personeller.map((personel) => personel.id)), [personeller]);
    const normalizeSoforId = (soforId?: string | null) => (soforId && personelIdSet.has(soforId) ? soforId : "");

    const resetForm = () => setFormData({ ...EMPTY_FORM });

    const handleAracSelection = (aracId: string) => {
        const seciliArac = araclar.find((arac) => arac.id === aracId);
        setFormData((prev) => ({
            ...prev,
            aracId,
            soforId: normalizeSoforId(seciliArac?.aktifSoforId || seciliArac?.kullaniciId),
        }));
    };

    const handleCreate = async () => {
        if (!formData.aracId || !formData.aciklama.trim()) {
            return toast.warning("Eksik Bilgi", { description: "Araç ve arıza açıklaması zorunludur." });
        }
        setLoading(true);
        const res = await createArizaKaydi({
            aracId: formData.aracId,
            soforId: formData.soforId || null,
            aciklama: formData.aciklama.trim(),
            oncelik: formData.oncelik,
            km: formData.km ? Number(formData.km) : null,
            servisAdi: formData.servisAdi || null,
            yapilanIslemler: formData.yapilanIslemler || null,
            tutar: formData.tutar ? Number(formData.tutar) : 0,
            bildirimTarihi: formData.bildirimTarihi ? new Date(formData.bildirimTarihi) : new Date(),
        });
        if (res.success) {
            setCreateOpen(false);
            resetForm();
            toast.success("Arıza kaydı oluşturuldu.");
            router.refresh();
        } else {
            toast.error("İşlem başarısız.", { description: res.error });
        }
        setLoading(false);
    };

    const openEdit = (row: ArizaRow) => {
        setFormData({
            aracId: row.arac.id,
            soforId: normalizeSoforId(row.soforId),
            aciklama: row.aciklama || "",
            oncelik: row.oncelik === "KRITIK" ? "YUKSEK" : row.oncelik || "ORTA",
            km: row.km != null ? String(row.km) : "",
            servisAdi: row.servisAdi || "",
            yapilanIslemler: row.yapilanIslemler || "",
            tutar: row.tutar ? String(row.tutar) : "",
            bildirimTarihi: new Date(row.bildirimTarihi).toISOString().slice(0, 16),
        });
        setEditRow(row);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aciklama.trim()) {
            return;
        }
        setLoading(true);
        const res = await updateArizaKaydi(editRow.id, {
            soforId: formData.soforId || null,
            aciklama: formData.aciklama.trim(),
            oncelik: formData.oncelik,
            km: formData.km ? Number(formData.km) : null,
            servisAdi: formData.servisAdi || null,
            yapilanIslemler: formData.yapilanIslemler || null,
            tutar: formData.tutar ? Number(formData.tutar) : 0,
            bildirimTarihi: formData.bildirimTarihi ? new Date(formData.bildirimTarihi) : new Date(),
        });
        if (res.success) {
            setEditRow(null);
            resetForm();
            toast.success("Arıza kaydı güncellendi.");
            router.refresh();
        } else {
            toast.error("İşlem başarısız.", { description: res.error });
        }
        setLoading(false);
    };

    const handleSeviseGonder = async (row: ArizaRow) => {
        const confirmed = await openConfirm({
            title: "Servise Gönder",
            message: `${row.arac.plaka} için açılan arıza kaydı servise gönderilecek. Onaylıyor musunuz?`,
            confirmText: "Gönder",
            variant: "warning",
        });
        if (!confirmed) return;
        const res = await seviseGonderArizaKaydi(row.id);
        if (res.success) {
            toast.success("Araç servise alındı.");
            router.refresh();
        } else {
            toast.error("İşlem başarısız.", { description: res.error });
        }
    };

    const openComplete = (row: ArizaRow) => {
        setCompleteRow(row);
        setCompleteForm({
            servisAdi: row.servisAdi || "",
            yapilanIslemler: row.yapilanIslemler || "",
            tutar: row.tutar ? String(row.tutar) : "",
            km: row.km != null ? String(row.km) : "",
            createBakim: true,
        });
    };

    const handleComplete = async () => {
        if (!completeRow) return;
        setLoading(true);
        const res = await tamamlaArizaKaydi(completeRow.id, {
            servisAdi: completeForm.servisAdi || null,
            yapilanIslemler: completeForm.yapilanIslemler || null,
            tutar: completeForm.tutar ? Number(completeForm.tutar) : 0,
            km: completeForm.km ? Number(completeForm.km) : null,
            createBakim: completeForm.createBakim,
        });
        if (res.success) {
            setCompleteRow(null);
            setCompleteForm({ ...EMPTY_COMPLETE_FORM });
            toast.success("Arıza kaydı tamamlandı.");
            router.refresh();
        } else {
            toast.error("İşlem başarısız.", { description: res.error });
        }
        setLoading(false);
    };

    const handleIptal = async (row: ArizaRow) => {
        const confirmed = await openConfirm({
            title: "Arızayı İptal Et",
            message: `${row.arac.plaka} için açılan arıza kaydı iptal edilecek. Onaylıyor musunuz?`,
            confirmText: "İptal Et",
            variant: "warning",
        });
        if (!confirmed) return;
        const res = await iptalEtArizaKaydi(row.id);
        if (res.success) {
            toast.success("Arıza kaydı iptal edildi.");
            router.refresh();
        } else {
            toast.error("İşlem başarısız.", { description: res.error });
        }
    };

    const handleDelete = async (row: ArizaRow) => {
        const confirmed = await openConfirm({
            title: "Arıza Kaydını Sil",
            message: `${row.arac.plaka} için arıza kaydını silmek istediğinize emin misiniz?`,
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        const res = await deleteArizaKaydi(row.id);
        if (res.success) {
            toast.success("Arıza kaydı silindi.");
            router.refresh();
        } else {
            toast.error("İşlem başarısız.", { description: res.error });
        }
    };

    const columnsWithActions: ColumnDef<ArizaRow>[] = [
        ...getColumns(canAccessAllCompanies),
        {
            id: "actions",
            header: "İşlemler",
            cell: ({ row }: CellContext<ArizaRow, unknown>) => {
                const item = row.original;
                const canTransition = item.durum === "ACIK" || item.durum === "SERVISTE";
                return (
                    <div className="flex items-center gap-1.5">
                        <RowActionButton variant="edit" onClick={() => openEdit(item)} />
                        {item.durum === "ACIK" ? (
                            <button
                                onClick={() => handleSeviseGonder(item)}
                                className="p-1.5 rounded-md hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition-colors"
                                title="Servise Gönder"
                            >
                                <Wrench size={15} />
                            </button>
                        ) : null}
                        {canTransition ? (
                            <button
                                onClick={() => openComplete(item)}
                                className="p-1.5 rounded-md hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition-colors"
                                title="Tamamla"
                            >
                                <CheckCircle2 size={15} />
                            </button>
                        ) : null}
                        {canTransition ? (
                            <button
                                onClick={() => handleIptal(item)}
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                                title="İptal Et"
                            >
                                <XCircle size={15} />
                            </button>
                        ) : null}
                        <RowActionButton variant="delete" onClick={() => handleDelete(item)} />
                    </div>
                );
            },
        },
    ];

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <TriangleAlert className="text-rose-600" /> Arıza Kayıtları
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Servise gitmeden bekleyen arızaları takip edin, servise sevk edin ve tamamlandığında bakım kaydına bağlayın.
                    </p>
                </div>
                <Dialog open={createOpen} onOpenChange={(v) => {
                    setCreateOpen(v);
                    if (!v) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <button className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Arıza Kaydı
                        </button>
                    </DialogTrigger>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Yeni Arıza Kaydı</DialogTitle>
                            <DialogDescription>Araçta tespit edilen arızayı sisteme kaydedin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Araç <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    value={formData.aracId}
                                    onValueChange={handleAracSelection}
                                    placeholder="Araç Seçiniz"
                                    searchPlaceholder="Plaka / araç ara..."
                                    options={[
                                        { value: "", label: "Araç Seçiniz" },
                                        ...araclar.map((arac) => ({
                                            value: arac.id,
                                            label: formatAracOptionLabel(arac),
                                            searchText: [arac.plaka, arac.marka, arac.model].filter(Boolean).join(" "),
                                        })),
                                    ]}
                                />
                                <SelectedAracInfo arac={selectedArac} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">KM</label>
                                    <Input
                                        type="number"
                                        value={formData.km}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, km: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Bildirim Zamanı</label>
                                    <Input
                                        type="datetime-local"
                                        value={formData.bildirimTarihi}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, bildirimTarihi: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Öncelik</label>
                                    <select
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                        value={formData.oncelik}
                                        onChange={(event) =>
                                            setFormData((prev) => ({ ...prev, oncelik: event.target.value as typeof prev.oncelik }))
                                        }
                                    >
                                        <option value="DUSUK">Düşük</option>
                                        <option value="ORTA">Orta</option>
                                        <option value="YUKSEK">Yüksek</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Personel / Şoför</label>
                                    <SearchableSelect
                                        value={formData.soforId}
                                        onValueChange={(value) =>
                                            setFormData((prev) => ({ ...prev, soforId: value }))
                                        }
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
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Arıza Açıklaması <span className="text-red-500">*</span></label>
                                <textarea
                                    value={formData.aciklama}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, aciklama: event.target.value }))}
                                    placeholder="Arızayı detaylandırın..."
                                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 h-20 resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Servis Adı</label>
                                    <Input
                                        value={formData.servisAdi}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, servisAdi: event.target.value }))}
                                        className="h-9"
                                        placeholder="Opsiyonel"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tahmini Tutar (₺)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={formData.tutar}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, tutar: event.target.value }))}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Yapılan / Planlanan İşlemler</label>
                                <textarea
                                    value={formData.yapilanIslemler}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, yapilanIslemler: event.target.value }))}
                                    placeholder="Opsiyonel not"
                                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 h-20 resize-none"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <button
                                onClick={handleCreate}
                                disabled={loading}
                                className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                            >
                                {loading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <Dialog open={!!editRow} onOpenChange={(open) => {
                if (!open) {
                    setEditRow(null);
                    resetForm();
                }
            }}>
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Arıza Kaydını Düzenle</DialogTitle>
                        <DialogDescription>{editRow?.arac.plaka} için kayıt bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Araç</label>
                            <SearchableSelect
                                disabled
                                value={formData.aracId}
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, aracId: value }))}
                                placeholder="Araç Seçiniz"
                                searchPlaceholder="Plaka / araç ara..."
                                options={[
                                    { value: "", label: "Araç Seçiniz" },
                                    ...araclar.map((arac) => ({
                                        value: arac.id,
                                        label: formatAracOptionLabel(arac),
                                        searchText: [arac.plaka, arac.marka, arac.model].filter(Boolean).join(" "),
                                    })),
                                ]}
                            />
                            <SelectedAracInfo arac={selectedArac} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">KM</label>
                                <Input
                                    type="number"
                                    value={formData.km}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, km: event.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Bildirim Zamanı</label>
                                <Input
                                    type="datetime-local"
                                    value={formData.bildirimTarihi}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, bildirimTarihi: event.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Öncelik</label>
                                <select
                                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    value={formData.oncelik}
                                    onChange={(event) =>
                                        setFormData((prev) => ({ ...prev, oncelik: event.target.value as typeof prev.oncelik }))
                                    }
                                >
                                    <option value="DUSUK">Düşük</option>
                                    <option value="ORTA">Orta</option>
                                    <option value="YUKSEK">Yüksek</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Personel / Şoför</label>
                                <SearchableSelect
                                    value={formData.soforId}
                                    onValueChange={(value) =>
                                        setFormData((prev) => ({ ...prev, soforId: value }))
                                    }
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
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Arıza Açıklaması <span className="text-red-500">*</span></label>
                            <textarea
                                value={formData.aciklama}
                                onChange={(event) => setFormData((prev) => ({ ...prev, aciklama: event.target.value }))}
                                className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Servis Adı</label>
                                <Input
                                    value={formData.servisAdi}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, servisAdi: event.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tutar (₺)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.tutar}
                                    onChange={(event) => setFormData((prev) => ({ ...prev, tutar: event.target.value }))}
                                    className="h-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Yapılan / Planlanan İşlemler</label>
                            <textarea
                                value={formData.yapilanIslemler}
                                onChange={(event) => setFormData((prev) => ({ ...prev, yapilanIslemler: event.target.value }))}
                                className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <button
                            onClick={handleUpdate}
                            disabled={loading}
                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                        >
                            {loading ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!completeRow} onOpenChange={(open) => {
                if (!open) {
                    setCompleteRow(null);
                    setCompleteForm({ ...EMPTY_COMPLETE_FORM });
                }
            }}>
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Arızayı Tamamla</DialogTitle>
                        <DialogDescription>
                            {completeRow?.arac.plaka} için servis işlemini kapatın. İsterseniz otomatik bakım kaydı oluşturabilirsiniz.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <SelectedAracInfo arac={selectedCompleteArac || undefined} />
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Servis Adı</label>
                                <Input
                                    value={completeForm.servisAdi}
                                    onChange={(event) => setCompleteForm((prev) => ({ ...prev, servisAdi: event.target.value }))}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Kapanış KM</label>
                                <Input
                                    type="number"
                                    value={completeForm.km}
                                    onChange={(event) => setCompleteForm((prev) => ({ ...prev, km: event.target.value }))}
                                    className="h-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tutar (₺)</label>
                            <Input
                                type="number"
                                step="0.01"
                                value={completeForm.tutar}
                                onChange={(event) => setCompleteForm((prev) => ({ ...prev, tutar: event.target.value }))}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Yapılan İşlemler</label>
                            <textarea
                                value={completeForm.yapilanIslemler}
                                onChange={(event) => setCompleteForm((prev) => ({ ...prev, yapilanIslemler: event.target.value }))}
                                className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm h-20 resize-none"
                            />
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={completeForm.createBakim}
                                onChange={(event) => setCompleteForm((prev) => ({ ...prev, createBakim: event.target.checked }))}
                            />
                            Tamamlarken bakım kaydı da oluştur
                        </label>
                    </div>
                    <DialogFooter>
                        <button
                            onClick={handleComplete}
                            disabled={loading}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                        >
                            {loading ? "Tamamlanıyor..." : "Tamamla"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions}
                data={initialData}
                excelEntity="ariza"
                toolbarArrangement="report-right-scroll"
            />
        </div>
    );
}
