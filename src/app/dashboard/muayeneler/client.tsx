"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../../../components/ui/dialog";
import { Plus, CheckCircle2 } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { SearchableSelect } from "../../../components/ui/searchable-select";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, MuayeneRow } from "./columns";
import { useRouter } from "next/navigation";
import { createMuayene, updateMuayene, deleteMuayene } from "./actions";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { RowActionButton } from "@/components/ui/row-action-button";
import { formatAracOptionLabel } from "@/lib/arac-option-label";

const toDateInputValue = (value?: string | Date | null) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 10);
};

const todayDateInput = () => toDateInputValue(new Date());

const EMPTY = {
    aracId: '',
    gecerlilikTarihi: todayDateInput(),
};

type AracOption = {
    id: string;
    plaka: string | null;
    marka?: string | null;
    model?: string | null;
    durum?: string | null;
    bulunduguIl?: string | null;
};

const FormFields = ({ formData, setFormData, araclar }: { formData: any, setFormData: any, araclar: AracOption[] }) => {
    const selectedArac = araclar.find((a) => a.id === formData.aracId);

    return (
    <div className="grid gap-4 py-4">
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Araç (Plaka) <span className="text-red-500">*</span></label>
            <SearchableSelect
                value={formData.aracId} 
                onValueChange={(value) => setFormData({ ...formData, aracId: value })}
                placeholder="Seçiniz..."
                searchPlaceholder="Plaka / araç ara..."
                options={[
                    { value: "", label: "Seçiniz..." },
                    ...araclar.map((a) => ({
                        value: a.id,
                        label: formatAracOptionLabel(a),
                        searchText: [a.plaka, a.marka, a.model].filter(Boolean).join(" "),
                    })),
                ]}
            />
            <SelectedAracInfo arac={selectedArac} />
        </div>
        <div className="space-y-1.5">
            <label className="text-sm font-medium">Geçerlilik Bitiş Tarihi <span className="text-red-500">*</span></label>
            <Input
                type="date"
                value={formData.gecerlilikTarihi}
                onChange={e => setFormData({ ...formData, gecerlilikTarihi: e.target.value })}
                className="h-9"
            />
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
        if (!formData.gecerlilikTarihi) {
            return toast.warning("Tarih Eksik", { description: "Lütfen geçerlilik bitiş tarihini girin." });
        }
        setLoading(true);
        const res = await createMuayene({
            aracId: formData.aracId,
            gecerlilikTarihi: formData.gecerlilikTarihi,
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
        if (!formData.gecerlilikTarihi) {
            return toast.warning("Tarih Eksik", { description: "Lütfen geçerlilik bitiş tarihini girin." });
        }
        setLoading(true);
        const res = await updateMuayene(editRow.id, {
            aracId: formData.aracId,
            gecerlilikTarihi: formData.gecerlilikTarihi,
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
            gecerlilikTarihi: toDateInputValue(row.gecerlilikTarihi),
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
                    <RowActionButton variant="edit" onClick={() => openEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original.id, row.original.arac.plaka)} />
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
                    <p className="text-slate-500 text-sm mt-1">Araçların muayene geçerlilik tarihlerini takip edin.</p>
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
                                Plaka ve geçerlilik tarihini girerek kaydı tamamlayın.
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
                    showDateRange: true,
                }}
                excelEntity="muayene"
            />

            <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Muayene Geçerlilik Tarihini Düzenle</DialogTitle>
                        <DialogDescription>"{editRow?.arac.plaka}" plakalı aracın geçerlilik tarihini güncelleyin.</DialogDescription>
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
