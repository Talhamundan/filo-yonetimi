"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { RowActionButton } from "@/components/ui/row-action-button";
import { useConfirm } from "@/components/ui/confirm-modal";
import { columns, type DisFirmaRow } from "./columns";
import { createDisFirma, deleteDisFirma, updateDisFirma } from "./actions";
import { disFirmaFormSchema, getDisFirmaTurLabel, type DisFirmaFormValues, type DisFirmaScopeValue, type DisFirmaTuruValue } from "./schema";

const EMPTY_BASE = {
    ad: "",
    sehir: "BURSA",
    vergiNo: "",
    yetkiliKisi: "",
    telefon: "",
    calistigiKurum: "",
};

type Props = {
    title: string;
    description: string;
    tur: DisFirmaScopeValue;
    initialData: DisFirmaRow[];
    sirketler: Array<{ id: string; ad: string }>;
};

function forceUppercase(value: string) {
    return value.toLocaleUpperCase("tr-TR");
}

function FormFields({
    formData,
    setFormData,
    sirketler,
    allowTypeSelection,
}: {
    formData: DisFirmaFormValues;
    setFormData: React.Dispatch<React.SetStateAction<DisFirmaFormValues>>;
    sirketler: Array<{ id: string; ad: string }>;
    allowTypeSelection: boolean;
}) {
    const hasCurrentKurum = Boolean(
        formData.calistigiKurum &&
        !sirketler.some((sirket) => sirket.ad.localeCompare(formData.calistigiKurum || "", "tr-TR", { sensitivity: "base" }) === 0)
    );

    return (
        <div className="grid gap-4 py-4">
            {allowTypeSelection ? (
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Firma Türü <span className="text-rose-500">*</span></label>
                    <select
                        value={formData.tur}
                        onChange={(e) => setFormData({ ...formData, tur: e.target.value as DisFirmaTuruValue })}
                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                    >
                        <option value="TASERON">Taşeron</option>
                        <option value="KIRALIK">Kiralık</option>
                    </select>
                </div>
            ) : null}
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Firma Adı <span className="text-rose-500">*</span></label>
                <Input value={formData.ad} onChange={(e) => setFormData({ ...formData, ad: forceUppercase(e.target.value) })} placeholder="ANIT ASFALT" className="h-9 uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Şehir <span className="text-rose-500">*</span></label>
                    <Input value={formData.sehir} onChange={(e) => setFormData({ ...formData, sehir: forceUppercase(e.target.value) })} placeholder="BURSA" className="h-9 uppercase" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Vergi No</label>
                    <Input value={formData.vergiNo || ""} onChange={(e) => setFormData({ ...formData, vergiNo: e.target.value })} placeholder="1234567890" className="h-9" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Yetkili Kişi</label>
                    <Input value={formData.yetkiliKisi || ""} onChange={(e) => setFormData({ ...formData, yetkiliKisi: forceUppercase(e.target.value) })} placeholder="AD SOYAD" className="h-9 uppercase" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Telefon</label>
                    <Input value={formData.telefon || ""} onChange={(e) => setFormData({ ...formData, telefon: e.target.value })} placeholder="0532 xxx xx xx" className="h-9" />
                </div>
            </div>
            <div className="space-y-1.5">
                <label className="text-sm font-medium">Çalıştığı Kurum</label>
                <select
                    value={formData.calistigiKurum || ""}
                    onChange={(e) => setFormData({ ...formData, calistigiKurum: e.target.value })}
                    className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                    <option value="">Kurum seçiniz</option>
                    {hasCurrentKurum ? <option value={formData.calistigiKurum}>{formData.calistigiKurum}</option> : null}
                    {sirketler.map((sirket) => <option key={sirket.id} value={sirket.ad}>{sirket.ad}</option>)}
                </select>
            </div>
        </div>
    );
}

export default function DisFirmalarClient({ title, description, tur, initialData, sirketler }: Props) {
    const router = useRouter();
    const { confirmModal, openConfirm } = useConfirm();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<DisFirmaRow | null>(null);
    const [formData, setFormData] = useState<DisFirmaFormValues>({
        ...EMPTY_BASE,
        tur: tur === "ALL" ? "TASERON" : tur,
    });
    const [loading, setLoading] = useState(false);
    const allowTypeSelection = tur === "ALL";
    const displayTur = allowTypeSelection ? formData.tur : tur;
    const Icon = displayTur === "KIRALIK" ? Truck : Building2;
    const entityLabel = getDisFirmaTurLabel(displayTur);

    const columnsWithActions = [
        ...columns,
        {
            id: "actions",
            header: "İşlemler",
            cell: ({ row }: { row: { original: DisFirmaRow } }) => (
                <div className="flex items-center gap-2">
                    <RowActionButton variant="edit" onClick={() => openEdit(row.original)} />
                    <RowActionButton variant="delete" onClick={() => handleDelete(row.original)} />
                </div>
            ),
        },
    ];

    const resetForm = () =>
        setFormData({
            ...EMPTY_BASE,
            tur: tur === "ALL" ? "TASERON" : tur,
        });

    const validateForm = () => {
        const result = disFirmaFormSchema.safeParse(formData);
        if (result.success) return result.data;
        toast.warning("Eksik veya Hatalı Bilgi", { description: result.error.issues[0]?.message || "Lütfen formu kontrol edin." });
        return null;
    };

    const handleCreate = async () => {
        const parsed = validateForm();
        if (!parsed) return;
        setLoading(true);
        const res = await createDisFirma(parsed);
        setLoading(false);
        if (res.success) {
            setCreateOpen(false);
            resetForm();
            toast.success(`${getDisFirmaTurLabel(parsed.tur)} firma kaydedildi.`);
            router.refresh();
            return;
        }
        toast.error("İşlem Başarısız", { description: res.error });
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        const parsed = validateForm();
        if (!parsed) return;
        setLoading(true);
        const res = await updateDisFirma(editRow.id, parsed);
        setLoading(false);
        if (res.success) {
            setEditRow(null);
            resetForm();
            toast.success((res as any).pendingApproval ? "Admin Onayı Bekleniyor" : `${getDisFirmaTurLabel(parsed.tur)} firma güncellendi.`, {
                description: (res as any).message,
            });
            router.refresh();
            return;
        }
        toast.error("Güncelleme Başarısız", { description: res.error });
    };

    const handleDelete = async (row: DisFirmaRow) => {
        const rowTypeLabel = getDisFirmaTurLabel(row.tur);
        const confirmed = await openConfirm({
            title: `${rowTypeLabel} Firmayı Sil`,
            message: `${row.ad} firmasını silmek istediğinizden emin misiniz? Bağlı araç veya personel varsa silinemez.`,
            confirmText: "Evet, Sil",
            variant: "danger",
        });
        if (!confirmed) return;
        const res = await deleteDisFirma(row.id);
        if (res.success) {
            toast.success((res as any).pendingApproval ? "Admin Onayı Bekleniyor" : "Firma silindi.", {
                description: (res as any).message,
            });
            router.refresh();
            return;
        }
        toast.error("Silme İşlemi Başarısız", { description: res.error });
    };

    const openEdit = (row: DisFirmaRow) => {
        setFormData({
            ad: row.ad,
            tur: row.tur,
            sehir: row.sehir,
            vergiNo: row.vergiNo === "Belirtilmedi" ? "" : row.vergiNo,
            yetkiliKisi: row.yetkiliKisi === "-" ? "" : row.yetkiliKisi,
            telefon: row.telefon === "-" ? "" : row.telefon,
            calistigiKurum: row.calistigiKurum || "",
        });
        setEditRow(row);
    };

    const excelEntity = tur === "KIRALIK" ? "kiralikFirma" : tur === "TASERON" ? "taseronFirma" : "disFirma";

    return (
        <div className="p-6 md:p-8 xl:p-10 max-w-[1400px] mx-auto">
            {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Icon className="text-indigo-600" /> {title}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">{description}</p>
                </div>
                <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} /> Yeni {allowTypeSelection ? "Dış" : entityLabel} Firma Ekle
                        </button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni {allowTypeSelection ? "Dış" : entityLabel} Firma Kaydı</DialogTitle>
                            <DialogDescription>Dış hizmet aldığımız firmayı sisteme ekleyin.</DialogDescription>
                        </DialogHeader>
                        <FormFields
                            formData={formData}
                            setFormData={setFormData}
                            sirketler={sirketler}
                            allowTypeSelection={allowTypeSelection}
                        />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) { setEditRow(null); resetForm(); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Firmayı Düzenle</DialogTitle>
                        <DialogDescription>{editRow?.ad} firmasının bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields
                        formData={formData}
                        setFormData={setFormData}
                        sirketler={sirketler}
                        allowTypeSelection={allowTypeSelection}
                    />
                    <DialogFooter>
                        <button onClick={handleUpdate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                            {loading ? "Güncelleniyor..." : "Güncelle"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={columnsWithActions}
                data={initialData}
                searchKey="ad"
                searchPlaceholder="Firma adı ara..."
                excelEntity={excelEntity}
            />
        </div>
    );
}
