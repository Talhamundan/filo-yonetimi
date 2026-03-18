"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, CreditCard, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, HgsRow } from "./columns";
import { useRouter } from "next/navigation";
import { createHgs, updateHgs, deleteHgs } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";

const EMPTY = {
    aracId: '',
    tarih: new Date().toISOString().slice(0, 10),
    etiketNo: '',
    tutar: '',
    km: '',
};

type AracOption = {
    id: string;
    plaka: string;
    marka?: string | null;
    model?: string | null;
    bulunduguIl?: string | null;
};

const FormFields = ({ formData, setFormData, araclar }: { formData: any, setFormData: any, araclar: AracOption[] }) => {
    const selectedArac = araclar.find((a) => a.id === formData.aracId);

    return (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Araç (Plaka) <span className="text-red-500">*</span></label>
            <select
                value={formData.aracId}
                onChange={e => setFormData({ ...formData, aracId: e.target.value })}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="">Seçiniz...</option>
                {araclar.map((a) => <option key={a.id} value={a.id}>{a.plaka}</option>)}
            </select>
            <SelectedAracInfo arac={selectedArac} />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">HGS Etiket No</label>
            <Input value={formData.etiketNo} onChange={e => setFormData({ ...formData, etiketNo: e.target.value })} placeholder="0000-0000-0000" className="h-9 font-mono" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">İşlem Tarihi</label>
            <Input type="date" value={formData.tarih} onChange={e => setFormData({ ...formData, tarih: e.target.value })} className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Yükleme Tutarı (₺) <span className="text-red-500">*</span></label>
                <Input type="number" step="0.01" value={formData.tutar} onChange={e => setFormData({ ...formData, tutar: e.target.value })} placeholder="0.00" className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">İşlem Anındaki KM</label>
                <Input type="number" value={formData.km} onChange={e => setFormData({ ...formData, km: e.target.value })} placeholder="123456" className="h-9" />
            </div>
        </div>
    </div>
    );
};

export default function HgsClient({
    initialHgs,
    araclar
}: {
    initialHgs: HgsRow[];
    araclar: AracOption[];
}) {
    const router = useRouter();
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<HgsRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId || !formData.tutar) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Araç ve Tutar alanlarını doldurun." });
        }
        setLoading(true);
        const res = await createHgs({ ...formData, tutar: Number(formData.tutar), km: formData.km ? Number(formData.km) : undefined } as any);
        if (res.success) { 
            setCreateOpen(false); 
            setFormData({ ...EMPTY }); 
            toast.success("HGS Yükleme Başarılı", { description: "Yükleme kaydı başarıyla oluşturuldu." });
            router.refresh(); 
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        setLoading(true);
        const res = await updateHgs(editRow.id, { ...formData, tutar: Number(formData.tutar), km: formData.km ? Number(formData.km) : undefined } as any);
        if (res.success) { 
            setEditRow(null); 
            toast.success("Güncelleme Başarılı", { description: "HGS yükleme bilgileri güncellendi." });
            router.refresh(); 
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: "Bu HGS yükleme kaydını silmek istediğinizden emin misiniz?", confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteHgs(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "HGS yükleme kaydı başarıyla kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: HgsRow) => {
        setFormData({
            aracId: row.arac.id,
            tarih: new Date(row.tarih).toISOString().slice(0, 10),
            etiketNo: row.etiketNo || '',
            tutar: String(row.tutar),
            km: row.km ? String(row.km) : '',
        });
        setEditRow(row);
    };

    const actionsCol = {
        id: "islemler",
        header: "İşlemler",
        cell: ({ row }: any) => (
            <div className="flex gap-2">
                <button onClick={() => openEdit(row.original)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors">
                    <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(row.original.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                </button>
            </div>
        ),
    };

    return (
        <>
            {confirmModal}
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <CreditCard className="text-indigo-600" size={24} />
                            HGS Yüklemeleri
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Araçlara yapılan HGS bakiye yüklemelerini takip edin.</p>
                    </div>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all">
                                <Plus size={16} /> HGS Yükleme Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Yeni HGS Yükleme</DialogTitle>
                            </DialogHeader>
                            <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
                            <DialogFooter>
                                <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">İptal</button>
                                <button onClick={handleCreate} disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                                    {loading ? "Kaydediliyor..." : "Kaydet"}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <DataTable columns={[actionsCol, ...getColumns(canAccessAllCompanies)]} data={initialHgs} excelEntity="hgs" />

                {/* Edit Dialog */}
                <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>HGS Yüklemeyi Düzenle</DialogTitle>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
                        <DialogFooter>
                            <button onClick={() => setEditRow(null)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">İptal</button>
                            <button onClick={handleUpdate} disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                                {loading ? "Güncelleniyor..." : "Güncelle"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
