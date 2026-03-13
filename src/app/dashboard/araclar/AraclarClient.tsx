"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, FileUp, Trash2, Pencil, Car, Building2, User } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, AracRow } from "./columns";
import { importAraclarFromExcel, createArac, updateArac, deleteArac } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";

const ILLER = ['İSTANBUL', 'BURSA', 'ŞANLIURFA', 'ANKARA', 'DİĞER'];

const EMPTY = {
    plaka: '',
    marka: '',
    model: '',
    yil: new Date().getFullYear(),
    bulunduguIl: 'İSTANBUL',
    guncelKm: 0,
    sirketId: '',
    kullaniciId: '',
    hgsNo: '',
    ruhsatSeriNo: '',
    kategori: 'BINEK'
};

const FormFields = ({ formData, setFormData, sirketler, kullanicilar, ILLER }: { formData: any, setFormData: any, sirketler: any[], kullanicilar: any[], ILLER: string[] }) => (
    <div className="grid grid-cols-2 gap-4 py-4">
        <div className="col-span-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Araç Bilgileri</p>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
                <Car size={14} className="text-slate-400" />
                Plaka <span className="text-rose-500">*</span>
            </label>
            <Input value={formData.plaka} onChange={e => setFormData({...formData, plaka: e.target.value})} placeholder="34 ABC 123" className="h-9 font-mono" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">
                Marka <span className="text-rose-500">*</span>
            </label>
            <Input value={formData.marka} onChange={e => setFormData({...formData, marka: e.target.value})} placeholder="Renault" className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">
                Model <span className="text-rose-500">*</span>
            </label>
            <Input value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="Megane" className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">
                Model Yılı <span className="text-rose-500">*</span>
            </label>
            <Input type="number" value={formData.yil} onChange={e => setFormData({...formData, yil: parseInt(e.target.value)})} className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">
                Güncel KM <span className="text-rose-500">*</span>
            </label>
            <Input type="number" value={formData.guncelKm} onChange={e => setFormData({...formData, guncelKm: parseInt(e.target.value)})} className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Bulunduğu İl</label>
            <select 
                value={formData.bulunduguIl} 
                onChange={e => setFormData({...formData, bulunduguIl: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                {ILLER.map(il => <option key={il} value={il}>{il}</option>)}
            </select>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Araç Kategorisi</label>
            <select 
                value={formData.kategori} 
                onChange={e => setFormData({...formData, kategori: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="BINEK">Binek Araç</option>
                <option value="KAMYON_TIR">Kamyon / Tır</option>
                <option value="IS_MAKINESI">İş Makinesi</option>
            </select>
        </div>
        <div className="col-span-2 pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Organizasyon & Zimmet</p>
        </div>
        <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                Bağlı Şirket
            </label>
            <select 
                value={formData.sirketId} 
                onChange={e => setFormData({...formData, sirketId: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="">Şirket Seçiniz (Bağımsız)</option>
                {sirketler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
        </div>
        <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
                <User size={14} className="text-slate-400" />
                Mevcut Şoför (Zimmet)
            </label>
            <select 
                value={formData.kullaniciId} 
                onChange={e => setFormData({...formData, kullaniciId: e.target.value})}
                className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
            >
                <option value="">Şoför Seçiniz (Atanmamış)</option>
                {kullanicilar.map(u => <option key={u.id} value={u.id}>{u.adSoyad}</option>)}
            </select>
        </div>
        <div className="col-span-2 pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Diğer Bilgiler</p>
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">HGS No</label>
            <Input value={formData.hgsNo} onChange={e => setFormData({...formData, hgsNo: e.target.value})} className="h-9" />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Ruhsat Seri No</label>
            <Input value={formData.ruhsatSeriNo} onChange={e => setFormData({...formData, ruhsatSeriNo: e.target.value})} className="h-9" />
        </div>
    </div>
);

export default function AraclarClient({ 
    initialAraclar, 
    sirketler, 
    kullanicilar 
}: { 
    initialAraclar: AracRow[], 
    sirketler: { id: string, ad: string }[],
    kullanicilar: { id: string, adSoyad: string }[] 
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const searchParams = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<AracRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        const selectedSirketId = searchParams.get("sirket");
        if (selectedSirketId) {
            formData.append("sirketId", selectedSirketId);
        }

        const res = await importAraclarFromExcel(formData);
        
        if (res.success) {
            toast.success(`Excel Aktarımı Başarılı`, {
                description: `${res.count} araç sisteme başarıyla aktarıldı.`
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            router.refresh();
        } else {
            toast.error("Aktarım Başarısız", { description: res.error });
        }
        setUploading(false);
    };

    const handleCreate = async () => {
        if (!formData.plaka || !formData.marka) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Plaka ve Marka alanlarını doldurun." });
        }
        setLoading(true);
        const res = await createArac(formData);
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Araç Kaydedildi", { description: "Yeni araç envantere başarıyla eklendi." });
            router.refresh();
        } else {
            toast.error("Kayıt Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow || !formData.plaka) return;
        setLoading(true);
        const res = await updateArac(editRow.id, formData);
        if (res.success) {
            setEditRow(null);
            toast.success("Güncelleme Başarılı", { description: "Araç bilgileri başarıyla güncellendi." });
            router.refresh();
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, plaka: string) => {
        const confirmed = await openConfirm({ title: "Aracı Sil", message: `${plaka} plakalı aracı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteArac(id);
        if (res.success) {
            toast.success("Araç Silindi", { description: "Araç kaydı sistemden kalıcı olarak kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme İşlemi Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: AracRow) => {
        setFormData({
            plaka: row.plaka,
            marka: row.marka,
            model: row.model,
            yil: row.yil,
            bulunduguIl: row.bulunduguIl,
            guncelKm: row.guncelKm,
            sirketId: (row as any).sirketId || '',
            kullaniciId: (row as any).kullaniciId || '',
            hgsNo: row.hgsNo || '',
            ruhsatSeriNo: (row as any).ruhsatSeriNo || '',
            kategori: row.kategori || 'BINEK'
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
                    <button 
                        onClick={(e) => { e.stopPropagation(); openEdit(row.original); }} 
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition-colors"
                        title="Düzenle"
                    >
                        <Pencil size={15} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(row.original.id, row.original.plaka); }} 
                        className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Sil"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="w-full min-w-0 max-w-[1400px] mx-auto p-6 md:p-8 xl:p-10">
        {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Araç Envanteri</h2>
                    <p className="text-slate-500 text-sm mt-1">Sistemdeki tüm araçların detaylı listesi. Durumlarını, güncel KM ve şoför bilgilerini buradan yönetin.</p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept=".xlsx, .xls" 
                        className="hidden" 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <FileUp size={16} />
                        {uploading ? 'Aktarılıyor...' : "Excel'den Aktar"}
                    </button>
                    
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <button className="bg-[#0F172A] hover:bg-[#1E293B] text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                                <Plus size={16} />
                                Yeni Araç Ekle
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>Araç Kaydı Oluştur</DialogTitle>
                                <DialogDescription>
                                    Filoya yeni bir araç eklemek için temel bilgileri girin.
                                </DialogDescription>
                            </DialogHeader>
                            <FormFields formData={formData} setFormData={setFormData} sirketler={sirketler} kullanicilar={kullanicilar} ILLER={ILLER} />
                            <DialogFooter>
                                <button 
                                    onClick={handleCreate}
                                    disabled={loading}
                                    className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Kaydediliyor...' : 'Kaydet'}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            <Dialog open={!!editRow} onOpenChange={(o) => { if(!o) setEditRow(null); }}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>Araç Bilgilerini Güncelle</DialogTitle>
                        <DialogDescription>
                             "{editRow?.plaka}" plakalı aracın kayıtlı bilgilerini düzenleyin.
                        </DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} sirketler={sirketler} kullanicilar={kullanicilar} ILLER={ILLER} />
                    <DialogFooter>
                        <button 
                            onClick={handleUpdate}
                            disabled={loading}
                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions as any}
                data={initialAraclar}
                searchKey="plaka"
                searchPlaceholder="Plaka ara..."
                tableClassName="min-w-[1560px]"
                onRowClick={(row) => router.push(`/dashboard/araclar/${row.id}`)}
            />
        </div>
    );
}
