"use client"

import React, { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, ClipboardCheck, Trash2 } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, SoforZimmetRow } from "./columns";
import { useRouter } from "next/navigation";
import { createZimmet, deleteZimmet } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

const EMPTY = {
    aracId: '',
    kullaniciId: '',
    baslangic: new Date().toISOString().split('T')[0],
    baslangicKm: 0,
    notlar: ''
};

export default function ZimmetlerClient({ 
    initialZimmetler, 
    araclar, 
    kullanicilar 
}: { 
    initialZimmetler: SoforZimmetRow[], 
    araclar: { id: string, plaka: string, guncelKm: number }[],
    kullanicilar: { id: string, adSoyad: string }[]
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.aracId || !formData.kullaniciId) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Araç ve Personel alanlarını seçin." });
        }
        setLoading(true);
        const res = await createZimmet(formData);
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Zimmet Tanımlandı", { description: "Araç ilgili personele başarıyla zimmetlendi." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await openConfirm({ title: "Kaydı Sil", message: "Bu zimmet kaydını silmek istediğinizden emin misiniz? Bu işlem sadece geçmiş kaydı siler, aracın mevcut şoförünü değiştirmez.", confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteZimmet(id);
        if (res.success) {
            toast.success("Kayıt Silindi", { description: "Zimmet geçmişi kaydı sistemden kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Hatası", { description: res.error });
        }
    };

    const handleAracChange = (aracId: string) => {
        const selectedArac = araclar.find(a => a.id === aracId);
        setFormData({
            ...formData,
            aracId,
            baslangicKm: selectedArac ? selectedArac.guncelKm : 0
        });
    };

    const columnsWithActions = [
        ...getColumns(canAccessAllCompanies),
        {
            id: 'actions',
            header: 'İşlemler',
            cell: ({ row }: any) => (
                <div className="flex items-center gap-2">
                    <button onClick={() => handleDelete(row.original.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors">
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
                        <ClipboardCheck className="text-indigo-600" /> Zimmet Geçmişi ve Kayıtları
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Filo dahilindeki tüm geçmiş ve aktif araç-şoför atamalarının listesi.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} />
                            Yeni Zimmet Tanımla
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Yeni Zimmet Kaydı</DialogTitle>
                            <DialogDescription>
                                Aracı bir şoföre atayın. Varsa eski aktif zimmet otomatik olarak kapatılacaktır.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Araç <span className="text-red-500">*</span></label>
                                <select 
                                    value={formData.aracId} 
                                    onChange={e => handleAracChange(e.target.value)}
                                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                >
                                    <option value="">Seçiniz...</option>
                                    {araclar.map(a => <option key={a.id} value={a.id}>{a.plaka}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Personel / Şoför <span className="text-red-500">*</span></label>
                                <select 
                                    value={formData.kullaniciId} 
                                    onChange={e => setFormData({...formData, kullaniciId: e.target.value})}
                                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                >
                                    <option value="">Seçiniz...</option>
                                    {kullanicilar.map(k => <option key={k.id} value={k.id}>{k.adSoyad}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Teslim Tarihi</label>
                                    <Input type="date" value={formData.baslangic} onChange={e => setFormData({...formData, baslangic: e.target.value})} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Teslim KM</label>
                                    <Input type="number" value={formData.baslangicKm} onChange={e => setFormData({...formData, baslangicKm: parseInt(e.target.value)})} className="h-9" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Notlar</label>
                                <Input value={formData.notlar} onChange={e => setFormData({...formData, notlar: e.target.value})} placeholder="Örn: Yedek anahtar teslim edildi" className="h-9" />
                            </div>
                        </div>
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Zimmetleniyor...' : 'Zimmetle'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <DataTable
                columns={columnsWithActions as any}
                data={initialZimmetler}
                searchKey="arac_plaka"
                searchPlaceholder="Araç plakasına göre ara..."
            />
        </div>
    );
}
