"use client"

import React, { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, Receipt, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, MasrafRow } from "./columns";
import { useRouter } from "next/navigation";
import { createMasraf, updateMasraf, deleteMasraf } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";

const TUR_LIST = [
    'BAKIM_ONARIM',
    'LASTIK',
    'TEMIZLIK',
    'OTOPARK',
    'KOPRU_OBO',
    'DIGER'
];

const EMPTY = {
    aracId: '',
    tarih: new Date().toISOString().split('T')[0],
    tur: 'BAKIM_ONARIM',
    tutar: '',
    aciklama: ''
};

type AracOption = {
    id: string;
    plaka: string;
    marka?: string | null;
    model?: string | null;
    bulunduguIl?: string | null;
};

const FormFields = ({ formData, setFormData, araclar, TUR_LIST }: { formData: any, setFormData: any, araclar: AracOption[], TUR_LIST: string[] }) => {
    const selectedArac = araclar.find((a) => a.id === formData.aracId);

    return (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">İlgili Araç <span className="text-red-500">*</span></label>
            <select 
                value={formData.aracId} 
                onChange={e => setFormData({...formData, aracId: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="">Seçiniz...</option>
                {araclar.map((a) => <option key={a.id} value={a.id}>{a.plaka}</option>)}
            </select>
            <SelectedAracInfo arac={selectedArac} />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Harcama Tarihi</label>
                <Input type="date" value={formData.tarih} onChange={e => setFormData({...formData, tarih: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Tutar (₺)</label>
                <Input type="number" step="0.01" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} placeholder="0.00" className="h-9" />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Gider Kategorisi</label>
            <select 
                value={formData.tur} 
                onChange={e => setFormData({...formData, tur: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                {TUR_LIST.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Açıklama / Detay</label>
            <Input value={formData.aciklama} onChange={e => setFormData({...formData, aciklama: e.target.value})} placeholder="Örn: Yağ değişimi, otopark ücreti vb." className="h-9" />
        </div>
    </div>
    );
};

export default function MasraflarClient({ initialMasraflar, araclar }: { initialMasraflar: MasrafRow[], araclar: AracOption[] }) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<MasrafRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen bir araç seçin." });
        }
        setLoading(true);
        const res = await createMasraf({ ...formData, tutar: parseFloat(formData.tutar) });
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Masraf Kaydedildi", { description: "Gider kaydı başarıyla oluşturuldu." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) return;
        setLoading(true);
        const res = await updateMasraf(editRow.id, { ...formData, tutar: parseFloat(formData.tutar) });
        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Masraf kaydı güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, plaka: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${plaka} plakalı aracın masraf kaydını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteMasraf(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Masraf kaydı sistemden kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: MasrafRow) => {
        setFormData({
            aracId: row.arac.id,
            tarih: new Date(row.tarih).toISOString().split('T')[0],
            tur: row.tur,
            tutar: String(row.tutar),
            aciklama: (row as any).aciklama || ''
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
                        <Receipt className="text-indigo-600" /> Araç Gider & Masraf Yönetimi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Araç bazlı genel masrafları, kategorilerine göre sisteme kaydedin.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Gider Kaydı
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Harcama Formu</DialogTitle>
                            <DialogDescription>
                                Harcama detaylarını girerek maliyet analizlerini güncelleyin.
                            </DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} araclar={araclar} TUR_LIST={TUR_LIST} />
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
                data={initialMasraflar}
                searchKey="arac_plaka"
                searchPlaceholder="Gider kaydı için araç plakası ara..."
                excelEntity="masraf"
            />

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Gider Kaydını Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın harcama bilgisini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} araclar={araclar} TUR_LIST={TUR_LIST} />
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
