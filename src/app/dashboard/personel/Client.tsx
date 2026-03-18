"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, Users, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable } from "../../../components/ui/data-table";
import { columns, PersonelRow } from "./columns";
import { createPersonel, updatePersonel, deletePersonel } from "./actions";
import { FormFields, ROLLER } from "./PersonelForm";

const EMPTY = { ad: '', soyad: '', eposta: '', telefon: '', rol: 'SOFOR', sirketId: '', sehir: '', tcNo: '' };

export default function PersonelClient({ initialData, sirketler }: { initialData: PersonelRow[], sirketler: { id: string, ad: string, bulunduguIl: string }[] }) {
    const { confirmModal, openConfirm } = useConfirm();
        const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<PersonelRow | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!formData.ad || !formData.soyad) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Ad ve Soyad alanlarını doldurun." });
        }
        setLoading(true);
        const res = await createPersonel(formData as any);
        if (res.success) { 
            setCreateOpen(false); 
            setFormData({ ...EMPTY }); 
            toast.success("Personel Kaydedildi", { description: "Yeni personel başarıyla sisteme eklendi." });
            router.refresh(); 
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        setLoading(true);
        const res = await updatePersonel(editRow.id, formData as any);
        if (res.success) { 
            setEditRow(null); 
            toast.success("Güncelleme Başarılı", { description: "Personel bilgileri güncellendi." });
            router.refresh(); 
        } else {
            toast.error("Güncelleme Hatası", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await openConfirm({ title: "Personeli Sil", message: "Bu personeli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.", confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deletePersonel(id);
        if (res.success) {
            toast.success("Personel Silindi", { description: "Personel kaydı başarıyla kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme İşlemi Başarısız", { description: res.error });
        }
    };

    const openEdit = (row: PersonelRow) => {
        setFormData({
            ad: row.adSoyad.split(' ')[0] || '',
            soyad: row.adSoyad.split(' ').slice(1).join(' ') || '',
            eposta: row.eposta === "-" ? "" : row.eposta,
            telefon: row.telefon === "-" ? "" : row.telefon,
            rol: row.rol,
            sirketId: row.sirketId || '',
            sehir: row.sehir === "-" ? "" : row.sehir,
            tcNo: row.tcNo === "-" ? "" : (row.tcNo || '')
        });
        setEditRow(row);
    };


    const columnsWithActions = [
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
                        onClick={(e) => { e.stopPropagation(); handleDelete(row.original.id); }} 
                        className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Sil"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            )
        },
        ...columns
    ];

    return (
        <div className="w-full min-w-0 max-w-[1400px] mx-auto p-6 md:p-8 xl:p-10">
        {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Users className="text-indigo-600" /> Personel & Kullanıcı İşlemleri
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Sistemdeki tüm şirket çalışanlarını ve yöneticileri görüntüleyin.</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} /> Personel Ekle
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[450px]">
                        <DialogHeader>
                            <DialogTitle>Yeni Personel Kaydı</DialogTitle>
                            <DialogDescription>Filo yönetim sistemine yeni bir kullanıcı veya çalışan ekleyin.</DialogDescription>
                        </DialogHeader>
                        <FormFields formData={formData} setFormData={setFormData} sirketler={sirketler} />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Personeli Düzenle</DialogTitle>
                        <DialogDescription>{editRow?.adSoyad} kişisinin bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields formData={formData} setFormData={setFormData} sirketler={sirketler} />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? 'Güncelleniyor...' : 'Güncelle'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable 
                columns={columnsWithActions as any} 
                data={initialData} 
                searchKey="adSoyad" 
                searchPlaceholder="İsim ile ara..." 
                serverFiltering={{
                    statusOptions: ROLLER.map((rol) => ({ value: rol, label: rol })),
                }}
                tableClassName="min-w-[1280px]"
                onRowClick={(row) => router.push(`/dashboard/personel/${row.id}`)}
                excelEntity="personel"
            />
        </div>
    );
}
