"use client"
import React, { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, Wrench, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { columns, BakimRow } from "./columns";
import { addBakim, updateBakim, deleteBakim } from "./actions";
import { useRouter } from "next/navigation";

const EMPTY = {
    aracId: "",
    tur: "PERIYODIK" as "PERIYODIK" | "ARIZA" | "KAPORTA",
    bakimTarihi: new Date().toISOString().split('T')[0],
    yapilanKm: "",
    servisAdi: "",
    yapilanIslemler: "",
    tutar: ""
};

export default function BakimlarClient({ initialBakimlar, activeAraclar }: { initialBakimlar: BakimRow[], activeAraclar: { id: string; plaka: string; }[] }) {
    const { confirmModal, openConfirm } = useConfirm();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<BakimRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCreate = async () => {
        if (!formData.aracId || !formData.bakimTarihi || !formData.yapilanKm || !formData.tutar) {
            toast.warning("Eksik Bilgi", { description: "Lütfen zorunlu yıldızlı (*) alanları doldurun." });
            return;
        }

        setLoading(true);
        const res = await addBakim({
            aracId: formData.aracId,
            bakimTarihi: new Date(formData.bakimTarihi),
            yapilanKm: parseInt(formData.yapilanKm),
            tur: formData.tur,
            servisAdi: formData.servisAdi || undefined,
            yapilanIslemler: formData.yapilanIslemler || undefined,
            tutar: parseFloat(formData.tutar)
        });

        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Bakım Kaydedildi", { description: "Servis/Bakım kaydı başarıyla oluşturuldu." });
            router.refresh();
        } else {
            toast.error("Kayıt Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId) return;
        setLoading(true);
        const res = await updateBakim(editRow.id, {
            aracId: formData.aracId,
            bakimTarihi: new Date(formData.bakimTarihi),
            yapilanKm: parseInt(formData.yapilanKm),
            tur: formData.tur,
            servisAdi: formData.servisAdi || undefined,
            yapilanIslemler: formData.yapilanIslemler || undefined,
            tutar: parseFloat(formData.tutar)
        });

        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Servis kaydı bilgileri güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, plaka: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: `${plaka} plakalı aracın bu servis kaydını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteBakim(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Servis kaydı başarıyla kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Hatası", { description: res.error });
        }
    };

    const openEdit = (row: BakimRow) => {
        setFormData({
            aracId: row.arac.id,
            tur: (row.tur as any) || "PERIYODIK",
            bakimTarihi: new Date(row.bakimTarihi).toISOString().split('T')[0],
            yapilanKm: String(row.yapilanKm),
            servisAdi: row.servisAdi || "",
            yapilanIslemler: row.yapilanIslemler || "",
            tutar: String(row.tutar)
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
                    <button onClick={() => handleDelete(row.original.id, row.original.arac)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors">
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
                        <Wrench className="text-indigo-600" /> Servis & Bakım Yönetimi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Filodaki tüm araçların güncel ve geçmiş servis operasyonlarının takibi.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Servis Kaydı
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yeni Servis Kaydı</DialogTitle>
                            <DialogDescription>
                                Araç plakası üzerinden yeni bir periyodik bakım veya servis faturası kaydı işleyebilirsiniz.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Araç <span className="text-red-500">*</span></label>
                                <select
                                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    value={formData.aracId}
                                    onChange={(e) => setFormData({...formData, aracId: e.target.value})}
                                >
                                    <option value="">Araç Seçiniz</option>
                                    {activeAraclar.map(arac => (
                                        <option key={arac.id} value={arac.id}>{arac.plaka}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Bakım Tipi <span className="text-red-500">*</span></label>
                                <select
                                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                    value={formData.tur}
                                    onChange={(e) => setFormData({...formData, tur: e.target.value as any})}
                                >
                                    <option value="PERIYODIK">Periyodik</option>
                                    <option value="ARIZA">Arıza</option>
                                    <option value="KAPORTA">Kaporta</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Tarih <span className="text-red-500">*</span></label>
                                    <Input type="date" value={formData.bakimTarihi} onChange={e => setFormData({...formData, bakimTarihi: e.target.value})} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">KM <span className="text-red-500">*</span></label>
                                    <Input type="number" value={formData.yapilanKm} onChange={e => setFormData({...formData, yapilanKm: e.target.value})} className="h-9" placeholder="Mevcut KM" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Servis Adı</label>
                                <Input value={formData.servisAdi} onChange={e => setFormData({...formData, servisAdi: e.target.value})} placeholder="Örn: Renault Bahaş" className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">İşlemler</label>
                                <textarea 
                                    value={formData.yapilanIslemler} 
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, yapilanIslemler: e.target.value})} 
                                    placeholder="Yapılan işlemler..." 
                                    className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 h-20 resize-none" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                                <Input type="number" step="0.01" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} placeholder="0.00" className="h-9" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            {/* Edit Dialog */}
            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Servis Kaydını Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın servis bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Araç <span className="text-red-500">*</span></label>
                            <select
                                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                value={formData.aracId}
                                onChange={(e) => setFormData({...formData, aracId: e.target.value})}
                            >
                                <option value="">Araç Seçiniz</option>
                                {activeAraclar.map(arac => (
                                    <option key={arac.id} value={arac.id}>{arac.plaka}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Bakım Tipi <span className="text-red-500">*</span></label>
                            <select
                                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                value={formData.tur}
                                onChange={(e) => setFormData({...formData, tur: e.target.value as any})}
                            >
                                <option value="PERIYODIK">Periyodik</option>
                                <option value="ARIZA">Arıza</option>
                                <option value="KAPORTA">Kaporta</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tarih <span className="text-red-500">*</span></label>
                                <Input type="date" value={formData.bakimTarihi} onChange={e => setFormData({...formData, bakimTarihi: e.target.value})} className="h-9" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">KM <span className="text-red-500">*</span></label>
                                <Input type="number" value={formData.yapilanKm} onChange={e => setFormData({...formData, yapilanKm: e.target.value})} className="h-9" placeholder="Mevcut KM" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Servis Adı</label>
                            <Input value={formData.servisAdi} onChange={e => setFormData({...formData, servisAdi: e.target.value})} placeholder="Örn: Renault Bahaş" className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">İşlemler</label>
                            <textarea 
                                value={formData.yapilanIslemler} 
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({...formData, yapilanIslemler: e.target.value})} 
                                placeholder="Yapılan işlemler..." 
                                className="flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 h-20 resize-none" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                            <Input type="number" step="0.01" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} placeholder="0.00" className="h-9" />
                        </div>
                    </div>
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions as any}
                data={initialBakimlar}
                searchKey="arac_plaka"
                searchPlaceholder="Gösterilecek bakım geçmişi için plaka arayın..."
            />
        </div>
    );
}
