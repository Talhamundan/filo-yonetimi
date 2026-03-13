"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, AlertOctagon, TrendingUp, Trash2, Pencil } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { useRouter } from "next/navigation";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, CezaRow } from "./columns";
import { createCeza, updateCeza, deleteCeza } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

type TopStat = { adSoyad: string; cezaAdet: number; toplamTutar: number; }

const EMPTY = { aracId: '', kullaniciId: '', tutar: '', km: '', aciklama: '', cezaTarihi: new Date().toISOString().split('T')[0], sonOdemeTarihi: '', odendiMi: false };

const FormFields = ({ formData, setFormData, araclar, soforler }: { formData: any, setFormData: any, araclar: any[], soforler: any[] }) => (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Araç (Plaka) <span className="text-red-500">*</span></label>
            <select value={formData.aracId} onChange={e => setFormData({...formData, aracId: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="">Seçiniz...</option>
                {araclar.map((a: any) => <option key={a.id} value={a.id}>{a.plaka}</option>)}
            </select>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Şoför / Kullanıcı (Opsiyonel)</label>
            <select value={formData.kullaniciId} onChange={e => setFormData({...formData, kullaniciId: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm">
                <option value="">Seçiniz...</option>
                {soforler.map((s: any) => <option key={s.id} value={s.id}>{s.ad} {s.soyad}</option>)}
            </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Tutar (₺) <span className="text-red-500">*</span></label>
                <Input type="number" value={formData.tutar} onChange={e => setFormData({...formData, tutar: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Ceza Anındaki KM</label>
                <Input type="number" value={formData.km} onChange={e => setFormData({...formData, km: e.target.value})} className="h-9" placeholder="123456" />
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Ceza Tarihi</label>
                <Input type="date" value={formData.cezaTarihi} onChange={e => setFormData({...formData, cezaTarihi: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Son Ödeme Tarihi</label>
                <Input type="date" value={formData.sonOdemeTarihi} onChange={e => setFormData({...formData, sonOdemeTarihi: e.target.value})} className="h-9" />
            </div>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Açıklama / İhlal Türü</label>
            <Input value={formData.aciklama} onChange={e => setFormData({...formData, aciklama: e.target.value})} placeholder="Hız ihlali, hatalı park vb." className="h-9" />
        </div>
        <div className="flex items-center gap-2">
            <input type="checkbox" id="odendiMi" checked={formData.odendiMi} onChange={e => setFormData({...formData, odendiMi: e.target.checked})} className="h-4 w-4 rounded border-slate-300" />
            <label htmlFor="odendiMi" className="text-sm font-medium">Ceza Ödendi mi?</label>
        </div>
    </div>
);

export default function CezalarClient({
    initialData, top5Stats, araclar, soforler
}: {
    initialData: CezaRow[], top5Stats: TopStat[], araclar: { id: string, plaka: string }[], soforler: { id: string, ad: string, soyad: string }[]
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<CezaRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId || !formData.tutar) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Araç ve Tutar alanlarını doldurun." });
        }
        setLoading(true);
        const res = await createCeza({ 
            ...formData, 
            tutar: parseFloat(formData.tutar), 
            km: formData.km ? parseInt(formData.km) : undefined, 
            cezaTarihi: new Date(formData.cezaTarihi),
            sonOdemeTarihi: formData.sonOdemeTarihi ? new Date(formData.sonOdemeTarihi) : null
        });
        if (res.success) { 
            setCreateOpen(false); 
            setFormData({ ...EMPTY }); 
            toast.success("Ceza Kaydedildi", { description: "Yeni ceza kaydı başarıyla sisteme işlendi." });
            router.refresh(); 
        }
        else toast.error("İşlem Başarısız", { description: res.error });
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.aracId || !formData.tutar) return;
        setLoading(true);
        const res = await updateCeza(editRow.id, { 
            ...formData, 
            tutar: parseFloat(formData.tutar), 
            km: formData.km ? parseInt(formData.km) : undefined, 
            cezaTarihi: new Date(formData.cezaTarihi),
            sonOdemeTarihi: formData.sonOdemeTarihi ? new Date(formData.sonOdemeTarihi) : null
        });
        if (res.success) { 
            setEditRow(null); 
            toast.success("Güncelleme Başarılı", { description: "Ceza kaydı bilgileri başarıyla güncellendi." });
            router.refresh(); 
        }
        else toast.error("Güncelleme Hatası", { description: res.error });
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: "Bu ceza kaydını silmek istediğinizden emin misiniz?", confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteCeza(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Ceza kaydı başarıyla kaldırıldı." });
            router.refresh();
        }
        else toast.error("Silme Hatası", { description: res.error });
    };

    const openEdit = (row: CezaRow) => {
        setFormData({
            aracId: araclar.find(a => a.plaka === row.arac)?.id || '',
            kullaniciId: '',
            tutar: String(row.tutar),
            km: row.km ? String(row.km) : '',
            aciklama: row.aciklama === '-' ? '' : row.aciklama,
            cezaTarihi: new Date(row.tarih).toISOString().split('T')[0],
            sonOdemeTarihi: row.sonOdemeTarihi ? new Date(row.sonOdemeTarihi).toISOString().split('T')[0] : '',
            odendiMi: row.odendiMi
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
                    <button onClick={() => handleDelete(row.original.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors">
                        <Trash2 size={15} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto space-y-8">
        {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <AlertOctagon className="text-rose-600" /> Ceza ve İhlal Yönetimi
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Araçlara ve şoförlere kesilen cezaları takip edin.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} /> Ceza İşle
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yeni Ceza Kaydı</DialogTitle>
                            <DialogDescription>Trafik cezası veya ihlal bilgilerini sisteme girin.</DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} araclar={araclar} soforler={soforler} />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Cezayı Düzenle</DialogTitle>
                        <DialogDescription>Ceza kaydını güncelleyin veya ödeme durumunu değiştirin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} araclar={araclar} soforler={soforler} />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-rose-600 text-white hover:bg-rose-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="col-span-1 border-rose-100 shadow-sm h-min">
                    <CardHeader className="bg-rose-50/50 pb-4">
                        <CardTitle className="text-base text-rose-900 flex items-center gap-2">
                            <TrendingUp size={18} className="text-rose-600" /> En Çok Ceza Yiyen 5 Şoför
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 divide-y">
                        {top5Stats.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4 text-center">Ceza kaydı bulunamadı.</p>
                        ) : top5Stats.map((stat, idx) => (
                            <div key={idx} className="py-3 flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-slate-900">{stat.adSoyad}</p>
                                    <p className="text-xs text-slate-500">{stat.cezaAdet} İhlal Kaydı</p>
                                </div>
                                <p className="font-semibold text-rose-600">₺{stat.toplamTutar.toLocaleString("tr-TR")}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <div className="col-span-1 md:col-span-2">
                    <DataTable columns={columnsWithActions as any} data={initialData} searchKey="arac" searchPlaceholder="Plaka ile ara..." />
                </div>
            </div>
        </div>
    );
}
