"use client"
import React, { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, ShieldCheck, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { columns, KaskoRow } from "./columns";
import { useRouter } from "next/navigation";
import { createKasko, updateKasko, deleteKasko } from "./actions";

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

export default function KaskoClient({ initialKaskolar, araclar }: { initialKaskolar: KaskoRow[], araclar: { id: string, plaka: string }[] }) {
    const { confirmModal, openConfirm } = useConfirm();
        const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<KaskoRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen bir araç seçin." });
        }
        setLoading(true);
        const res = await createKasko({ ...formData, tutar: formData.tutar ? parseFloat(formData.tutar) : undefined });
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Kasko Kaydedildi", { description: "Yeni kasko poliçesi başarıyla eklendi." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) return;
        setLoading(true);
        const res = await updateKasko(editRow.id, { ...formData, tutar: formData.tutar ? parseFloat(formData.tutar) : undefined });
        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Kasko poliçesi bilgileri güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, arac: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${arac} aracına ait kasko kaydını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteKasko(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Kasko poliçesi sistemden kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: KaskoRow) => {
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
        ...columns,
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
                        <ShieldCheck className="text-indigo-600" /> Kasko Poliçe Yönetimi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Araçlara ait kasko poliçelerinin kapsam, tarih ve maliyet takibi.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Kasko Poliçesi
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yeni Kasko Kaydı</DialogTitle>
                            <DialogDescription>
                                Araç plakası ve poliçe detaylarını belirterek sistemi güncelleyin.
                            </DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Kasko Poliçesini Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın poliçe bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} araclar={araclar} />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions as any}
                data={initialKaskolar}
                searchKey="arac_plaka"
                searchPlaceholder="Kasko poliçesi için araç plakası ara..."
            />
        </div>
    );
}
