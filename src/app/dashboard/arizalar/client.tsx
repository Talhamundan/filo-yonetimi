"use client"

import React, { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, ArizaRow } from "./columns";
import { useRouter } from "next/navigation";
import { createAriza, updateAriza, deleteAriza } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

const DURUM_LIST = [
    { label: 'Açık Arıza', value: 'ACIK' },
    { label: 'Tamirde', value: 'TAMIRDE' },
    { label: 'Parça Bekleniyor', value: 'PARCA_BEKLIYOR' },
    { label: 'Çözüldü', value: 'COZULDU' },
];

const EMPTY = {
    aracId: '',
    aciklama: '',
    arizaTarihi: new Date().toISOString().split('T')[0],
    durum: 'ACIK',
    servis: '',
    tahminiTutar: ''
};

const FormFields = ({ formData, setFormData, araclar, DURUM_LIST }: { formData: any, setFormData: any, araclar: any[], DURUM_LIST: any[] }) => (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Arızalı Araç <span className="text-red-500">*</span></label>
            <select 
                value={formData.aracId} 
                onChange={e => setFormData({...formData, aracId: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="">Seçiniz...</option>
                {araclar.map((a: any) => <option key={a.id} value={a.id}>{a.plaka}</option>)}
            </select>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Arıza Açıklaması <span className="text-red-500">*</span></label>
            <textarea 
                value={formData.aciklama} 
                onChange={e => setFormData({...formData, aciklama: e.target.value})}
                placeholder="Arızanın detaylarını buraya yazınız..."
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Kayıt Tarihi</label>
                <Input type="date" value={formData.arizaTarihi} onChange={e => setFormData({...formData, arizaTarihi: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Arıza Durumu</label>
                <select 
                    value={formData.durum} 
                    onChange={e => setFormData({...formData, durum: e.target.value})}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    {DURUM_LIST.map((d: any) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Yönlendirilen Servis</label>
                <Input value={formData.servis} onChange={e => setFormData({...formData, servis: e.target.value})} placeholder="Örn: Yetkili Servis" className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Tahmini Tutar (₺)</label>
                <Input type="number" step="0.01" value={formData.tahminiTutar} onChange={e => setFormData({...formData, tahminiTutar: e.target.value})} placeholder="0.00" className="h-9" />
            </div>
        </div>
    </div>
);

export default function ArizalarClient({ initialArizalar, araclar }: { initialArizalar: ArizaRow[], araclar: { id: string, plaka: string }[] }) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<ArizaRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId || !formData.aciklama) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Arızalı Araç ve Açıklama alanlarını doldurun." });
        }
        setLoading(true);
        const res = await createAriza({
            ...formData,
            tahminiTutar: formData.tahminiTutar ? parseFloat(formData.tahminiTutar) : undefined
        });
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Arıza Kaydedildi", { description: "Yeni arıza kaydı başarıyla oluşturuldu." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) return;
        setLoading(true);
        const res = await updateAriza(editRow.id, {
            ...formData,
            tahminiTutar: formData.tahminiTutar ? parseFloat(formData.tahminiTutar) : null
        });
        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Arıza kaydı bilgileri güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, plaka: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${plaka} plakalı aracın arıza kaydını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteAriza(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Arıza kaydı başarıyla kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Hatası", { description: res.error });
        }
    };

    const openEdit = (row: ArizaRow) => {
        setFormData({
            aracId: row.arac.id,
            aciklama: row.aciklama,
            arizaTarihi: new Date(row.arizaTarihi).toISOString().split('T')[0],
            durum: row.durum,
            servis: row.servis || '',
            tahminiTutar: row.tahminiTutar ? String(row.tahminiTutar) : ''
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
                         <AlertTriangle className="text-rose-600" /> Arıza & Onarım Takipleri
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Araçlardaki aktif arızaları, servis süreçlerini ve onarım maliyetlerini yönetin.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Arıza Kaydı Oluştur
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yeni Arıza Girişi</DialogTitle>
                            <DialogDescription>
                                Arıza bildirimini yaparak servis sürecini başlatın.
                            </DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} araclar={araclar} DURUM_LIST={DURUM_LIST} />
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
                data={initialArizalar}
                searchKey="arac_plaka"
                searchPlaceholder="Arıza kaydı için araç plakası ara..."
            />

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Arıza Kaydını Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın arıza detaylarını güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} araclar={araclar} DURUM_LIST={DURUM_LIST} />
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
