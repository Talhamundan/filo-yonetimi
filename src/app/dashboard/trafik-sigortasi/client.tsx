"use client"

import React, { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, ShieldAlert, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, SigortaRow } from "./columns";
import { useRouter } from "next/navigation";
import { createSigorta, updateSigorta, deleteSigorta } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

const EMPTY = {
    aracId: '',
    sirket: '',
    policeNo: '',
    baslangicTarihi: new Date().toISOString().split('T')[0],
    bitisTarihi: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    tutar: '',
    aktifMi: true
};

const FormFields = ({ formData, setFormData, araclar }: { formData: any, setFormData: any, araclar: any[] }) => (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Araç (Plaka) <span className="text-red-500">*</span></label>
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
            <label className="text-sm font-medium">Sigorta Şirketi</label>
            <Input value={formData.sirket} onChange={e => setFormData({...formData, sirket: e.target.value})} placeholder="Örn: Allianz" className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Poliçe No</label>
            <Input value={formData.policeNo} onChange={e => setFormData({...formData, policeNo: e.target.value})} placeholder="12345/0" className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Başlangıç Tarihi</label>
                <Input type="date" value={formData.baslangicTarihi} onChange={e => setFormData({...formData, baslangicTarihi: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Bitiş Tarihi</label>
                <Input type="date" value={formData.bitisTarihi} onChange={e => setFormData({...formData, bitisTarihi: e.target.value})} className="h-9" />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Tutar (₺)</label>
            <Input type="number" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} placeholder="0.00" className="h-9" />
        </div>
        <div className="flex items-center gap-2">
            <input type="checkbox" id="aktifMi" checked={formData.aktifMi} onChange={e => setFormData({...formData, aktifMi: e.target.checked})} className="h-4 w-4 rounded border-slate-300" />
            <label htmlFor="aktifMi" className="text-sm font-medium">Poliçe Aktif</label>
        </div>
    </div>
);

export default function TrafikSigortasiClient({ initialSigortalar, araclar }: { initialSigortalar: SigortaRow[], araclar: { id: string, plaka: string }[] }) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<SigortaRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId) {
            return toast.warning("Araç Seçilmedi", { description: "Lütfen bir araç seçin." });
        }
        setLoading(true);
        const res = await createSigorta({ ...formData, tutar: formData.tutar ? parseFloat(formData.tutar) : undefined });
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Poliçe Kaydedildi", { description: "Trafik sigortası başarıyla sisteme eklendi." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) return;
        setLoading(true);
        const res = await updateSigorta(editRow.id, { ...formData, tutar: formData.tutar ? parseFloat(formData.tutar) : undefined });
        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Sigorta poliçesi güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, arac: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${arac} aracına ait trafik sigortasını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteSigorta(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Trafik sigortası kaydı kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: SigortaRow) => {
        setFormData({
            aracId: row.arac.id,
            sirket: row.sirket || '',
            policeNo: row.policeNo || '',
            baslangicTarihi: new Date(row.baslangicTarihi).toISOString().split('T')[0],
            bitisTarihi: new Date(row.bitisTarihi).toISOString().split('T')[0],
            tutar: String(row.tutar || ''),
            aktifMi: row.aktifMi
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
                        <ShieldAlert className="text-rose-600" /> Zorunlu Trafik Sigortası Takipleri
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Araçlara ait trafik poliçelerinin yenileme dönemlerini ve aktiflik durumlarını yönetin.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Poliçe Kaydı
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Trafik Sigortası İşle</DialogTitle>
                            <DialogDescription>
                                Araç plakası ve sigorta şirketi belirterek zorunlu trafik sigortasını sisteme kaydedin.
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

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Trafik Sigortasını Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın poliçe bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions as any}
                data={initialSigortalar}
                searchKey="arac_plaka"
                searchPlaceholder="Trafik poliçesi için araç plakası ara..."
            />
        </div>
    );
}
