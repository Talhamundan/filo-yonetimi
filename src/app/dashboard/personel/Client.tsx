"use client"

import { useConfirm } from "@/components/ui/confirm-modal";
import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable } from "../../../components/ui/data-table";
import { getColumns, PersonelRow } from "./columns";
import { createPersonel, updatePersonel, deletePersonel } from "./actions";
import { FormFields, ROLLER, type PersonelFormData } from "./PersonelForm";
import type { ColumnDef } from "@tanstack/react-table";
import type { Rol } from "@prisma/client";
import { useDashboardScope } from "@/components/layout/DashboardScopeContext";
import { RowActionButton } from "@/components/ui/row-action-button";
import { getRoleLabel } from "@/lib/role-label";
import { useDashboardScopedHref } from "@/lib/use-dashboard-scoped-href";
import type { ExternalVendorMode } from "@/lib/external-vendor-mode";

const EMPTY: PersonelFormData = { ad: "", soyad: "", telefon: "", rol: "PERSONEL", sirketId: "", disFirmaId: "", calistigiKurum: "", santiye: "", tcNo: "" };

export default function PersonelClient({
    initialData,
    sirketler,
    disFirmalar = [],
    isTeknik = false,
    isExternalMode = false,
    externalMode = null,
}: {
    initialData: PersonelRow[];
    sirketler: { id: string, ad: string, bulunduguIl: string, santiyeler?: string[] }[];
    disFirmalar?: { id: string; ad: string; tur: string }[];
    isTeknik?: boolean;
    isExternalMode?: boolean;
    externalMode?: ExternalVendorMode | null;
}) {
    const { confirmModal, openConfirm } = useConfirm();
    const { isAdmin, canAssignIndependentRecords } = useDashboardScope();
    const searchParams = useSearchParams();
    const scopedDisFirmaId = searchParams.get("disFirmaId")?.trim() || "";
    const defaultCreateSirketId = !canAssignIndependentRecords && sirketler.length === 1 ? sirketler[0]?.id || "" : "";
    const defaultCreateDisFirmaId = isExternalMode && scopedDisFirmaId ? scopedDisFirmaId : "";
    const router = useRouter();
    const scopedHref = useDashboardScopedHref();
    const [createOpen, setCreateOpen] = useState(false);
    const [editRow, setEditRow] = useState<PersonelRow | null>(null);
    const [formData, setFormData] = useState<PersonelFormData>({
        ...EMPTY,
        sirketId: defaultCreateSirketId,
        disFirmaId: defaultCreateDisFirmaId,
    });
    const [loading, setLoading] = useState(false);
    const vendorLabel = externalMode === "KIRALIK" ? "Kiralık" : externalMode === "TASERON" ? "Taşeron" : "Dış";
    const pageTitle = isExternalMode ? `${vendorLabel} Personeller` : "Personel";
    const pageDescription = isExternalMode
        ? `${vendorLabel} personel kayıtlarını ana personel listesinden ayrı yönetin.`
        : "Sistemdeki tüm şirket personellerini görüntüleyin.";
    const addButtonLabel = isExternalMode ? `Yeni ${vendorLabel} Personel Ekle` : "Personel Ekle";

    const handleCreate = async () => {
        if (!formData.ad || !formData.soyad) {
            return toast.warning("Eksik Bilgi", { description: "Ad ve Soyad alanları zorunludur." });
        }
        if (isExternalMode && !formData.disFirmaId) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen dış firma seçin." });
        }
        setLoading(true);
        const res = await createPersonel(formData);
        if (res.success) {
            setCreateOpen(false);
            setFormData({ ...EMPTY, sirketId: defaultCreateSirketId, disFirmaId: defaultCreateDisFirmaId });
            toast.success("Personel Kaydedildi", { description: "Yeni personel başarıyla sisteme eklendi." });
            router.refresh();
        } else {
            toast.error("İşlem Başarısız", { description: res.error });
        }
        setLoading(false);
    };

    const handleUpdate = async () => {
        if (!editRow) return;
        if (!formData.ad || !formData.soyad) {
            return toast.warning("Eksik Bilgi", { description: "Ad ve Soyad alanları zorunludur." });
        }
        if (isExternalMode && !formData.disFirmaId) {
            return toast.warning("Eksik Bilgi", { description: "Lütfen dış firma seçin." });
        }
        setLoading(true);
        const res = await updatePersonel(editRow.id, formData);
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
            ad: row.adSoyad.split(" ")[0] || "",
            soyad: row.adSoyad.split(" ").slice(1).join(" ") || "",
            telefon: row.telefon === "-" ? "" : row.telefon,
            rol: row.rol as Rol,
            sirketId: row.sirketId || "",
            disFirmaId: row.disFirmaId || "",
            calistigiKurum: row.calistigiKurum === "-" ? "" : row.calistigiKurum,
            santiye: row.santiye === "-" ? "" : (row.santiye || ""),
            tcNo: row.tcNo === "-" ? "" : (row.tcNo || ""),
        });
        setEditRow(row);
    };

    const actionColumn: ColumnDef<PersonelRow> = {
        id: "actions",
        header: "İşlemler",
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <RowActionButton
                    variant="edit"
                    onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
                />
                <RowActionButton
                    variant="delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(row.original.id); }}
                />
            </div>
        ),
    };
    const columnsWithActions: ColumnDef<PersonelRow>[] = [
        ...getColumns(isTeknik),
        actionColumn,
    ];

    return (
        <div className="w-full min-w-0 max-w-[1400px] mx-auto p-6 md:p-8 xl:p-10">
            {confirmModal}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Users className="text-indigo-600" /> {pageTitle}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">{pageDescription}</p>
                </div>
                <Dialog
                    open={createOpen}
                    onOpenChange={(open) => {
                        setCreateOpen(open);
                        if (!open) {
                            setFormData({ ...EMPTY, sirketId: defaultCreateSirketId, disFirmaId: defaultCreateDisFirmaId });
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all flex items-center gap-2">
                            <Plus size={16} /> {addButtonLabel}
                        </button>
                    </DialogTrigger>
                    <DialogContent >
                        <DialogHeader>
                            <DialogTitle>Yeni Personel Kaydı</DialogTitle>
                            <DialogDescription>Filo yönetim sistemine yeni bir personel ekleyin.</DialogDescription>
                        </DialogHeader>
                        <FormFields
                            formData={formData}
                            setFormData={setFormData}
                            sirketler={sirketler}
                            disFirmalar={disFirmalar}
                            allowAdminRole={isAdmin}
                            allowIndependentOption={canAssignIndependentRecords}
                            isExternalMode={isExternalMode}
                            externalMode={externalMode}
                        />
                        <DialogFooter>
                            <button onClick={handleCreate} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50">
                                {loading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </header>

            <Dialog open={!!editRow} onOpenChange={(o) => {
                if (!o) {
                    setEditRow(null);
                    setFormData({ ...EMPTY, sirketId: defaultCreateSirketId, disFirmaId: defaultCreateDisFirmaId });
                }
            }}>
                <DialogContent >
                    <DialogHeader>
                        <DialogTitle>Personeli Düzenle</DialogTitle>
                        <DialogDescription>{editRow?.adSoyad} kişisinin bilgilerini güncelleyin.</DialogDescription>
                    </DialogHeader>
                    <FormFields
                        formData={formData}
                        setFormData={setFormData}
                        sirketler={sirketler}
                        disFirmalar={disFirmalar}
                        allowAdminRole={isAdmin}
                        allowIndependentOption={canAssignIndependentRecords}
                        isExternalMode={isExternalMode}
                        externalMode={externalMode}
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
                searchKey="adSoyad"
                searchPlaceholder="İsim ile ara..."
                serverFiltering={{
                    statusOptions: ROLLER
                        .filter((rol) => rol !== "ADMIN")
                        .map((rol) => ({ value: rol, label: getRoleLabel(rol) })),
                }}
                tableClassName="w-full min-w-0"
                onRowClick={(row) => router.push(scopedHref(`/dashboard/personel/${row.id}`))}
                excelEntity={
                    isExternalMode
                        ? externalMode === "KIRALIK"
                            ? "kiralikPersonel"
                            : "taseronPersonel"
                        : "personel"
                }
            />
        </div>
    );
}
