"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Building2 } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { useRouter } from "next/navigation";
import { DataTable } from "../../../components/ui/data-table";
import { columns, SirketRow } from "./columns";
import { createSirket, updateSirket, deleteSirket } from "./actions";
import { RowActionButton } from "@/components/ui/row-action-button";
import { serializeSantiyeList } from "@/lib/santiye";

const EMPTY = { ad: '', bulunduguIl: 'BURSA', vergiNo: '', santiyelerText: '' };

const FormFields = ({ formData, setFormData }: { formData: any, setFormData: any }) => (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Şirket Adı <span className="text-red-500">*</span></label>
            <Input value={formData.ad} onChange={e => setFormData({...formData, ad: e.target.value})} placeholder="ABC Lojistik A.Ş." className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Faaliyet İli</label>
            <Input value={formData.bulunduguIl} onChange={e => setFormData({...formData, bulunduguIl: e.target.value})} placeholder="Örn: BURSA" className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Şantiye Sahaları</label>
            <textarea
                value={formData.santiyelerText}
                onChange={e => setFormData({ ...formData, santiyelerText: e.target.value })}
                placeholder={"Örn:\nOCAK\nDOKUM\nASFALT PLENTİ"}
                rows={4}
                className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            <p className="text-[11px] text-slate-500">Her satıra bir şantiye yazın. Araç ve personel formlarında seçim olarak çıkacaktır.</p>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Vergi No</label>
            <Input value={formData.vergiNo} onChange={e => setFormData({...formData, vergiNo: e.target.value})} placeholder="1234567890" className="h-9" />
        </div>
    </div>
);

export default function SirketlerClient({ initialData }: { initialData: SirketRow[] }) {
    const { confirmModal, openConfirm } = useConfirm();
        const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<SirketRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.ad) {
            return toast.warning("Eksik Bilgi", { description: "Şirket adı zorunludur." });
        }
        setLoading(true);
        const res = await createSirket(formData);
        if (res.success) { 
            setCreateOpen(false); 
            setFormData({ ...EMPTY }); 
            toast.success("Şirket Kaydedildi", { description: "Şirket başarıyla sisteme eklendi." });
            router.refresh(); 
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        if (!formData.ad) {
            return toast.warning("Eksik Bilgi", { description: "Şirket adı zorunludur." });
        }
        setLoading(true);
        const res = await updateSirket(editRow.id, formData);
        if (res.success) { 
            setEditRow(null); 
            toast.success("Güncelleme Başarılı", { description: "Şirket bilgileri başarıyla güncellendi." });
            router.refresh(); 
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await openConfirm({ title: "Şirketi Sil", message: "Bu şirketi silmek istediğinizden emin misiniz? Bağlı araç ve personeller varsa silinemez.", confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteSirket(id);
        if (res.success) {
            toast.success("Şirket Silindi", { description: "Şirket başarıyla kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme İşlemi Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: SirketRow) => {
        setFormData({
            ad: row.ad,
            bulunduguIl: row.bulunduguIl,
            vergiNo: row.vergiNo === 'Belirtilmedi' ? '' : row.vergiNo,
            santiyelerText: serializeSantiyeList(row.santiyeler || []),
        });
        setEditRow(row);
    };


    const columnsWithActions = [
        ...columns,
        {
            id: 'actions',
            header: 'İşlemler',
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <RowActionButton variant="edit" onClick={() => openEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original.id)} />
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
                        <Building2 className="text-indigo-600" /> Şirket Yönetimi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Platforma kayıtlı tüm müşteri şirketleri.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={(v) => {
                    setCreateOpen(v);
                    if (!v) setFormData({ ...EMPTY });
                }}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} /> Yeni Şirket Ekle
                        </button>
                    </DialogTrigger>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Yeni Şirket Kaydı</DialogTitle>
                            <DialogDescription>Sisteme yeni bir müşteri/tenant şirketi ekleyin.</DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Edit Modal */}
            <Dialog open={!!editRow} onOpenChange={(o) => {
                if (!o) {
                    setEditRow(null);
                    setFormData({ ...EMPTY });
                }
            }}>
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Şirketi Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.ad}" şirketinin bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable columns={columnsWithActions as any} data={initialData} searchKey="ad" searchPlaceholder="Şirket adı ara..." excelEntity="sirket" />
        </div>
    );
}
