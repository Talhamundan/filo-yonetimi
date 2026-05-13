"use client"

import React, { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-modal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Upload, FolderOpen, Download } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { SearchableSelect } from "../../../components/ui/searchable-select";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, DokumanRow } from "./columns";
import { createDokuman, deleteDokuman } from "./actions";
import { useRouter } from "next/navigation";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import SelectedAracInfo from "@/components/arac/SelectedAracInfo";
import { RowActionButton } from "@/components/ui/row-action-button";
import { formatAracOptionLabel } from "@/lib/arac-option-label";

const EMPTY = {
    ad: "",
    aracId: "",
    tur: "RUHSAT" as "RUHSAT" | "SIGORTA" | "KASKO" | "MUAYENE" | "CEZA_MAKBUZU" | "SERVIS_FATURA" | "DIGER",
    dosya: null as File | null
};

export default function DokumanlarClient({ 
    initialDokumanlar, 
    araclar 
}: { 
    initialDokumanlar: DokumanRow[], 
    araclar: { id: string, plaka: string | null, marka?: string | null, model?: string | null, durum?: string | null, bulunduguIl?: string | null }[] 
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { canAccessAllCompanies } = useDashboardScope();
    const router = useRouter();
    const [createOpen, setCreateOpen] = useState(false);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [loading, setLoading] = useState(false);
    const selectedArac = araclar.find((a) => a.id === formData.aracId);

    const handleCreate = async () => {
        if (!formData.aracId || !formData.ad) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen Araç ve Dosya Adı alanlarını doldurun." });
        }
        if (!formData.dosya) {
            return toast.warning("Dosya Eksik", { description: "Lütfen PDF, JPG, JPEG veya PNG dosyası seçin." });
        }

        setLoading(true);
        const uploadForm = new FormData();
        uploadForm.append("ad", formData.ad);
        uploadForm.append("aracId", formData.aracId);
        uploadForm.append("tur", formData.tur);
        uploadForm.append("file", formData.dosya);
        const res = await createDokuman(uploadForm);

        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY });
            toast.success("Belge Yüklendi", { description: "Doküman başarıyla dijital arşive eklendi." });
            router.refresh();
        } else {
            toast.error("Yükleme Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, ad: string) => {
        const confirmed = await openConfirm({ title: "Dosyayı Sil", message: `"${ad}" dosyasını silmek istediğinizden emin misiniz?`, confirmText: "Evet, Sil", variant: "danger" });
        if (!confirmed) return;
        const res = await deleteDokuman(id);
        if (res.success) {
            toast.success("Belge Silindi", { description: "Doküman arşivden kaldırıldı." });
            router.refresh();
        } else {
            toast.error("Silme Hatası", { description: res.error });
        }
    };

    const columnsWithActions = [
        ...getColumns(canAccessAllCompanies).filter(col => (col as any).accessorKey !== 'dosyaUrl'),
        {
            id: 'actions',
            header: () => <div className="text-right">İşlemler</div>,
            cell: ({ row }: any) => (
                <div className="flex justify-end items-center gap-2">
                    <a
                        href={`/api/dokumanlar/${row.original.id}/file?download=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-md hover:bg-indigo-50 text-indigo-600 transition-colors"
                        title="İndir / Görüntüle"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download size={15} />
                    </a>
                    <RowActionButton
                        variant="delete"
                        onClick={(e) => { e.stopPropagation(); handleDelete(row.original.id, row.original.ad); }}
                    />
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
                        <FolderOpen className="text-indigo-600" /> Dijital Evrak ve Arşiv
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Araçlara ait ruhsat, sigorta poliçesi ve servis faturası gibi belgelerin bulut arşivi.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Dialog open={createOpen} onOpenChange={(v) => {
                            setCreateOpen(v);
                            if (!v) setFormData({ ...EMPTY });
                        }}>
                        <DialogTrigger asChild>
                            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                                <Upload size={16} />
                                Yeni Belge Yükle
                            </button>
                        </DialogTrigger>
                        <DialogContent >
                            <DialogHeader>
                                <DialogTitle>Sisteme Evrak Yükle</DialogTitle>
                                <DialogDescription>
                                    Araç plakası ve evrak türünü seçerek belgeyi sisteme kaydedin.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Araç <span className="text-red-500">*</span></label>
                                    <SearchableSelect
                                        value={formData.aracId}
                                        onValueChange={(value) => setFormData({ ...formData, aracId: value })}
                                        placeholder="Araç Seçiniz..."
                                        searchPlaceholder="Plaka / araç ara..."
                                        options={[
                                            { value: "", label: "Araç Seçiniz..." },
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
                                    <label className="text-sm font-medium">Dosya Adı <span className="text-red-500">*</span></label>
                                    <Input 
                                        placeholder="Örn: 2024 Trafik Poliçesi" 
                                        className="h-9" 
                                        value={formData.ad}
                                        onChange={(e) => setFormData({...formData, ad: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Evrak Türü</label>
                                    <select 
                                        className="h-9 flex w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm"
                                        value={formData.tur}
                                        onChange={(e) => setFormData({...formData, tur: e.target.value as any})}
                                    >
                                        <option value="RUHSAT">Ruhsat</option>
                                        <option value="SIGORTA">Trafik Sigortası</option>
                                        <option value="KASKO">Kasko Poliçesi</option>
                                        <option value="MUAYENE">Muayene Evrakı</option>
                                        <option value="CEZA_MAKBUZU">Ceza Makbuzu</option>
                                        <option value="SERVIS_FATURA">Servis & Fatura</option>
                                        <option value="DIGER">Diğer Belgeler</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Dosya Seç</label>
                                    <Input 
                                        type="file" 
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        className="h-9" 
                                        onChange={(e) => setFormData({...formData, dosya: e.target.files?.[0] || null})}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <button 
                                    onClick={handleCreate}
                                    disabled={loading}
                                    className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Yükleniyor...' : 'Arşive Yükle'}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </header>

            <DataTable
                columns={columnsWithActions as any}
                data={initialDokumanlar}
                searchKey="arac_plaka"
                searchPlaceholder="Evrak aramak için plaka giriniz..."
                toolbarArrangement="report-right-scroll"
                serverFiltering={{
                    typeOptions: [
                        { value: "RUHSAT", label: "Ruhsat" },
                        { value: "SIGORTA", label: "Sigorta" },
                        { value: "KASKO", label: "Kasko" },
                        { value: "MUAYENE", label: "Muayene Evrakı" },
                        { value: "CEZA_MAKBUZU", label: "Ceza Makbuzu" },
                        { value: "SERVIS_FATURA", label: "Servis / Fatura" },
                        { value: "DIGER", label: "Diğer" },
                    ],
                    showDateRange: true,
                }}
                excelEntity="dokuman"
            />
        </div>
    );
}
