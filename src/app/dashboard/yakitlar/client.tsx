"use client"
import { toast } from "sonner";

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, Fuel, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, YakitRow } from "./columns";
import { useRouter } from "next/navigation";
import { createYakit, updateYakit, deleteYakit } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";

const EMPTY = {
    aracId: '',
    tarih: new Date().toISOString().slice(0, 16),
    litre: '',
    litreFiyati: '',
    km: '',
    istasyon: '',
    odemeYontemi: 'NAKIT'
};

type AracOption = {
    id: string;
    plaka: string;
    marka?: string;
    model?: string;
    bulunduguIl?: string | null;
    aktifSoforId?: string | null;
    aktifSoforAdSoyad?: string | null;
};

const FormFields = ({ formData, setFormData, araclar }: { formData: any, setFormData: any, araclar: AracOption[] }) => {
    const litre = parseFloat(formData.litre) || 0;
    const litreFiyati = parseFloat(formData.litreFiyati) || 0;
    const toplamTutar = litre * litreFiyati;
    const seciliArac = araclar.find((a) => a.id === formData.aracId);

    return (
        <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Araç (Plaka) <span className="text-red-500">*</span></label>
                <select 
                    value={formData.aracId} 
                    onChange={e => setFormData({...formData, aracId: e.target.value})}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    <option value="">Seçiniz...</option>
                    {araclar.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.plaka}
                            {a.aktifSoforAdSoyad ? ` - ${a.aktifSoforAdSoyad}` : " - Atanmamış"}
                        </option>
                    ))}
                </select>
                <SelectedAracInfo arac={seciliArac} />
                {seciliArac && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] text-slate-500">Aktif Şoför</p>
                        <p className={`text-xs font-semibold ${seciliArac.aktifSoforAdSoyad ? "text-emerald-700" : "text-amber-700"}`}>
                            {seciliArac.aktifSoforAdSoyad || "Atanmamış"}
                        </p>
                    </div>
                )}
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
                    {toplamTutar > 0 ? toplamTutar.toFixed(2) : '—'}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Alım KM</label>
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

export default function YakitlarClient({ initialYakitlar, araclar }: { initialYakitlar: YakitRow[], araclar: AracOption[] }) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<YakitRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId) {
            return toast.warning("Araç Seçilmedi", { description: "Lütfen yakıt alımı için bir araç seçin." });
        }
        setLoading(true);
        const litre = parseFloat(formData.litre) || 0;
        const litreFiyati = parseFloat(formData.litreFiyati) || 0;
        const tutar = litre * litreFiyati;
        const res = await createYakit({
            ...formData,
            litre,
            tutar,
            km: parseInt(formData.km),
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
        const litre = parseFloat(formData.litre) || 0;
        const litreFiyati = parseFloat(formData.litreFiyati) || 0;
        const tutar = litre * litreFiyati;
        const res = await updateYakit(editRow.id, {
            ...formData,
            litre,
            tutar,
            km: parseInt(formData.km),
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
                    <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition-colors">
                        <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(row.original.id, row.original.arac.plaka)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors">
                        <Trash2 size={15} />
                    </button>
                </div>
            )
        }
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
                        <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
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
                excelEntity="yakit"
            />

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Yakıt Kaydını Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın yakıt alım bilgisini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
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
