"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, CheckCircle2, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, MuayeneRow } from "./columns";
import { useRouter } from "next/navigation";
import { createMuayene, updateMuayene, deleteMuayene } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";

const EMPTY = {
    aracId: '',
    muayeneTarihi: new Date().toISOString().split('T')[0],
    gecerlilikTarihi: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
    tutar: '',
    gectiMi: true,
    km: '',
    aktifMi: true
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
                <label className="text-sm font-medium">Muayene Tarihi</label>
                <Input type="date" value={formData.muayeneTarihi} onChange={e => setFormData({...formData, muayeneTarihi: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Geçerlilik Bitiş</label>
                <Input type="date" value={formData.gecerlilikTarihi} onChange={e => setFormData({...formData, gecerlilikTarihi: e.target.value})} className="h-9" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Muayene Ücreti (₺)</label>
                <Input type="number" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} placeholder="2620" className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Muayene Anındaki KM</label>
                <Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})} placeholder="123456" className="h-9" />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Muayene Sonucu</label>
            <select
                value={formData.gectiMi ? "GECTI" : "GECMEDI"}
                onChange={e => setFormData({ ...formData, gectiMi: e.target.value === "GECTI" })}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="GECTI">Geçti</option>
                <option value="GECMEDI">Geçmedi</option>
            </select>
        </div>
        <div className="flex items-center gap-2">
            <input type="checkbox" id="aktifMi" checked={formData.aktifMi} onChange={e => setFormData({...formData, aktifMi: e.target.checked})} className="h-4 w-4 rounded border-slate-300" />
            <label htmlFor="aktifMi" className="text-sm font-medium">Bu Kayıt Güncel/Aktif mi?</label>
        </div>
    </div>
    );
};

export default function MuayenelerClient({ initialMuayeneler, araclar }: { initialMuayeneler: MuayeneRow[], araclar: AracOption[] }) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<MuayeneRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId) {
            return toast.warning("Araç Seçilmedi", { description: "Lütfen bir araç seçin." });
        }
        setLoading(true);
        const res = await createMuayene({
            ...formData,
            km: formData.km ? parseInt(formData.km) : undefined,
            tutar: formData.tutar ? parseFloat(formData.tutar) : undefined
        } as any);
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Muayene Eklendi", { description: "Yeni muayene kaydı başarıyla oluşturuldu." });
            router.refresh();
        } else {
            toast.error("Kayıt Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) return;
        setLoading(true);
        const res = await updateMuayene(editRow.id, {
            ...formData,
            km: formData.km ? parseInt(formData.km) : undefined,
            tutar: formData.tutar ? parseFloat(formData.tutar) : undefined
        } as any);
        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Muayene bilgileri güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, arac: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${arac} aracına ait muayene kaydını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteMuayene(id);
        if (res.success) {
            toast.success("Kaydı Silindi", { description: "Muayene kaydı başarıyla kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: MuayeneRow) => {
        setFormData({
            aracId: row.arac.id,
            muayeneTarihi: new Date(row.muayeneTarihi).toISOString().split('T')[0],
            gecerlilikTarihi: new Date(row.gecerlilikTarihi).toISOString().split('T')[0],
            tutar: String(row.tutar || ''),
            gectiMi: row.gectiMi ?? true,
            km: row.km ? String(row.km) : '',
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
                        <CheckCircle2 className="text-emerald-600" /> Periyodik Muayene Takipleri
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Araçların periyodik muayene tarihlerini ve maliyetlerini yönetin.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Muayene Kaydı
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Muayene Bilgisi İşle</DialogTitle>
                            <DialogDescription>
                                Muayene tarihi ve bitiş tarihini girerek kaydı tamamlayın.
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
                data={initialMuayeneler}
                searchKey="arac_plaka"
                searchPlaceholder="Muayene kaydı için araç plakası ara..."
                toolbarArrangement="report-right-scroll"
                serverFiltering={{
                    statusOptions: [
                        { value: "GECTI", label: "Muayene Geçti" },
                        { value: "GECMEDI", label: "Muayene Geçmedi" },
                        { value: "GECERLI", label: "Geçerli" },
                        { value: "YAKLASIYOR", label: "Yaklaşıyor" },
                        { value: "KRITIK", label: "Kritik" },
                        { value: "GECIKTI", label: "Gecikti" },
                        { value: "PASIF", label: "Geçmiş Kayıt" },
                    ],
                    showDateRange: true,
                }}
                excelEntity="muayene"
            />

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Muayene Kaydını Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın muayene bilgilerini güncelleyin.</DialogDescription>
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
